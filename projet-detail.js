/* ============================================================
   ARCHITECTURE INTÉRIEURE — projet-detail.js
   Utilise le client Supabase unique créé par supabase-client.js.
   ============================================================ */

const CATEGORY_LABELS = { residentiel: 'Résidentiel', patrimoine: 'Patrimoine', mobilier: 'Mobilier' };

let currentUser = null;
let projetId = null;
let hasLiked = false;
let likeRowId = null;

function escapeHtml(str){
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(iso){
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function init(){
  const params = new URLSearchParams(window.location.search);
  projetId = params.get('id');
  if (!projetId){ window.location.href = 'galerie.html'; return; }

  const { data: { session } } = await sb.auth.getSession();
  if (session) currentUser = session.user;

  const { data: project, error } = await sb.from('galerie')
    .select('id, title, description, category, cover_image_url, status, created_at, user_id, profiles ( full_name, avatar_url )')
    .eq('id', projetId)
    .single();

  if (error || !project){
    document.getElementById('projetGuardMsg').textContent = 'Ce projet est introuvable ou pas encore validé.';
    return;
  }

  document.getElementById('projetGuardMsg').style.display = 'none';
  document.getElementById('projetContent').style.display = 'block';
  document.title = project.title + ' — Galerie — Architecture Intérieure';
  document.getElementById('projetFil').textContent = project.title;

  const { data: images } = await sb.from('project_images').select('image_url, caption').eq('project_id', projetId).order('position', { ascending: true });

  const author = project.profiles || {};
  const authorName = escapeHtml(author.full_name || 'Membre');
  const initial = (author.full_name || '?').trim().charAt(0).toUpperCase() || '?';
  const avatarHtml = author.avatar_url ? `<img src="${escapeHtml(author.avatar_url)}" alt="">` : `<span>${escapeHtml(initial)}</span>`;

  const galleryHtml = (images && images.length > 0)
    ? `<div class="projet-image-strip">${images.map(img => `<img src="${escapeHtml(img.image_url)}" alt="${escapeHtml(img.caption || '')}">`).join('')}</div>`
    : '';

  document.getElementById('projetDetail').innerHTML = `
    ${project.cover_image_url ? `<img src="${escapeHtml(project.cover_image_url)}" class="projet-cover">` : ''}
    ${galleryHtml}
    <span class="gc-cat" style="display:block; margin-top:20px;">${CATEGORY_LABELS[project.category] || project.category}</span>
    <h1 class="forum-detail-title">${escapeHtml(project.title)}</h1>
    <div class="gc-author" style="margin:14px 0;">
      <div class="gc-avatar">${avatarHtml}</div>
      <span>${authorName} · ${formatDate(project.created_at)}</span>
    </div>
    <div class="forum-detail-content">${escapeHtml(project.description).replace(/\n/g, '<br>')}</div>
  `;

  if (currentUser){
    document.getElementById('commentForm').style.display = 'block';
    document.getElementById('commentGuestMsg').style.display = 'none';
  } else {
    document.getElementById('commentGuestMsg').style.display = 'block';
  }

  document.getElementById('likeBtn').addEventListener('click', toggleLike);
  document.getElementById('commentSubmitBtn').addEventListener('click', postComment);

  loadLikes();
  loadComments();
}

async function loadLikes(){
  const { count } = await sb.from('project_likes').select('id', { count: 'exact', head: true }).eq('project_id', projetId);
  document.getElementById('likeCount').textContent = count || 0;

  if (!currentUser) return;
  const { data: mine } = await sb.from('project_likes').select('id').eq('project_id', projetId).eq('user_id', currentUser.id).maybeSingle();
  if (mine){
    hasLiked = true;
    likeRowId = mine.id;
    document.getElementById('likeBtn').classList.add('active');
    document.getElementById('likeBtn').innerHTML = `♥ J'aime (<span id="likeCount">${count || 0}</span>)`;
  }
}

async function toggleLike(){
  if (!currentUser){ window.location.href = 'connexion.html'; return; }
  const btn = document.getElementById('likeBtn');
  btn.disabled = true;

  if (hasLiked){
    const { error } = await sb.from('project_likes').delete().eq('id', likeRowId);
    if (!error){ hasLiked = false; likeRowId = null; btn.classList.remove('active'); }
  } else {
    const { data, error } = await sb.from('project_likes').insert({ project_id: projetId, user_id: currentUser.id }).select().single();
    if (!error){ hasLiked = true; likeRowId = data.id; btn.classList.add('active'); }
  }

  btn.disabled = false;
  loadLikes();
}

async function loadComments(){
  const list = document.getElementById('commentsList');
  const { data: comments, error } = await sb.from('project_comments')
    .select('id, content, created_at, profiles ( full_name )')
    .eq('project_id', projetId)
    .order('created_at', { ascending: true });

  document.getElementById('commentsCount').textContent = (comments ? comments.length : 0) + ' commentaire' + (comments && comments.length > 1 ? 's' : '');

  if (error || !comments || comments.length === 0){
    list.innerHTML = `<div class="empty-state">Aucun commentaire pour l'instant.</div>`;
    return;
  }

  list.innerHTML = comments.map(c => `
    <div class="forum-reply-card">
      <div class="forum-topic-meta">${c.profiles ? escapeHtml(c.profiles.full_name) : '—'} · ${formatDate(c.created_at)}</div>
      <div class="forum-reply-content">${escapeHtml(c.content).replace(/\n/g, '<br>')}</div>
    </div>
  `).join('');
}

async function postComment(){
  if (!currentUser){ window.location.href = 'connexion.html'; return; }
  const textarea = document.getElementById('commentText');
  const content = textarea.value.trim();
  const statusEl = document.getElementById('commentStatus');
  if (!content){
    statusEl.innerHTML = `<div class="submit-status err">Écris un commentaire avant d'envoyer.</div>`;
    return;
  }

  const btn = document.getElementById('commentSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Envoi...';

  const { error } = await sb.from('project_comments').insert({ project_id: projetId, user_id: currentUser.id, content });

  btn.disabled = false;
  btn.textContent = 'Commenter';

  if (error){
    statusEl.innerHTML = `<div class="submit-status err">${escapeHtml(error.message)}</div>`;
    return;
  }
  textarea.value = '';
  statusEl.innerHTML = '';
  loadComments();
}

init();
