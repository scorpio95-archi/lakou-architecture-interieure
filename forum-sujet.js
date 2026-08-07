/* ============================================================
   ARCHITECTURE INTÉRIEURE — forum-sujet.js (détail d'un sujet)
   Utilise le client Supabase unique créé par supabase-client.js.
   ============================================================ */

const CAT_LABELS = { questions: 'Questions', projets: 'Projets', ressources: 'Ressources', entraide: 'Entraide', annonces: 'Annonces' };

let currentUser = null;
let currentRole = null;
let topicId = null;
let topicData = null;
let repliesCache = [];
let votesCache = [];

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
  topicId = params.get('id');
  if (!topicId){ window.location.href = 'forum.html'; return; }

  const { data: { session } } = await sb.auth.getSession();
  if (!session){ window.location.href = 'connexion.html'; return; }
  currentUser = session.user;

  const { data: profile } = await sb.from('profiles').select('role').eq('id', currentUser.id).single();
  currentRole = profile ? profile.role : null;
  if (!currentRole || currentRole === 'visitor'){
    window.location.href = 'tableau-de-bord.html';
    return;
  }

  document.getElementById('replySubmitBtn').addEventListener('click', doPostReply);

  await loadTopic();
}

async function loadTopic(){
  const { data, error } = await sb.from('forum_topics')
    .select('id, title, content, category, status, created_at, profiles ( full_name )')
    .eq('id', topicId)
    .single();

  if (error || !data){
    document.getElementById('sujetGuardMsg').textContent = 'Ce sujet est introuvable ou inaccessible.';
    return;
  }
  topicData = data;

  document.getElementById('sujetGuardMsg').style.display = 'none';
  document.getElementById('sujetContent').style.display = 'block';
  document.title = topicData.title + ' — Forum — Architecture Intérieure';
  document.getElementById('sujetFil').textContent = topicData.title;

  renderTopic();
  renderResolveBar();
  await loadReplies();
}

function renderTopic(){
  const t = topicData;
  const author = t.profiles ? escapeHtml(t.profiles.full_name) : '—';
  const resolved = t.status === 'resolved';

  document.getElementById('forumTopicDetail').innerHTML = `
    <span class="forum-topic-cat">${CAT_LABELS[t.category] || t.category}</span>
    ${resolved ? '<span class="forum-topic-resolved">Résolu</span>' : ''}
    <h1 class="forum-detail-title">${escapeHtml(t.title)}</h1>
    <div class="forum-topic-meta">${author} · ${formatDate(t.created_at)}</div>
    <div class="forum-detail-content">${escapeHtml(t.content).replace(/\n/g, '<br>')}</div>
  `;

  document.getElementById('forumReplyForm').style.display = resolved ? 'none' : 'block';
  document.getElementById('forumLockedMsg').style.display = resolved ? 'block' : 'none';
}

function renderResolveBar(){
  const bar = document.getElementById('adminResolveBar');
  if (currentRole !== 'admin'){ bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  const resolved = topicData.status === 'resolved';
  bar.innerHTML = `<button type="button" class="btn-secondary-small" id="toggleResolveBtn">${resolved ? 'Rouvrir le sujet' : 'Marquer comme résolu'}</button>`;
  document.getElementById('toggleResolveBtn').addEventListener('click', toggleResolved);
}

async function toggleResolved(){
  const newStatus = topicData.status === 'resolved' ? 'open' : 'resolved';
  const { error } = await sb.from('forum_topics').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', topicId);
  if (error){ alert(error.message); return; }
  topicData.status = newStatus;
  renderTopic();
  renderResolveBar();
}

async function loadReplies(){
  const list = document.getElementById('forumRepliesList');
  list.innerHTML = `<div class="empty-state">Chargement des réponses...</div>`;

  const { data, error } = await sb.from('forum_replies')
    .select('id, content, created_at, profiles ( full_name )')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true });

  repliesCache = data || [];
  document.getElementById('forumRepliesCount').textContent = repliesCache.length + ' réponse' + (repliesCache.length > 1 ? 's' : '');

  if (error){
    list.innerHTML = `<div class="empty-state">Erreur de chargement.</div>`;
    return;
  }

  if (repliesCache.length === 0){
    votesCache = [];
    list.innerHTML = `<div class="empty-state">Aucune réponse pour le moment.</div>`;
    return;
  }

  const replyIds = repliesCache.map(r => r.id);
  const votesRes = await sb.from('forum_reply_votes').select('*').in('reply_id', replyIds);
  votesCache = votesRes.data || [];

  renderReplies();
}

function renderReplies(){
  const list = document.getElementById('forumRepliesList');
  list.innerHTML = repliesCache.map(r => {
    const author = r.profiles ? escapeHtml(r.profiles.full_name) : '—';
    const replyVotes = votesCache.filter(v => v.reply_id === r.id);
    const usefulCount = replyVotes.filter(v => v.vote_type === 'useful').length;
    const notRelevantCount = replyVotes.filter(v => v.vote_type === 'not_relevant').length;
    const myVote = replyVotes.find(v => v.user_id === currentUser.id);

    return `
      <div class="forum-reply-card">
        <div class="forum-topic-meta">${author} · ${formatDate(r.created_at)}</div>
        <div class="forum-reply-content">${escapeHtml(r.content).replace(/\n/g, '<br>')}</div>
        <div class="forum-vote-row">
          <button type="button" class="forum-vote-btn${myVote && myVote.vote_type === 'useful' ? ' active' : ''}" data-reply="${r.id}" data-vote="useful">Utile (${usefulCount})</button>
          <button type="button" class="forum-vote-btn${myVote && myVote.vote_type === 'not_relevant' ? ' active' : ''}" data-reply="${r.id}" data-vote="not_relevant">Non pertinent (${notRelevantCount})</button>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.forum-vote-btn').forEach(btn => {
    btn.addEventListener('click', () => doVote(btn.dataset.reply, btn.dataset.vote));
  });
}

async function doVote(replyId, type){
  const existing = votesCache.find(v => v.reply_id === replyId && v.user_id === currentUser.id);

  if (existing && existing.vote_type === type){
    const { error } = await sb.from('forum_reply_votes').delete().eq('id', existing.id);
    if (error){ alert(error.message); return; }
    votesCache = votesCache.filter(v => v.id !== existing.id);
  } else if (existing){
    const { error } = await sb.from('forum_reply_votes').update({ vote_type: type }).eq('id', existing.id);
    if (error){ alert(error.message); return; }
    existing.vote_type = type;
  } else {
    const { data, error } = await sb.from('forum_reply_votes').insert({ reply_id: replyId, user_id: currentUser.id, vote_type: type }).select().single();
    if (error){ alert(error.message); return; }
    votesCache.push(data);
  }
  renderReplies();
}

async function doPostReply(){
  const textarea = document.getElementById('replyContent');
  const content = textarea.value.trim();
  const statusEl = document.getElementById('replyStatus');
  if (!content){
    statusEl.innerHTML = `<div class="submit-status err">Écris une réponse avant d'envoyer.</div>`;
    return;
  }

  const btn = document.getElementById('replySubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Envoi...';
  statusEl.innerHTML = '';

  const { error } = await sb.from('forum_replies').insert({ topic_id: topicId, content, author_id: currentUser.id });

  btn.disabled = false;
  btn.textContent = 'Répondre';

  if (error){
    statusEl.innerHTML = `<div class="submit-status err">${escapeHtml(error.message)}</div>`;
    return;
  }

  textarea.value = '';
  loadReplies();
}

init();
