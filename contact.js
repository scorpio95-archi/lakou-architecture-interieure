/* ============================================================
   ARCHITECTURE INTÉRIEURE — contact.js
   Deux listes de sujets selon l'audience :
   - student/teacher/visitor/invité → écrit à l'admin du site
   - admin → écrit au fondateur du réseau (Sébastien)
   Passe par la Edge Function send-contact-message (pas d'écriture
   directe côté client).
   ============================================================ */

const SUJETS_USER = {
  question: 'Question générale',
  probleme: 'Signaler un problème',
  suggestion: 'Suggestion',
  moderation: 'Contenu à modérer',
  autre: 'Autre'
};

const SUJETS_ADMIN = {
  technique: 'Problème technique / bug',
  fonctionnalite: 'Nouvelle fonctionnalité',
  ressources: 'Besoin de ressources / support',
  partenariat: 'Partenariat / presse',
  autre: 'Autre'
};

let audience = 'user_to_admin';

async function init(){
  const sujetSelect = document.getElementById('c-sujet');

  const { data: { session } } = await sb.auth.getSession();

  if (session){
    const { data: profile } = await sb.from('profiles').select('full_name, role').eq('id', session.user.id).single();
    document.getElementById('c-nom').value = profile ? profile.full_name : '';
    document.getElementById('c-email').value = session.user.email || '';

    if (profile && profile.role === 'admin'){
      audience = 'admin_to_founder';
      document.getElementById('contactLead').textContent = "Une question ou un besoin pour le réseau Lakou Archi — écris au fondateur.";
    }
  }

  const sujets = audience === 'admin_to_founder' ? SUJETS_ADMIN : SUJETS_USER;
  sujetSelect.innerHTML = Object.entries(sujets).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');

  document.getElementById('contactForm').addEventListener('submit', handleSubmit);
}

async function handleSubmit(e){
  e.preventDefault();
  const btn = document.getElementById('c-submit');
  const statusEl = document.getElementById('c-status');

  const nom = document.getElementById('c-nom').value.trim();
  const email = document.getElementById('c-email').value.trim();
  const sujet = document.getElementById('c-sujet').value;
  const message = document.getElementById('c-message').value.trim();

  if (!nom || !email || !message){
    statusEl.innerHTML = `<div class="submit-status err">Nom, email et message sont obligatoires.</div>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Envoi...';
  statusEl.innerHTML = '';

  const { error } = await sb.functions.invoke('send-contact-message', {
    body: { nom, email, audience, sujet, message }
  });

  btn.disabled = false;
  btn.textContent = 'Envoyer';

  if (error){
    let detail = error.message || 'Erreur inconnue.';
    if (error.context && typeof error.context.json === 'function'){
      try { const body = await error.context.json(); if (body?.error) detail = body.error; } catch(e){}
    }
    statusEl.innerHTML = `<div class="submit-status err">Échec de l'envoi : ${detail}</div>`;
    return;
  }

  statusEl.innerHTML = `<div class="submit-status ok">Message envoyé — merci, on te répond bientôt !</div>`;
  document.getElementById('c-message').value = '';
}

init();
