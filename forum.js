/* ============================================================
   ARCHITECTURE INTÉRIEURE — forum.js (liste des sujets)
   Réservé aux connectés dont le rôle est student/teacher/admin
   (les comptes "visitor" n'y ont pas accès).
   Utilise le client Supabase unique créé par supabase-client.js.
   ============================================================ */

const CAT_LABELS = { questions: 'Questions', projets: 'Projets', ressources: 'Ressources', entraide: 'Entraide', annonces: 'Annonces' };

let currentUser = null;
let currentCategory = '';

const guardMsg = document.getElementById('forumGuardMsg');
const forumContent = document.getElementById('forumContent');
const topicsList = document.getElementById('forumTopicsList');
const fabAdd = document.getElementById('fabAdd');
const modalOverlay = document.getElementById('modalOverlay');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const topicForm = document.getElementById('topicForm');

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
  const role = profile ? profile.role : null;

  if (!role || role === 'visitor'){
    guardMsg.textContent = "Le forum est réservé aux étudiants et enseignants. Ton compte n'y a pas encore accès.";
    setTimeout(() => window.location.href = 'tableau-de-bord.html', 2200);
    return;
  }

  guardMsg.style.display = 'none';
  forumContent.style.display = 'block';
  fabAdd.style.display = 'flex';

  attachEvents();
  loadTopics();
}

function attachEvents(){
  document.getElementById('forumCategories').addEventListener('click', (e) => {
    const btn = e.target.closest('.gfilter');
    if (!btn) return;
    document.querySelectorAll('#forumCategories .gfilter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.cat;
    loadTopics();
  });

  fabAdd.addEventListener('click', () => {
    document.getElementById('t-category').value = currentCategory || 'questions';
    modalOverlay.classList.add('open');
  });
  modalCloseBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

  topicForm.addEventListener('submit', handleTopicSubmit);
}

function closeModal(){
  modalOverlay.classList.remove('open');
  topicForm.reset();
  document.getElementById('topicStatus').innerHTML = '';
}

async function loadTopics(){
  topicsList.innerHTML = `<div class="empty-state">Chargement...</div>`;

  let query = sb.from('forum_topics')
    .select('id, title, category, status, created_at, profiles ( full_name )')
    .order('created_at', { ascending: false });
  if (currentCategory) query = query.eq('category', currentCategory);

  const { data, error } = await query;

  if (error){
    topicsList.innerHTML = `<div class="empty-state">Erreur de chargement : ${escapeHtml(error.message)}</div>`;
    return;
  }

  const topics = data || [];
  if (topics.length === 0){
    topicsList.innerHTML = `<div class="empty-state">Aucun sujet pour le moment — sois le premier à en ouvrir un.</div>`;
    return;
  }

  const counts = {};
  await Promise.all(topics.map(async (t) => {
    const { count } = await sb.from('forum_replies').select('id', { count: 'exact', head: true }).eq('topic_id', t.id);
    counts[t.id] = count || 0;
  }));

  topicsList.innerHTML = topics.map(t => {
    const author = t.profiles ? escapeHtml(t.profiles.full_name) : '—';
    const resolved = t.status === 'resolved';
    const replyCount = counts[t.id] || 0;
    return `
      <a href="forum-sujet.html?id=${t.id}" class="forum-topic-row${resolved ? ' resolved' : ''}">
        <div class="forum-topic-main">
          <span class="forum-topic-cat">${CAT_LABELS[t.category] || t.category}</span>
          ${resolved ? '<span class="forum-topic-resolved">Résolu</span>' : ''}
          <h3 class="forum-topic-title">${escapeHtml(t.title)}</h3>
          <div class="forum-topic-meta">${author} · ${formatDate(t.created_at)} · ${replyCount} réponse${replyCount > 1 ? 's' : ''}</div>
        </div>
      </a>
    `;
  }).join('');
}

async function handleTopicSubmit(e){
  e.preventDefault();
  const btn = document.getElementById('topicSubmitBtn');
  const statusEl = document.getElementById('topicStatus');
  btn.disabled = true;
  btn.textContent = 'Publication...';
  statusEl.innerHTML = '';

  try {
    const title = document.getElementById('t-title').value;
    const category = document.getElementById('t-category').value;
    const content = document.getElementById('t-content').value;

    const { data, error } = await sb.from('forum_topics').insert({
      title, content, category, author_id: currentUser.id, status: 'open'
    }).select().single();
    if (error) throw error;

    window.location.href = 'forum-sujet.html?id=' + data.id;

  } catch (err){
    statusEl.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
    btn.disabled = false;
    btn.textContent = 'Publier';
  }
}

init();
