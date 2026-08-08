/* ============================================================
   ARCHITECTURE INTÉRIEURE — tableau-de-bord.js
   Sections : Paramètres (lien), Mon activité (student/teacher/admin),
   Statistiques (admin), Validation (admin+teacher),
   Utilisateurs (admin+teacher, rôle éditable admin only).
   Utilise le client Supabase unique créé par supabase-client.js.
   ============================================================ */

const ROLE_LABELS = { student: 'étudiant', teacher: 'enseignant', admin: 'administrateur', visitor: 'visiteur' };
const STATUS_LABELS = { brouillon: 'Brouillon', soumis: 'En attente', valide: 'Validé', rejete: 'Rejeté' };

let SESSION = null;
let CURRENT_ROLE = null;
const dashWrap = document.getElementById('dashWrap');

function escapeHtml(str){
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function init(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session){ window.location.href = 'connexion.html'; return; }
  SESSION = session;

  const { data: profile } = await sb.from('profiles').select('full_name, role').eq('id', session.user.id).single();
  const fullName = profile ? profile.full_name : session.user.email;
  CURRENT_ROLE = profile ? profile.role : 'student';

  renderShell(fullName, CURRENT_ROLE);

  if (CURRENT_ROLE !== 'visitor'){
    document.getElementById('dashActivity').style.display = 'block';
    loadActivity();
  }

  if (CURRENT_ROLE === 'admin'){
    document.getElementById('dashStats').style.display = 'block';
    loadStats();
  }

  if (CURRENT_ROLE === 'admin' || CURRENT_ROLE === 'teacher'){
    document.getElementById('dashValidation').style.display = 'block';
    document.getElementById('dashUsers').style.display = 'block';
    loadValidation();
    loadUsers();
  }

  if (CURRENT_ROLE === 'admin'){
    document.getElementById('dashSchools').style.display = 'block';
    document.getElementById('schoolAddForm').addEventListener('submit', addSchool);
    loadSchools();
  }
}

function renderShell(fullName, role){
  dashWrap.innerHTML = `
    <div class="dash-settings-toolbar">
      <a href="parametres.html" class="dash-settings-btn">Paramètres</a>
    </div>

    <div class="dash-header">
      <div>
        <h1>Bonjour, ${escapeHtml(fullName)}</h1>
        <p class="dash-sub-role">Connecté en tant que ${ROLE_LABELS[role] || role}</p>
      </div>
      <span class="role-pill role-${role}">${ROLE_LABELS[role] || role}</span>
    </div>

    <div id="dashActivity" class="dash-section" style="display:none;">
      <div class="section-label"><span>Mon activité</span></div>
      <div class="dash-activity-grid" id="dashActivityGrid">
        <div class="empty-state">Chargement...</div>
      </div>
    </div>

    <div id="dashStats" class="dash-section" style="display:none;">
      <div class="section-label"><span>Statistiques</span></div>
      <div class="dash-stats-cards">
        <div class="dash-stat-card"><span id="statMembersD">0</span><small>membres</small></div>
        <div class="dash-stat-card"><span id="statPendingD">0</span><small>en attente</small></div>
      </div>
      <canvas id="dashStatsChart" height="180"></canvas>
      <button type="button" class="btn-primary" id="btnRapport" style="margin-top:16px;">Envoyer un rapport</button>
      <div id="rapportMsg"></div>
    </div>

    <div id="dashValidation" class="dash-section" style="display:none;">
      <div class="section-label"><span>Validation</span></div>
      <p class="dash-hint">Projets et articles en attente de validation.</p>
      <div id="dashValidationList"><div class="empty-state">Chargement...</div></div>
    </div>

    <div id="dashUsers" class="dash-section" style="display:none;">
      <div class="section-label"><span>Utilisateurs</span></div>
      <div id="dashUsersList"><div class="empty-state">Chargement...</div></div>
    </div>

    <div id="dashSchools" class="dash-section" style="display:none;">
      <div class="section-label"><span>Écoles</span></div>
      <form id="schoolAddForm" class="dash-inline-form">
        <input type="text" id="newSchoolName" placeholder="Nom de la nouvelle école" required>
        <button type="submit" class="btn-secondary-small">Ajouter</button>
      </form>
      <div id="dashSchoolsList"><div class="empty-state">Chargement...</div></div>
    </div>
  `;

  document.getElementById('btnRapport').addEventListener('click', sendReport);
}

