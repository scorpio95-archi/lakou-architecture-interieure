/* ============================================================
   ARCHITECTURE INTÉRIEURE — menu.js
   Panneau de menu partagé sur toutes les pages : burger,
   accordéon Disciplines, bascule Connexion/Inscription
   ↔ Tableau de bord/Paramètres/Déconnexion selon la session.
   ============================================================ */

const SUPABASE_URL = 'https://xhrhqgpzewyfenidyaox.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocmhxZ3B6ZXd5ZmVuaWR5YW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTA1NDQsImV4cCI6MjA5OTU2NjU0NH0.76-Z2nXAOUKWew-bvgTBhxAeYKbfkJZErwqUHrlQE3g';
const sbMenu = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const burgerBtn = document.getElementById('burgerBtn');
const menuCloseBtn = document.getElementById('menuCloseBtn');
const menuOverlay = document.getElementById('menuOverlay');
const discAccBtn = document.getElementById('discAccBtn');
const discAccBody = document.getElementById('discAccBody');
const authGuest = document.getElementById('authGuest');
const authUser = document.getElementById('authUser');
const logoutBtn = document.getElementById('logoutBtn');

function openMenu(){
  menuOverlay.classList.add('open');
  burgerBtn.setAttribute('aria-expanded', 'true');
}
function closeMenu(){
  menuOverlay.classList.remove('open');
  burgerBtn.setAttribute('aria-expanded', 'false');
}

if (burgerBtn) burgerBtn.addEventListener('click', openMenu);
if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMenu);
document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeMenu));

if (discAccBtn){
  discAccBtn.addEventListener('click', () => {
    const isOpen = discAccBtn.getAttribute('aria-expanded') === 'true';
    discAccBtn.setAttribute('aria-expanded', String(!isOpen));
    discAccBody.style.maxHeight = isOpen ? '0px' : discAccBody.scrollHeight + 'px';
  });
}

async function refreshAuthState(){
  const { data: { session } } = await sbMenu.auth.getSession();
  if (session){
    authGuest.style.display = 'none';
    authUser.style.display = 'block';
  } else {
    authGuest.style.display = 'block';
    authUser.style.display = 'none';
  }
}

if (logoutBtn){
  logoutBtn.addEventListener('click', async () => {
    await sbMenu.auth.signOut();
    window.location.href = 'index.html';
  });
}

refreshAuthState();
