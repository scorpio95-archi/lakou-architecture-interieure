/* ============================================================
   ARCHITECTURE INTÉRIEURE — galerie.js
   Utilise le client Supabase unique créé par supabase-client.js
   (doit être chargé avant ce fichier).
   ============================================================ */

const PROJECT_BUCKET = 'architecture-interieure';

const galleryGrid = document.getElementById('galleryGrid');
const galleryTabs = document.getElementById('galleryTabs');
const galleryFilters = document.getElementById('galleryFilters');
const mineTab = document.getElementById('mineTab');
const fabAdd = document.getElementById('fabAdd');
const modalOverlay = document.getElementById('modalOverlay');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const projectForm = document.getElementById('projectForm');

let currentUser = null;
let currentRole = null;
let state = {
  tab: 'global',
  category: 'all'
};

const CATEGORY_LABELS = {
  residentiel: 'Résidentiel',
  patrimoine: 'Patrimoine',
  mobilier: 'Mobilier'
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
  }

  // Catégorie pré-sélectionnée via ?type= (liens venus de l'accueil / menu)
  const params = new URLSearchParams(window.location.search);
  const typeParam = params.get('type');
  if (typeParam && CATEGORY_LABELS[typeParam]){
    state.category = typeParam;
    document.querySelectorAll('.gfilter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === typeParam);
    });
  } else {
    document.querySelector('.gfilter[data-cat="all"]').classList.add('active');
  }

  attachEvents();
  loadProjects();
}

function attachEvents(){
  galleryTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.gtab');
    if (!btn) return;
    if (btn.dataset.tab === state.tab) return;
    document.querySelectorAll('.gtab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.tab = btn.dataset.tab;
    loadProjects();
  });

  galleryFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.gfilter');
    if (!btn) return;
    document.querySelectorAll('.gfilter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.category = btn.dataset.cat;
    loadProjects();
  });

  fabAdd.addEventListener('click', () => {
    modalOverlay.classList.add('open');
  });
  modalCloseBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  projectForm.addEventListener('submit', handleProjectSubmit);
}

function closeModal(){
  modalOverlay.classList.remove('open');
  projectForm.reset();
  document.getElementById('projectStatus').innerHTML = '';
}

async function loadProjects(){
  galleryGrid.innerHTML = `<div class="empty-state">Chargement...</div>`;

  let query = sb.from('galerie').select(`
    id, title, category, cover_image_url, status, created_at,
    profiles ( full_name, avatar_url )
  `);

  if (state.tab === 'mine'){
    if (!currentUser){
      galleryGrid.innerHTML = `<div class="empty-state">Connecte-toi pour voir tes travaux.</div>`;
      return;
    }
    query = query.eq('user_id', currentUser.id);
  } else {
    query = query.eq('status', 'valide');
  }

  if (state.category !== 'all'){
    query = query.eq('category', state.category);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error){
    galleryGrid.innerHTML = `<div class="empty-state">Erreur de chargement : ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data || data.length === 0){
    galleryGrid.innerHTML = state.tab === 'mine'
      ? `<div class="empty-state">Tu n'as encore rien publié. Utilise le bouton + pour partager un premier travail.</div>`
      : `<div class="empty-state">Communauté naissante — aucun projet publié pour l'instant dans cette catégorie.</div>`;
    return;
  }

  galleryGrid.innerHTML = data.map(renderCard).join('');
}

function renderCard(project){
  const author = project.profiles || {};
  const authorName = escapeHtml(author.full_name || 'Membre');
  const initial = (author.full_name || '?').trim().charAt(0).toUpperCase() || '?';
  const avatarHtml = author.avatar_url
    ? `<img src="${escapeHtml(author.avatar_url)}" alt="">`
    : `<span>${escapeHtml(initial)}</span>`;

  const coverHtml = project.cover_image_url
    ? `<img src="${escapeHtml(project.cover_image_url)}" class="gc-cover" alt="">`
    : `<div class="gc-cover gc-cover-empty"></div>`;

  const statusBadge = state.tab === 'mine'
    ? `<span class="status-badge status-${project.status}">${STATUS_LABELS[project.status] || project.status}</span>`
    : '';

  return `
    <div class="gallery-card">
      ${coverHtml}
      <div class="gc-body">
        <div class="gc-author">
          <div class="gc-avatar">${avatarHtml}</div>
          <span>${authorName}</span>
        </div>
        <div class="gc-title">${escapeHtml(project.title)}</div>
        <div class="gc-meta">
          <span class="gc-cat">${CATEGORY_LABELS[project.category] || project.category}</span>
          ${statusBadge}
        </div>
      </div>
    </div>
  `;
}

async function handleProjectSubmit(e){
  e.preventDefault();
  if (!currentUser){
    window.location.href = 'connexion.html';
    return;
  }

  const btn = document.getElementById('projectSubmitBtn');
  const statusEl = document.getElementById('projectStatus');
  btn.disabled = true;
  btn.textContent = 'Publication...';
  statusEl.innerHTML = '';

  try {
    const title = document.getElementById('pj-title').value;
    const category = document.getElementById('pj-category').value;
    const description = document.getElementById('pj-description').value;
    const fileInput = document.getElementById('pj-cover');
    const file = fileInput.files[0];

    if (!category) throw new Error("Choisis une catégorie.");
    if (!file) throw new Error("Ajoute une photo principale.");

    const ext = file.name.split('.').pop();
    const path = `projects/${currentUser.id}-${Date.now()}.${ext}`;

    const { error: uploadError } = await sb.storage.from(PROJECT_BUCKET).upload(path, file);
    if (uploadError) throw uploadError;

    const { data: publicData } = sb.storage.from(PROJECT_BUCKET).getPublicUrl(path);
    const coverUrl = publicData.publicUrl;

    const { error: insertError } = await sb.from('galerie').insert({
      user_id: currentUser.id,
      title,
      description,
      category,
      cover_image_url: coverUrl
    });
    if (insertError) throw insertError;

    statusEl.innerHTML = `<div class="submit-status ok">Projet envoyé, en attente de validation.</div>`;
    projectForm.reset();

    setTimeout(() => {
      closeModal();
      document.querySelector('.gtab[data-tab="mine"]').click();
    }, 900);

  } catch (err){
    statusEl.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publier';
  }
}

init();
