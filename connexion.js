/* ============================================================
   ARCHITECTURE INTÉRIEURE — connexion.js
   ============================================================ */

const SUPABASE_URL = 'https://xhrhqgpzewyfenidyaox.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocmhxZ3B6ZXd5ZmVuaWR5YW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTA1NDQsImV4cCI6MjA5OTU2NjU0NH0.76-Z2nXAOUKWew-bvgTBhxAeYKbfkJZErwqUHrlQE3g';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
