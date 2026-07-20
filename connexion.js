/* ============================================================
   ARCHITECTURE INTÉRIEURE — connexion.js
   Utilise le client Supabase unique créé par supabase-client.js
   (doit être chargé avant ce fichier).
   ============================================================ */

const form = document.getElementById('loginForm');
const btn = document.getElementById('loginBtn');
const statusEl = document.getElementById('loginStatus');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  btn.textContent = 'Connexion...';
  statusEl.innerHTML = '';

  try {
    const email = document.getElementById('l-email').value;
    const password = document.getElementById('l-password').value;

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    window.location.href = 'tableau-de-bord.html';

  } catch (err){
    statusEl.innerHTML = `<div class="submit-status err">Email ou mot de passe incorrect.</div>`;
    btn.disabled = false;
    btn.textContent = 'Se connecter';
  }
});
