/* ============================================================
   ARCHITECTURE INTÉRIEURE — devoir-detail.js
   Utilise le client Supabase unique créé par supabase-client.js.
   ============================================================ */

const DEVOIR_BUCKET = 'architecture-interieure';

let currentUser = null;
let currentRole = null;
let devoirId = null;
let devoirData = null;

function escapeHtml(str){
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(iso){
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function init(){
  const params = new URLSearchParams(window.location.search);
  devoirId = params.get('id');
  if (!devoirId){ window.location.href = 'devoirs.html'; return; }

  const { data: { session } } = await sb.auth.getSession();
  if (!session){ window.location.href = 'connexion.html'; return; }
  currentUser = session.user;

  const { data: profile } = await sb.from('profiles').select('role').eq('id', currentUser.id).single();
  currentRole = profile ? profile.role : null;
  if (!currentRole || currentRole === 'visitor'){ window.location.href = 'tableau-de-bord.html'; return; }

  const { data, error } = await sb.from('devoirs')
    .select('id, title, instructions, due_date, created_at, profiles ( full_name )')
    .eq('id', devoirId)
    .single();

  if (error || !data){
    document.getElementById('devoirGuardMsg').textContent = 'Ce devoir est introuvable.';
    return;
  }
  devoirData = data;

  document.getElementById('devoirGuardMsg').style.display = 'none';
  document.getElementById('devoirContent').style.display = 'block';
  document.title = devoirData.title + ' — Devoirs — Architecture Intérieure';
  document.getElementById('devoirFil').textContent = devoirData.title;

  document.getElementById('devoirDetail').innerHTML = `
    <h1 class="forum-detail-title">${escapeHtml(devoirData.title)}</h1>
    <div class="forum-topic-meta">Assigné par ${devoirData.profiles ? escapeHtml(devoirData.profiles.full_name) : '—'} · ${formatDate(devoirData.created_at)}${devoirData.due_date ? ' · Limite : ' + formatDate(devoirData.due_date) : ''}</div>
    <div class="forum-detail-content">${escapeHtml(devoirData.instructions).replace(/\n/g, '<br>')}</div>
  `;

  if (currentRole === 'teacher' || currentRole === 'admin'){
    renderStaffView();
  } else {
    renderStudentView();
  }
}

/* ------------------------------------------------------------
   VUE ÉTUDIANT
------------------------------------------------------------ */
async function renderStudentView(){
  const body = document.getElementById('devoirBody');
  body.innerHTML = `<div class="empty-state">Chargement de ton rendu...</div>`;

  const { data: sub } = await sb.from('devoir_soumissions')
    .select('*')
    .eq('devoir_id', devoirId)
    .eq('student_id', currentUser.id)
    .maybeSingle();

  if (sub && sub.graded_at){
    body.innerHTML = `
      <div class="devoir-grade-box">
        <span class="devoir-grade-num">${sub.note}<small>/20</small></span>
        <div>
          <div class="eyebrow" style="margin-bottom:6px;">Corrigé le ${formatDate(sub.graded_at)}</div>
          ${sub.feedback ? `<p>${escapeHtml(sub.feedback)}</p>` : '<p style="color:var(--ink-soft);">Pas de commentaire.</p>'}
        </div>
      </div>
      <div class="dash-section">
        <div class="section-label"><span>Ton rendu</span></div>
        ${sub.content_text ? `<p>${escapeHtml(sub.content_text).replace(/\n/g, '<br>')}</p>` : ''}
        ${sub.file_url ? `<a href="${escapeHtml(sub.file_url)}" target="_blank" class="btn-text-link" style="text-align:left;">Voir le fichier rendu &rarr;</a>` : ''}
      </div>
    `;
    return;
  }

  body.innerHTML = `
    <div class="dash-section">
      <div class="section-label"><span>${sub ? 'Modifier mon rendu' : 'Rendre le devoir'}</span></div>
      ${sub ? '<p class="dash-hint">Ton rendu est en attente de correction — tu peux encore le modifier.</p>' : ''}
      <form id="submitForm">
        <div class="form-group">
          <label for="s-text">Réponse écrite (optionnelle si tu joins un fichier)</label>
          <textarea id="s-text" style="min-height:120px;">${sub ? escapeHtml(sub.content_text) : ''}</textarea>
        </div>
        <div class="form-group">
          <label for="s-file">Fichier (optionnel)</label>
          <input type="file" id="s-file">
          ${sub && sub.file_url ? `<p class="form-hint">Fichier actuel : <a href="${escapeHtml(sub.file_url)}" target="_blank">voir</a> — en choisir un nouveau le remplace.</p>` : ''}
        </div>
        <button type="submit" class="btn-primary" id="submitBtn">${sub ? 'Mettre à jour mon rendu' : 'Envoyer mon rendu'}</button>
        <div id="submitStatus"></div>
      </form>
    </div>
  `;

  document.getElementById('submitForm').addEventListener('submit', (e) => handleStudentSubmit(e, sub));
}

async function handleStudentSubmit(e, existing){
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const statusEl = document.getElementById('submitStatus');
  btn.disabled = true;
  btn.textContent = 'Envoi...';
  statusEl.innerHTML = '';

  try {
    const contentText = document.getElementById('s-text').value.trim();
    const fileInput = document.getElementById('s-file');
    const file = fileInput.files[0];

    if (!contentText && !file && !(existing && existing.file_url)){
      throw new Error("Ajoute une réponse écrite ou un fichier.");
    }

    let fileUrl = existing ? existing.file_url : null;
    if (file){
      const ext = file.name.split('.').pop();
      const path = `devoirs/${devoirId}/${currentUser.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await sb.storage.from(DEVOIR_BUCKET).upload(path, file);
      if (uploadError) throw uploadError;
      const { data: publicData } = sb.storage.from(DEVOIR_BUCKET).getPublicUrl(path);
      fileUrl = publicData.publicUrl;
    }

    const payload = { content_text: contentText || null, file_url: fileUrl, submitted_at: new Date().toISOString() };

    let error;
    if (existing){
      ({ error } = await sb.from('devoir_soumissions').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await sb.from('devoir_soumissions').insert({ ...payload, devoir_id: devoirId, student_id: currentUser.id }));
    }
    if (error) throw error;

    statusEl.innerHTML = `<div class="submit-status ok">Rendu envoyé.</div>`;
    setTimeout(renderStudentView, 700);

  } catch (err){
    statusEl.innerHTML = `<div class="submit-status err">${escapeHtml(err.message || String(err))}</div>`;
    btn.disabled = false;
    btn.textContent = existing ? 'Mettre à jour mon rendu' : 'Envoyer mon rendu';
  }
}

/* ------------------------------------------------------------
   VUE PROF / ADMIN
------------------------------------------------------------ */
async function renderStaffView(){
  const body = document.getElementById('devoirBody');
  body.innerHTML = `<div class="empty-state">Chargement des rendus...</div>`;

  const { data: subs, error } = await sb.from('devoir_soumissions')
    .select('*, profiles ( full_name )')
    .eq('devoir_id', devoirId)
    .order('submitted_at', { ascending: true });

  if (error){
    body.innerHTML = `<div class="empty-state">Erreur : ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!subs || subs.length === 0){
    body.innerHTML = `<div class="empty-state">Aucun rendu pour l'instant.</div>`;
    return;
  }

  body.innerHTML = `
    <div class="dash-section">
      <div class="section-label"><span>${subs.length} rendu${subs.length > 1 ? 's' : ''}</span></div>
      <div id="submissionsList"></div>
    </div>
  `;
  const listEl = document.getElementById('submissionsList');

  listEl.innerHTML = subs.map(s => `
    <div class="devoir-sub-card" id="sub-${s.id}">
      <div class="forum-topic-meta">${escapeHtml(s.profiles ? s.profiles.full_name : '—')} · rendu le ${formatDate(s.submitted_at)}</div>
      ${s.content_text ? `<p style="margin-top:10px;">${escapeHtml(s.content_text).replace(/\n/g, '<br>')}</p>` : ''}
      ${s.file_url ? `<a href="${escapeHtml(s.file_url)}" target="_blank" class="btn-text-link" style="text-align:left; margin-top:8px;">Voir le fichier &rarr;</a>` : ''}

      <div class="devoir-grade-form">
        <div class="form-group" style="max-width:120px;">
          <label>Note /20</label>
          <input type="number" min="0" max="20" step="0.5" class="d-note-input" value="${s.note ?? ''}">
        </div>
        <div class="form-group">
          <label>Commentaire</label>
          <textarea class="d-feedback-input" style="min-height:70px;">${escapeHtml(s.feedback)}</textarea>
        </div>
        <div class="devoir-grade-actions">
          <button type="button" class="btn-primary d-save-btn" style="width:auto;">Enregistrer la note</button>
          <button type="button" class="btn-secondary-small d-notify-btn" ${!s.graded_at ? 'disabled' : ''}>${s.notified_at ? 'Renvoyer la notification' : 'Notifier l\\'étudiant'}</button>
        </div>
        <div class="d-grade-status">${s.notified_at ? `<span class="status-badge status-valide">Notifié le ${formatDate(s.notified_at)}</span>` : ''}</div>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('.d-save-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => saveGrade(subs[i].id, btn));
  });
  listEl.querySelectorAll('.d-notify-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => notifyStudent(subs[i].id, btn));
  });
}

async function saveGrade(subId, btn){
  const card = document.getElementById(`sub-${subId}`);
  const note = card.querySelector('.d-note-input').value;
  const feedback = card.querySelector('.d-feedback-input').value;
  const statusEl = card.querySelector('.d-grade-status');

  btn.disabled = true;
  btn.textContent = 'Enregistrement...';

  const { error } = await sb.from('devoir_soumissions').update({
    note: note === '' ? null : parseFloat(note),
    feedback: feedback || null,
    graded_at: new Date().toISOString(),
    graded_by: currentUser.id
  }).eq('id', subId);

  btn.disabled = false;
  btn.textContent = 'Enregistrer la note';

  if (error){
    statusEl.innerHTML = `<div class="submit-status err">${escapeHtml(error.message)}</div>`;
    return;
  }
  card.querySelector('.d-notify-btn').disabled = false;
  statusEl.innerHTML = `<div class="submit-status ok">Note enregistrée.</div>`;
}

async function notifyStudent(subId, btn){
  const card = document.getElementById(`sub-${subId}`);
  const statusEl = card.querySelector('.d-grade-status');
  btn.disabled = true;
  btn.textContent = 'Envoi...';

  const { error } = await sb.functions.invoke('send-devoir-notification', { body: { soumission_id: subId } });

  btn.disabled = false;

  if (error){
    let detail = error.message || 'Erreur inconnue.';
    if (error.context && typeof error.context.json === 'function'){
      try { const b = await error.context.json(); if (b?.error) detail = b.error; } catch(e){}
    }
    statusEl.innerHTML = `<div class="submit-status err">Échec : ${escapeHtml(detail)}</div>`;
    btn.textContent = "Notifier l'étudiant";
    return;
  }

  btn.textContent = 'Renvoyer la notification';
  statusEl.innerHTML = `<div class="submit-status ok">Étudiant notifié par email — preuve enregistrée.</div>`;
}

init();
