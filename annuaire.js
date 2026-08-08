/* ============================================================
   ARCHITECTURE INTÉRIEURE — annuaire.js
   Ouvert à tous (profiles est en lecture publique).
   ============================================================ */

const ROLE_LABELS = { student: 'Étudiant', teacher: 'Enseignant', admin: 'Admin', visitor: 'Visiteur' };

let allMembers = [];
let roleFilter = '';

function escapeHtml(str){
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function init(){
  const { data, error } = await sb.from('profiles')
    .select('id, full_name, role, school, avatar_url, bio')
    .order('full_name', { ascending: true });

  const grid = document.getElementById('annuaireGrid');
  if (error){
    grid.innerHTML = `<div class="empty-state">Erreur de chargement.</div>`;
    return;
  }
  allMembers = (data || []).filter(m => m.role !== 'visitor');

  document.getElementById('roleFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.gfilter');
    if (!btn) return;
    document.querySelectorAll('#roleFilters .gfilter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    roleFilter = btn.dataset.role;
    render();
  });

  document.getElementById('searchInput').addEventListener('input', render);

  render();
}

function render(){
  const grid = document.getElementById('annuaireGrid');
  const search = document.getElementById('searchInput').value.trim().toLowerCase();

  const filtered = allMembers.filter(m => {
    if (roleFilter && m.role !== roleFilter) return false;
    if (search && !(m.full_name || '').toLowerCase().includes(search)) return false;
    return true;
  });

  if (filtered.length === 0){
    grid.innerHTML = `<div class="empty-state">Aucun membre ne correspond.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(m => {
    const initial = (m.full_name || '?').trim().charAt(0).toUpperCase() || '?';
    const avatarHtml = m.avatar_url ? `<img src="${escapeHtml(m.avatar_url)}" alt="">` : `<span>${escapeHtml(initial)}</span>`;
    return `
      <div class="annuaire-card">
        <div class="annuaire-avatar">${avatarHtml}</div>
        <div class="annuaire-name">${escapeHtml(m.full_name || 'Sans nom')}</div>
        <span class="role-pill role-${m.role}">${ROLE_LABELS[m.role] || m.role}</span>
        ${m.school ? `<div class="annuaire-school">${escapeHtml(m.school)}</div>` : ''}
      </div>
    `;
  }).join('');
}

init();
