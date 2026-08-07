/* ============================================================
   ARCHITECTURE INTÉRIEURE — inscription.js
   Utilise le client Supabase unique créé par supabase-client.js
   (doit être chargé avant ce fichier).

   SÉCURITÉ (patch) : le rôle n'est plus choisi ni écrit depuis
   cette page. Tout nouveau compte reste "student" (valeur posée
   par handle_new_user() côté serveur). Pour devenir enseignant,
   il faudra passer par une demande validée par un admin (à
   construire séparément) — jamais un choix libre à l'inscription.
   ============================================================ */

// URL réelle du site déployé, doit correspondre à une entrée dans
// Authentication → URL Configuration → Redirect URLs du projet Supabase.
const SITE_URL = 'https://lakou-architecture-interieure.vercel.app';

let schoolsList = [];

const schoolSelect = document.getElementById('s-school-select');
const schoolOtherWrap = document.getElementById('schoolOtherWrap');
const schoolOtherInput = document.getElementById('s-school-other');

schoolSelect.addEventListener('change', () => {
  schoolOtherWrap.classList.toggle('show', schoolSelect.value === 'autre');
});

async function loadSchools(){
  const { data, error } = await sb.from('schools').select('id, name').eq('is_active', true).order('name');
  if (error){ console.error('Erreur chargement écoles :', error.message); return; }
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

form.addEventListener('submit', async (e) => {
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
      // (la ligne existe déjà, créée par le trigger handle_new_user, avec role='student' par défaut).
      // Volontairement pas de champ "role" ici : jamais choisi côté client.
      const { error: profileError } = await sb.from('profiles').update({
        full_name: fullName,
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
