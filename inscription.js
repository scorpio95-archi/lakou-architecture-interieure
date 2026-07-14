/* ============================================================
   ARCHITECTURE INTÉRIEURE — inscription.js
   ============================================================ */

const SUPABASE_URL = 'https://xhrhqgpzewyfenidyaox.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocmhxZ3B6ZXd5ZmVuaWR5YW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTA1NDQsImV4cCI6MjA5OTU2NjU0NH0.76-Z2nXAOUKWew-bvgTBhxAeYKbfkJZErwqUHrlQE3g';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ⚠️ À CONFIRMER : remplace par l'URL Vercel réelle une fois le site déployé,
// puis ajoute-la aux Redirect URLs du projet Supabase (Authentication → URL Configuration),
// exactement comme on l'a fait pour Urbanisme.
const SITE_URL = 'https://lakou-architecture-interieure.vercel.app/';

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
  const { data, error } = await sb.from('schools').select('id, name').eq('is_active', true).order('name');
  if (error || !data) return;
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
const status = document.getElementById('signupStatus');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  btn.textContent = 'Création...';
  status.innerHTML = '';

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
      status.innerHTML = `<div class="submit-status ok">Compte créé. Vérifie ton email pour confirmer ton inscription avant de te connecter.</div>`;
      form.reset();
      btn.disabled = false;
      btn.textContent = 'Créer mon compte';
    }

  } catch (err){
    status.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
    btn.disabled = false;
    btn.textContent = 'Créer mon compte';
  }
});
