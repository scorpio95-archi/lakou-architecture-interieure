/* ============================================================
   ARCHITECTURE INTÉRIEURE — tableau-de-bord.js
   ============================================================ */

const SUPABASE_URL = 'https://xhrhqgpzewyfenidyaox.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocmhxZ3B6ZXd5ZmVuaWR5YW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTA1NDQsImV4cCI6MjA5OTU2NjU0NH0.76-Z2nXAOUKWew-bvgTBhxAeYKbfkJZErwqUHrlQE3g';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const dashWrap = document.getElementById('dashWrap');

async function init(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session){
    window.location.href = 'connexion.html';
    return;
  }
  const userId = session.user.id;

  const { data: profile, error } = await sb
    .from('profiles')
    .select('full_name, role, school, school_id, avatar_url')
    .eq('id', userId)
    .single();

  if (error || !profile){
    dashWrap.innerHTML = `<div class="empty-state">Impossible de charger ton profil. Reconnecte-toi.</div>`;
    return;
  }

  render(profile);
}

function render(profile){
  const roleLabel = profile.role === 'teacher' ? 'Enseignant' : profile.role === 'admin' ? 'Admin' : 'Étudiant';
  const initial = (profile.full_name || '?').trim().charAt(0).toUpperCase() || '?';
  const initialSafe = initial.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const avatarHtml = profile.avatar_url
    ? `<img src="${profile.avatar_url}" style="width:100%; height:100%; object-fit:cover;">`
    : `<span style="color:var(--plaster); font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:1.3rem;">${initialSafe}</span>`;

  dashWrap.innerHTML = `
    <div class="dash-header">
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="width:56px; height:56px; border-radius:50%; overflow:hidden; background:var(--ink); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          ${avatarHtml}
        </div>
        <h1>Bonjour, ${escapeHtml(profile.full_name || 'toi')}</h1>
      </div>
      <span class="role-pill role-${profile.role}">${roleLabel}</span>
    </div>

    <div class="dash-note">
      La galerie et les articles ne sont pas encore construits — tes projets et publications apparaîtront ici une fois ces sections en place.
    </div>

    <div class="dash-links">
      <a href="parametres.html" class="dash-link-card">
        <div class="dl-title">Paramètres</div>
        <p>Infos, école, photo de profil, mot de passe.</p>
      </a>
      <a href="galerie.html" class="dash-link-card">
        <div class="dl-title">Galerie</div>
        <p>Bientôt : les travaux publiés par les étudiants.</p>
      </a>
      <a href="articles.html" class="dash-link-card">
        <div class="dl-title">Articles</div>
        <p>Bientôt : liens, réflexions et documents partagés.</p>
      </a>
      <a href="index.html" class="dash-link-card">
        <div class="dl-title">Accueil</div>
        <p>Retour à la page d'accueil de la discipline.</p>
      </a>
    </div>
  `;
}

function escapeHtml(str){
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

init();
