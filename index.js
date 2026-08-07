/* ============================================================
   ARCHITECTURE INTÉRIEURE — index.js
   Utilise le client Supabase unique créé par supabase-client.js
   (doit être chargé avant ce fichier).
   ============================================================ */

const CATEGORY_LABELS = {
  residentiel: 'Résidentiel',
  patrimoine: 'Patrimoine',
  mobilier: 'Mobilier'
};

function escapeHtml(str){
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function animateCount(el, target){
  if (!el) return;
  if (target === 0){ el.textContent = '0'; return; }
  const duration = 900;
  const start = performance.now();
  function step(now){
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

async function loadStats(){
  const [membersRes, projectsRes, schoolsRes] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('galerie').select('id', { count: 'exact', head: true }).eq('status', 'valide'),
    sb.from('schools').select('id', { count: 'exact', head: true }).eq('is_active', true)
  ]);

  animateCount(document.getElementById('statMembers'), membersRes.count || 0);
  animateCount(document.getElementById('statProjects'), projectsRes.count || 0);
  animateCount(document.getElementById('statSchools'), schoolsRes.count || 0);

  loadCategoryCounts();
}

async function loadCategoryCounts(){
  const categories = ['residentiel', 'patrimoine', 'mobilier'];
  const results = await Promise.all(categories.map(cat =>
    sb.from('galerie').select('id', { count: 'exact', head: true }).eq('status', 'valide').eq('category', cat)
  ));

  categories.forEach((cat, i) => {
    const el = document.getElementById(`count-${cat}`);
    if (!el) return;
    const count = results[i].count || 0;
    el.textContent = count === 0 ? 'Aucun projet pour l\'instant' : (count === 1 ? '1 projet' : `${count} projets`);
  });
}

async function loadLatestProjects(){
  const grid = document.getElementById('latestGrid');
  if (!grid) return;

  const { data, error } = await sb.from('galerie').select(`
    id, title, category, cover_image_url, created_at,
    profiles ( full_name, avatar_url )
  `).eq('status', 'valide').order('created_at', { ascending: false }).limit(4);

  if (error){
    grid.innerHTML = `<div class="empty-state">Erreur de chargement.</div>`;
    return;
  }

  if (!data || data.length === 0){
    grid.innerHTML = `<div class="empty-state">Communauté naissante — les premiers projets partagés apparaîtront ici.</div>`;
    return;
  }

  grid.innerHTML = data.map(renderLatestCard).join('');
}

function renderLatestCard(project){
  const author = project.profiles || {};
  const authorName = escapeHtml(author.full_name || 'Membre');
  const initial = (author.full_name || '?').trim().charAt(0).toUpperCase() || '?';
  const avatarHtml = author.avatar_url
    ? `<img src="${escapeHtml(author.avatar_url)}" alt="">`
    : `<span>${escapeHtml(initial)}</span>`;
  const coverHtml = project.cover_image_url
    ? `<img src="${escapeHtml(project.cover_image_url)}" class="gc-cover" alt="">`
    : `<div class="gc-cover gc-cover-empty"></div>`;

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
        </div>
      </div>
    </div>
  `;
}

loadStats();
loadLatestProjects();
