/* ============================================================
   ARCHITECTURE INTÉRIEURE — articles.js
   Utilise le client Supabase unique créé par supabase-client.js
   (doit être chargé avant ce fichier).
   ============================================================ */

const ARTICLE_BUCKET = 'architecture-interieure';

const articleGrid = document.getElementById('articleGrid');
const articleTabs = document.getElementById('articleTabs');
const articleFilters = document.getElementById('articleFilters');
const mineTab = document.getElementById('mineTab');
const fabAdd = document.getElementById('fabAdd');
const modalOverlay = document.getElementById('modalOverlay');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const articleForm = document.getElementById('articleForm');
const categorySelect = document.getElementById('a-category');
const adminAddCatWrap = document.getElementById('adminAddCatWrap');
const addCatBtn = document.getElementById('addCatBtn');

let currentUser = null;
let currentRole = null;
let categories = [];
let state = {
  tab: 'global',
  categoryId: ''
};

const STATUS_LABELS = {
  brouillon: 'Brouillon',
  soumis: 'En attente',
  valide: 'Validé',
  rejete: 'Rejeté'
};

function escapeHtml(str){
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function truncate(str, n){
  const s = String(str || '');
  return s.length > n ? s.slice(0, n).trim() + '…' : s;
}

async function init(){
  const { data: { session } } = await sb.auth.getSession();

  if (session){
    currentUser = session.user;
    const { data: profile } = await sb.from('profiles').select('role').eq('id', currentUser.id).single();
    currentRole = profile ? profile.role : null;

    mineTab.style.display = 'inline-block';
    if (currentRole && currentRole !== 'visitor'){
      fabAdd.style.display = 'flex';
    }
    if (currentRole === 'admin'){
      adminAddCatWrap.style.display = 'block';
    }
  }

  await loadCategories();
  attachEvents();
  loadArticles();
}

async function loadCategories(){
  const { data, error } = await sb.from('article_categories').select('id, slug, label').order('sort_order', { ascending: true });
  categories = (!error && data) ? data : [];

  const allBtn = articleFilters.querySelector('.gfilter[data-cat=""]');
  articleFilters.innerHTML = '';
  articleFilters.appendChild(allBtn || makeFilterBtn('', 'Tous', true));
  categories.forEach(cat => {
    articleFilters.appendChild(makeFilterBtn(cat.id, cat.label, false));
  });

  categorySelect.innerHTML = `<option value="">Choisis une catégorie</option>` +
    categories.map(c => `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('');
}

function makeFilterBtn(catId, label, active){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gfilter' + (active ? ' active' : '');
  btn.dataset.cat = catId;
  btn.textContent = label;
  return btn;
}

function attachEvents(){
  articleTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.gtab');
    if (!btn || btn.dataset.tab === state.tab) return;
    document.querySelectorAll('#articleTabs .gtab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.tab = btn.dataset.tab;
    loadArticles();
  });

  articleFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.gfilter');
    if (!btn) return;
    document.querySelectorAll('#articleFilters .gfilter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.categoryId = btn.dataset.cat;
    loadArticles();
  });

  fabAdd.addEventListener('click', () => modalOverlay.classList.add('open'));
  modalCloseBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

  addCatBtn.addEventListener('click', handleAddCategory);
  articleForm.addEventListener('submit', handleArticleSubmit);
}

function closeModal(){
  modalOverlay.classList.remove('open');
  articleForm.reset();
  document.getElementById('articleStatus').innerHTML = '';
}

async function handleAddCategory(){
  const input = document.getElementById('a-new-cat');
  const label = input.value.trim();
  if (!label) return;
  const slug = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  addCatBtn.disabled = true;
  const { data, error } = await sb.from('article_categories').insert({ slug, label, sort_order: categories.length }).select().single();
  addCatBtn.disabled = false;

  if (error){
    alert("Impossible d'ajouter la catégorie : " + error.message);
    return;
  }
  input.value = '';
  await loadCategories();
  categorySelect.value = data.id;
}

async function loadArticles(){
  articleGrid.innerHTML = `<div class="empty-state">Chargement...</div>`;

  let query = sb.from('articles').select(`
    id, title, content, cover_image_url, status, created_at, category_id,
    profiles ( full_name, avatar_url ),
    article_categories ( label )
  `);

  if (state.tab === 'mine'){
    if (!currentUser){
      articleGrid.innerHTML = `<div class="empty-state">Connecte-toi pour voir tes articles.</div>`;
      return;
    }
    query = query.eq('author_id', currentUser.id);
  } else {
    query = query.eq('status', 'valide');
  }

  if (state.categoryId){
    query = query.eq('category_id', state.categoryId);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error){
    articleGrid.innerHTML = `<div class="empty-state">Erreur de chargement : ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data || data.length === 0){
    articleGrid.innerHTML = state.tab === 'mine'
      ? `<div class="empty-state">Tu n'as encore rien publié. Utilise le bouton + pour écrire un premier article.</div>`
      : `<div class="empty-state">Communauté naissante — aucun article publié pour l'instant dans cette catégorie.</div>`;
    return;
  }

  articleGrid.innerHTML = data.map(renderCard).join('');
}

function renderCard(article){
  const author = article.profiles || {};
  const authorName = escapeHtml(author.full_name || 'Membre');
  const initial = (author.full_name || '?').trim().charAt(0).toUpperCase() || '?';
  const avatarHtml = author.avatar_url
    ? `<img src="${escapeHtml(author.avatar_url)}" alt="">`
    : `<span>${escapeHtml(initial)}</span>`;
  const coverHtml = article.cover_image_url
    ? `<img src="${escapeHtml(article.cover_image_url)}" class="gc-cover" alt="">`
    : `<div class="gc-cover gc-cover-empty"></div>`;
  const catLabel = article.article_categories ? escapeHtml(article.article_categories.label) : '';

  const statusBadge = state.tab === 'mine'
    ? `<span class="status-badge status-${article.status}">${STATUS_LABELS[article.status] || article.status}</span>`
    : '';

  return `
    <div class="gallery-card">
      ${coverHtml}
      <div class="gc-body">
        <div class="gc-author">
          <div class="gc-avatar">${avatarHtml}</div>
          <span>${authorName}</span>
        </div>
        <div class="gc-title">${escapeHtml(article.title)}</div>
        <p class="gc-summary">${escapeHtml(truncate(article.content, 120))}</p>
        <div class="gc-meta">
          ${catLabel ? `<span class="gc-cat">${catLabel}</span>` : ''}
          ${statusBadge}
        </div>
      </div>
    </div>
  `;
}

async function handleArticleSubmit(e){
  e.preventDefault();
  if (!currentUser){
    window.location.href = 'connexion.html';
    return;
  }

  const btn = document.getElementById('articleSubmitBtn');
  const statusEl = document.getElementById('articleStatus');
  btn.disabled = true;
  btn.textContent = 'Publication...';
  statusEl.innerHTML = '';

  try {
    const title = document.getElementById('a-title').value;
    const categoryId = document.getElementById('a-category').value;
    const content = document.getElementById('a-content').value;
    const fileInput = document.getElementById('a-cover');
    const file = fileInput.files[0];

    if (!categoryId) throw new Error("Choisis une catégorie.");

    let coverUrl = null;
    if (file){
      const ext = file.name.split('.').pop();
      const path = `articles/${currentUser.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await sb.storage.from(ARTICLE_BUCKET).upload(path, file);
      if (uploadError) throw uploadError;
      const { data: publicData } = sb.storage.from(ARTICLE_BUCKET).getPublicUrl(path);
      coverUrl = publicData.publicUrl;
    }

    const { error: insertError } = await sb.from('articles').insert({
      author_id: currentUser.id,
      title,
      content,
      category_id: categoryId,
      cover_image_url: coverUrl
    });
    if (insertError) throw insertError;

    statusEl.innerHTML = `<div class="submit-status ok">Article envoyé, en attente de validation.</div>`;
    articleForm.reset();

    setTimeout(() => {
      closeModal();
      document.querySelector('#articleTabs .gtab[data-tab="mine"]').click();
    }, 900);

  } catch (err){
    statusEl.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publier';
  }
}

init();