/* ------------------------------------------------------------
   Mon activité — compteurs personnels
------------------------------------------------------------ */
async function loadActivity(){
  const grid = document.getElementById('dashActivityGrid');

  const [projRes, artRes] = await Promise.all([
    sb.from('galerie').select('id', { count: 'exact', head: true }).eq('user_id', SESSION.user.id),
    sb.from('articles').select('id', { count: 'exact', head: true }).eq('author_id', SESSION.user.id)
  ]);

  grid.innerHTML = `
    <a href="galerie.html?tab=mine" class="dash-activity-card">
      <span class="dash-activity-num">${projRes.count || 0}</span>
      <span class="dash-activity-label">Mes projets</span>
    </a>
    <a href="articles.html?tab=mine" class="dash-activity-card">
      <span class="dash-activity-num">${artRes.count || 0}</span>
      <span class="dash-activity-label">Mes articles</span>
    </a>
    <a href="forum.html" class="dash-activity-card">
      <span class="dash-activity-num">&rarr;</span>
      <span class="dash-activity-label">Forum</span>
    </a>
    <a href="devoirs.html" class="dash-activity-card">
      <span class="dash-activity-num">&rarr;</span>
      <span class="dash-activity-label">Devoirs</span>
    </a>
  `;
}

/* ------------------------------------------------------------
   Statistiques — admin uniquement
------------------------------------------------------------ */
async function loadStats(){
  const { count: memberCount } = await sb.from('profiles').select('id', { count: 'exact', head: true });
  document.getElementById('statMembersD').textContent = memberCount || 0;

  const [galerieRes, articlesRes] = await Promise.all([
    sb.from('galerie').select('status'),
    sb.from('articles').select('status')
  ]);

  const galerie = galerieRes.data || [];
  const articles = articlesRes.data || [];

  const statuses = ['brouillon', 'soumis', 'valide', 'rejete'];
  const galerieCounts = statuses.map(s => galerie.filter(p => p.status === s).length);
  const articlesCounts = statuses.map(s => articles.filter(a => a.status === s).length);

  const pending = galerieCounts[1] + articlesCounts[1];
  document.getElementById('statPendingD').textContent = pending;

  new Chart(document.getElementById('dashStatsChart'), {
    type: 'bar',
    data: {
      labels: statuses.map(s => STATUS_LABELS[s]),
      datasets: [
        { label: 'Projets', data: galerieCounts, backgroundColor: '#6B3423', borderRadius: 3 },
        { label: 'Articles', data: articlesCounts, backgroundColor: '#D8CFBE', borderRadius: 3 }
      ]
    },
    options: {
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } }
    }
  });

  sb.channel('dash-stats-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'galerie' }, () => loadStats())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'articles' }, () => loadStats())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => loadStats())
    .subscribe();
}

async function sendReport(){
  const btn = document.getElementById('btnRapport');
  const msg = document.getElementById('rapportMsg');
  btn.disabled = true;
  btn.textContent = 'Envoi...';
  msg.innerHTML = '';

  const { error } = await sb.functions.invoke('send-dashboard-report');

  btn.disabled = false;
  btn.textContent = 'Envoyer un rapport';

  if (error){
    let detail = error.message || 'Erreur inconnue.';
    if (error.context && typeof error.context.json === 'function'){
      try { const body = await error.context.json(); if (body?.error) detail = body.error; } catch(e){}
    }
    msg.innerHTML = `<div class="submit-status err">Échec de l'envoi : ${escapeHtml(detail)}</div>`;
    return;
  }
  msg.innerHTML = `<div class="submit-status ok">Rapport envoyé par email.</div>`;
}

/* ------------------------------------------------------------
   Validation — admin + teacher : projets et articles "soumis"
------------------------------------------------------------ */
async function loadValidation(){
  const list = document.getElementById('dashValidationList');

  const [projRes, artRes] = await Promise.all([
    sb.from('galerie').select('id, title, created_at, profiles(full_name)').eq('status', 'soumis').order('created_at', { ascending: true }),
    sb.from('articles').select('id, title, created_at, profiles(full_name)').eq('status', 'soumis').order('created_at', { ascending: true })
  ]);

  const projects = (projRes.data || []).map(p => ({ ...p, kind: 'galerie' }));
  const articles = (artRes.data || []).map(a => ({ ...a, kind: 'articles' }));
  const items = [...projects, ...articles].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (items.length === 0){
    list.innerHTML = `<div class="empty-state">Rien en attente de validation.</div>`;
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="dash-row" id="val-${item.kind}-${item.id}">
      <div>
        <span class="dash-row-titre">${escapeHtml(item.title)}</span>
        <span class="dash-row-meta">${item.kind === 'galerie' ? 'Projet' : 'Article'} · ${item.profiles?.full_name || '—'}</span>
      </div>
      <div class="dash-row-actions">
        <button type="button" class="btn-secondary-small" data-action="valide" data-kind="${item.kind}" data-id="${item.id}">Valider</button>
        <button type="button" class="btn-secondary-small btn-reject" data-action="rejete" data-kind="${item.kind}" data-id="${item.id}">Rejeter</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => moderateItem(btn.dataset.kind, btn.dataset.id, btn.dataset.action));
  });
}

