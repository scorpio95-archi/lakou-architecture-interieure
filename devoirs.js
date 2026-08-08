/* ============================================================
   ARCHITECTURE INTÉRIEURE — devoirs.js (liste)
   Réservé aux connectés student/teacher/admin.
   ============================================================ */

let currentUser = null;
let currentRole = null;

const guardMsg = document.getElementById('devoirsGuardMsg');
const content = document.getElementById('devoirsContent');
const list = document.getElementById('devoirsList');
const fabAdd = document.getElementById('fabAdd');
const modalOverlay = document.getElementById('modalOverlay');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const devoirForm = document.getElementById('devoirForm');

function escapeHtml(str){
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(iso){
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function init(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session){
    guardMsg.textContent = 'Connexion requise. Redirection...';
    setTimeout(() => window.location.href = 'connexion.html', 1200);
    return;
  }
  currentUser = session.user;

  const { data: profile } = await sb.from('profiles').select('role').eq('id', currentUser.id).single();
  currentRole = profile ? profile.role : null;

  if (!currentRole || currentRole === 'visitor'){
    guardMsg.textContent = "Les devoirs sont réservés aux étudiants et enseignants.";
    setTimeout(() => window.location.href = 'tableau-de-bord.html', 2200);
    return;
  }

  guardMsg.style.display = 'none';
  content.style.display = 'block';

  if (currentRole === 'teacher' || currentRole === 'admin'){
    fabAdd.style.display = 'flex';
  }

  attachEvents();
  loadDevoirs();
}

function attachEvents(){
  fabAdd.addEventListener('click', () => modalOverlay.classList.add('open'));
  modalCloseBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  devoirForm.addEventListener('submit', handleDevoirSubmit);
}

function closeModal(){
  modalOverlay.classList.remove('open');
  devoirForm.reset();
  document.getElementById('devoirStatus').innerHTML = '';
}

async function loadDevoirs(){
  list.innerHTML = `<div class="empty-state">Chargement...</div>`;

  const { data: devoirs, error } = await sb.from('devoirs')
    .select('id, title, due_date, created_at, profiles ( full_name )')
    .order('created_at', { ascending: false });

  if (error){
    list.innerHTML = `<div class="empty-state">Erreur de chargement : ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!devoirs || devoirs.length === 0){
    list.innerHTML = `<div class="empty-state">Aucun devoir pour l'instant.</div>`;
    return;
  }

  const isStaff = currentRole === 'teacher' || currentRole === 'admin';

  if (isStaff){
    const counts = {};
    await Promise.all(devoirs.map(async (d) => {
      const { count } = await sb.from('devoir_soumissions').select('id', { count: 'exact', head: true }).eq('devoir_id', d.id);
      counts[d.id] = count || 0;
    }));

    list.innerHTML = devoirs.map(d => `
      <a href="devoir-detail.html?id=${d.id}" class="forum-topic-row">
        <div class="forum-topic-main">
          <h3 class="forum-topic-title">${escapeHtml(d.title)}</h3>
          <div class="forum-topic-meta">${d.due_date ? 'Limite : ' + formatDate(d.due_date) + ' · ' : ''}${counts[d.id]} rendu${counts[d.id] > 1 ? 's' : ''}</div>
        </div>
      </a>
    `).join('');
    return;
  }

  const { data: mine } = await sb.from('devoir_soumissions').select('devoir_id, note, graded_at').eq('student_id', currentUser.id);
  const mineMap = {};
  (mine || []).forEach(s => { mineMap[s.devoir_id] = s; });

  list.innerHTML = devoirs.map(d => {
    const sub = mineMap[d.id];
    let statusLabel = 'Non rendu';
    if (sub && sub.graded_at) statusLabel = `Noté : ${sub.note}/20`;
    else if (sub) statusLabel = 'Rendu — en attente de correction';

    return `
      <a href="devoir-detail.html?id=${d.id}" class="forum-topic-row">
        <div class="forum-topic-main">
          <h3 class="forum-topic-title">${escapeHtml(d.title)}</h3>
          <div class="forum-topic-meta">${d.due_date ? 'Limite : ' + formatDate(d.due_date) + ' · ' : ''}${statusLabel}</div>
        </div>
      </a>
    `;
  }).join('');
}

async function handleDevoirSubmit(e){
  e.preventDefault();
  const btn = document.getElementById('devoirSubmitBtn');
  const statusEl = document.getElementById('devoirStatus');
  btn.disabled = true;
  btn.textContent = 'Publication...';
  statusEl.innerHTML = '';

  try {
    const title = document.getElementById('d-title').value;
    const instructions = document.getElementById('d-instructions').value;
    const dueRaw = document.getElementById('d-due').value;
    const due_date = dueRaw ? new Date(dueRaw + 'T23:59:00').toISOString() : null;

    const { error } = await sb.from('devoirs').insert({ title, instructions, due_date, created_by: currentUser.id });
    if (error) throw error;

    closeModal();
    loadDevoirs();

  } catch (err){
    statusEl.innerHTML = `<div class="submit-status err">${escapeHtml(err.message || String(err))}</div>`;
    btn.disabled = false;
    btn.textContent = 'Publier';
  }
}

init();
