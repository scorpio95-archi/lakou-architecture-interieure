/* ============================================================
   ARCHITECTURE INTÉRIEURE — inscription.js
   ============================================================ */

// --- DEBUG VISIBLE SUR PAGE (temporaire, à retirer une fois réparé) ---
// Affiche l'état d'exécution directement dans le DOM, sans passer par
// alert()/console — visible même sans devtools, impossible à faire taire.
(function(){
  const d = document.createElement('div');
  d.id = 'debugBox';
  d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#111;color:#0f0;font:12px monospace;padding:8px;white-space:pre-wrap;';
  d.textContent = 'DEBUG: inscription.js a démarré son exécution';
  function mount(){ document.body.prepend(d); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  window.__debug = (msg) => { d.textContent += '\n' + msg; };
})();

const SUPABASE_URL = 'https://xhrhqgpzewyfenidyaox.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocmhxZ3B6ZXd5ZmVuaWR5YW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTA1NDQsImV4cCI6MjA5OTU2NjU0NH0.76-Z2nXAOUKWew-bvgTBhxAeYKbfkJZErwqUHrlQE3g';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.__debug('client Supabase créé');

// URL réelle du site déployé, doit correspondre à une entrée dans
// Authentication → URL Configuration → Redirect URLs du projet Supabase.
const SITE_URL = 'https://lakou-architecture-interieure.vercel.app';

let currentRole = 'student';
let schoolsList = [];

const roleButtons = document.querySelectorAll('[data-role]');
roleButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    roleButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRole = btn.dataset.role;
  });
});

const schoolSelect = document.getElementById('s-school-select');
const schoolOtherWrap = document.getElementById('schoolOtherWrap');
const schoolOtherInput = document.getElementById('s-school-other');

schoolSelect.addEventListener('change', () => {
  schoolOtherWrap.classList.toggle('show', schoolSelect.value === 'autre');
});

async function loadSchools(){
  window.__debug('loadSchools() appelée');
  const { data, error } = await sb.from('schools').select('id, name').eq('is_active', true).order('name');
  if (error){ window.__debug('ERREUR écoles: ' + error.message); console.error('Erreur chargement écoles :', error.message); return; }
  window.__debug(`écoles reçues: ${data ? data.length : 0}`);
  if (!data) return;
  schoolsList = data;
  const autreOpt = schoolSelect.querySelector('option[value="autre"]');
  data.forEach(school => {
    const opt = document.createElement('option');
    opt.value = school.id;
    opt.textContent = school.name;
    schoolSelect.insertBefore(opt, autreOpt);
  });
}
loadSchools();

const form = document.getElementById('signupForm');
const btn = document.getElementById('signupBtn');
const statusEl = document.getElementById('signupStatus');
window.__debug('éléments du formulaire trouvés, attachement du listener...');

form.addEventListener('submit', async (e) => {
  window.__debug('submit détecté');
  e.preventDefault();
  btn.disabled = true;
  btn.textContent = 'Création...';
  statusEl.innerHTML = '';

  try {
    const fullName = document.getElementById('s-name').value;
    const email = document.getElementById('s-email').value;
    const password = document.getElementById('s-password').value;

    const schoolChoice = schoolSelect.value;
    if (!schoolChoice) throw new Error("Choisis ton établissement.");
    const schoolId = schoolChoice !== 'autre' ? schoolChoice : null;
    const schoolOther = schoolChoice === 'autre' ? schoolOtherInput.value.trim() : null;
    if (schoolChoice === 'autre' && !schoolOther) throw new Error("Indique le nom de ton école.");

    const { data: signUpData, error: signUpError } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${SITE_URL}/connexion.html`
      }
    });
    if (signUpError) throw signUpError;

    const userId = signUpData.user.id;
    const hasSession = !!signUpData.session;

    if (hasSession){
      // Pas de confirmation d'email requise : on complète le profil tout de suite
      // (la ligne existe déjà, créée par le trigger handle_new_user).
      const { error: profileError } = await sb.from('profiles').update({
        full_name: fullName,
        role: currentRole,
        school_id: schoolId,
        school: schoolOther
      }).eq('id', userId);
      if (profileError) throw profileError;

      window.location.href = 'tableau-de-bord.html';
    } else {
      statusEl.innerHTML = `<div class="submit-status ok">Compte créé. Vérifie ton email pour confirmer ton inscription avant de te connecter.</div>`;
      form.reset();
      btn.disabled = false;
      btn.textContent = 'Créer mon compte';
    }

  } catch (err){
    statusEl.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
    btn.disabled = false;
    btn.textContent = 'Créer mon compte';
  }
});