async function moderateItem(kind, id, newStatus){
  const { error } = await sb.from(kind).update({ status: newStatus }).eq('id', id);
  if (error){ alert("Échec : " + error.message); return; }
  const row = document.getElementById(`val-${kind}-${id}`);
  if (row) row.remove();
}

/* ------------------------------------------------------------
   Utilisateurs — admin + teacher (rôle éditable admin only)
------------------------------------------------------------ */
async function loadUsers(){
  const list = document.getElementById('dashUsersList');
  const { data: users, error } = await sb.from('profiles').select('id, full_name, role, created_at').order('created_at', { ascending: false });

  if (error || !users || users.length === 0){
    list.innerHTML = `<div class="empty-state">Aucun inscrit.</div>`;
    return;
  }

  const canEditRoles = CURRENT_ROLE === 'admin';

  list.innerHTML = users.map(u => {
    if (canEditRoles){
      return `<div class="dash-row">
        <span class="dash-row-titre">${escapeHtml(u.full_name || 'Sans nom')}</span>
        <select class="dash-role-select" data-id="${u.id}">
          <option value="student" ${u.role === 'student' ? 'selected' : ''}>student</option>
          <option value="teacher" ${u.role === 'teacher' ? 'selected' : ''}>teacher</option>
          <option value="visitor" ${u.role === 'visitor' ? 'selected' : ''}>visitor</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
        </select>
        <span class="dash-role-status" data-statut></span>
      </div>`;
    }
    return `<div class="dash-row">
      <span class="dash-row-titre">${escapeHtml(u.full_name || 'Sans nom')}</span>
      <span class="dash-row-meta" style="font-style:italic;">${escapeHtml(u.role)}</span>
    </div>`;
  }).join('');

  if (!canEditRoles) return;

  document.querySelectorAll('.dash-role-select').forEach(select => {
    select.addEventListener('change', async () => {
      const id = select.getAttribute('data-id');
      const statusEl = select.parentElement.querySelector('[data-statut]');
      statusEl.textContent = '...';
      const { error } = await sb.from('profiles').update({ role: select.value }).eq('id', id);
      statusEl.textContent = error ? 'Échec' : 'OK';
      statusEl.style.color = error ? '#a3341f' : '#2F5A2A';
    });
  });
}

/* ------------------------------------------------------------
   Écoles — admin uniquement
------------------------------------------------------------ */
async function loadSchools(){
  const list = document.getElementById('dashSchoolsList');
  const { data: schools, error } = await sb.from('schools').select('id, name, is_active').order('name');

  if (error || !schools || schools.length === 0){
    list.innerHTML = `<div class="empty-state">Aucune école enregistrée.</div>`;
    return;
  }

  list.innerHTML = schools.map(s => `
    <div class="dash-row">
      <span class="dash-row-titre">${escapeHtml(s.name)}</span>
      <label class="school-toggle">
        <input type="checkbox" class="school-active-toggle" data-id="${s.id}" ${s.is_active ? 'checked' : ''}>
        Active
      </label>
    </div>
  `).join('');

  list.querySelectorAll('.school-active-toggle').forEach(cb => {
    cb.addEventListener('change', async () => {
      const { error } = await sb.from('schools').update({ is_active: cb.checked }).eq('id', cb.dataset.id);
      if (error) alert(error.message);
    });
  });
}

async function addSchool(e){
  e.preventDefault();
  const input = document.getElementById('newSchoolName');
  const name = input.value.trim();
  if (!name) return;

  const { error } = await sb.from('schools').insert({ name, is_active: true });
  if (error){ alert(error.message); return; }
  input.value = '';
  loadSchools();
}

init();
