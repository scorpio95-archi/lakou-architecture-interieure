/* ============================================================
   ARCHITECTURE INTÉRIEURE — parametres.js
   Utilise le client Supabase unique créé par supabase-client.js
   (doit être chargé avant ce fichier).
   ============================================================ */

// Bucket Storage réutilisé (même bucket que les images de la page d'accueil).
const AVATAR_BUCKET = 'architecture-interieure';

const settingsWrap = document.getElementById('settingsWrap');

let currentUser = null;
let currentProfile = null;
let schoolsList = [];
let selectedRole = 'student';

async function init(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session){
    window.location.href = 'connexion.html';
    return;
  }
  currentUser = session.user;

  const { data: profile, error } = await sb
    .from('profiles')
    .select('full_name, role, school, school_id, avatar_url')
    .eq('id', currentUser.id)
    .single();

  if (error || !profile){
    settingsWrap.innerHTML = `<span class="eyebrow">Ton compte</span><h1>Paramètres</h1><p class="lead">Impossible de charger ton profil. Reconnecte-toi.</p>`;
    return;
  }

  currentProfile = profile;
  selectedRole = profile.role === 'teacher' ? 'teacher' : 'student';

  const { data: schools } = await sb.from('schools').select('id, name').eq('is_active', true).order('name');
  schoolsList = schools || [];

  render();
  attachEvents();
}

function escapeHtml(str){
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function render(){
  const p = currentProfile;
  const initial = (p.full_name || '?').trim().charAt(0).toUpperCase() || '?';
  const avatarHtml = p.avatar_url
    ? `<img id="avatarPreview" src="${p.avatar_url}" style="width:100%; height:100%; object-fit:cover;">`
    : `<span id="avatarPreview" style="color:var(--plaster); font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:1.6rem; display:flex; align-items:center; justify-content:center; width:100%; height:100%;">${escapeHtml(initial)}</span>`;

  const schoolOptions = schoolsList.map(s =>
    `<option value="${s.id}" ${s.id === p.school_id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');
  const isAutre = !p.school_id && !!p.school;

  settingsWrap.innerHTML = `
    <span class="eyebrow">Ton compte</span>
    <h1>Paramètres</h1>
    <p class="lead">Ton nom, ton école et ta photo sont visibles par les autres membres du Lakou.</p>

    <div class="form-group" style="display:flex; align-items:center; gap:16px;">
      <div style="width:88px; height:88px; border-radius:50%; overflow:hidden; background:var(--ink); flex-shrink:0;">
        ${avatarHtml}
      </div>
      <div>
        <label for="avatarInput" class="btn-primary" style="display:inline-block; cursor:pointer; padding:10px 18px; font-size:0.85rem;">Changer la photo</label>
        <input type="file" id="avatarInput" accept="image/*" style="display:none;">
        <div id="avatarStatus" style="margin-top:6px;"></div>
      </div>
    </div>

    <form id="profileForm">
      <div class="form-group">
        <label>Je suis</label>
        <div class="role-toggle">
          <div class="role-btn ${selectedRole === 'student' ? 'active' : ''}" data-role="student">Étudiant</div>
          <div class="role-btn ${selectedRole === 'teacher' ? 'active' : ''}" data-role="teacher">Enseignant</div>
        </div>
      </div>

      <div class="form-group">
        <label for="p-name">Nom complet</label>
        <input type="text" id="p-name" required value="${escapeHtml(p.full_name)}">
      </div>

      <div class="form-group">
        <label>Email</label>
        <input type="email" value="${escapeHtml(currentUser.email)}" disabled>
      </div>

      <div class="form-group">
        <label for="p-school-select">École</label>
        <select id="p-school-select">
          <option value="">Choisis ton établissement</option>
          ${schoolOptions}
          <option value="autre" ${isAutre ? 'selected' : ''}>Autre (préciser)</option>
        </select>
      </div>
      <div class="form-group school-other" id="schoolOtherWrap" style="${isAutre ? 'display:block;' : ''}">
        <label for="p-school-other">Nom de l'école</label>
        <input type="text" id="p-school-other" value="${isAutre ? escapeHtml(p.school) : ''}">
      </div>

      <button type="submit" class="btn-primary" id="profileBtn">Enregistrer les modifications</button>
      <div id="profileStatus"></div>
    </form>

    <div class="form-group" style="margin-top:34px; padding-top:24px; border-top:1px solid var(--ligne, #ddd);">
      <label>Changer de mot de passe</label>
    </div>
    <form id="passwordForm">
      <div class="form-group">
        <label for="p-password1">Nouveau mot de passe</label>
        <input type="password" id="p-password1" minlength="6" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label for="p-password2">Confirmer le mot de passe</label>
        <input type="password" id="p-password2" minlength="6" autocomplete="new-password">
      </div>
      <button type="submit" class="btn-primary" id="passwordBtn">Mettre à jour le mot de passe</button>
      <div id="passwordStatus"></div>
    </form>
  `;
}

function attachEvents(){
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRole = btn.dataset.role;
    });
  });

  const schoolSelect = document.getElementById('p-school-select');
  const schoolOtherWrap = document.getElementById('schoolOtherWrap');
  schoolSelect.addEventListener('change', () => {
    schoolOtherWrap.style.display = schoolSelect.value === 'autre' ? 'block' : 'none';
  });

  document.getElementById('avatarInput').addEventListener('change', handleAvatarUpload);
  document.getElementById('profileForm').addEventListener('submit', handleProfileSubmit);
  document.getElementById('passwordForm').addEventListener('submit', handlePasswordSubmit);
}

async function handleAvatarUpload(e){
  const file = e.target.files[0];
  if (!file) return;
  const avatarStatus = document.getElementById('avatarStatus');
  avatarStatus.innerHTML = `<span style="font-size:0.8rem; color:var(--ink-soft, #777);">Envoi...</span>`;

  try {
    const ext = file.name.split('.').pop();
    const path = `avatars/${currentUser.id}-${Date.now()}.${ext}`;

    const { error: uploadError } = await sb.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicData } = sb.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const avatarUrl = publicData.publicUrl;

    const { error: updateError } = await sb.from('profiles').update({ avatar_url: avatarUrl }).eq('id', currentUser.id);
    if (updateError) throw updateError;

    currentProfile.avatar_url = avatarUrl;
    const preview = document.getElementById('avatarPreview');
    preview.outerHTML = `<img id="avatarPreview" src="${avatarUrl}" style="width:100%; height:100%; object-fit:cover;">`;
    avatarStatus.innerHTML = `<span style="font-size:0.8rem; color:var(--ink-soft, #777);">Photo mise à jour.</span>`;

  } catch (err){
    avatarStatus.innerHTML = `<div class="submit-status err">Échec de l'envoi : ${err.message || err}. Vérifie que le bucket "${AVATAR_BUCKET}" autorise l'upload pour les utilisateurs connectés.</div>`;
  }
}

async function handleProfileSubmit(e){
  e.preventDefault();
  const btn = document.getElementById('profileBtn');
  const statusEl = document.getElementById('profileStatus');
  btn.disabled = true;
  btn.textContent = 'Enregistrement...';
  statusEl.innerHTML = '';

  try {
    const fullName = document.getElementById('p-name').value;
    const schoolChoice = document.getElementById('p-school-select').value;
    if (!schoolChoice) throw new Error("Choisis ton établissement.");
    const schoolOtherInput = document.getElementById('p-school-other');
    const schoolId = schoolChoice !== 'autre' ? schoolChoice : null;
    const schoolOther = schoolChoice === 'autre' ? schoolOtherInput.value.trim() : null;
    if (schoolChoice === 'autre' && !schoolOther) throw new Error("Indique le nom de ton école.");

    const { error } = await sb.from('profiles').update({
      full_name: fullName,
      role: selectedRole,
      school_id: schoolId,
      school: schoolOther
    }).eq('id', currentUser.id);
    if (error) throw error;

    statusEl.innerHTML = `<div class="submit-status ok">Modifications enregistrées.</div>`;

  } catch (err){
    statusEl.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enregistrer les modifications';
  }
}

async function handlePasswordSubmit(e){
  e.preventDefault();
  const btn = document.getElementById('passwordBtn');
  const statusEl = document.getElementById('passwordStatus');
  btn.disabled = true;
  btn.textContent = 'Mise à jour...';
  statusEl.innerHTML = '';

  try {
    const p1 = document.getElementById('p-password1').value;
    const p2 = document.getElementById('p-password2').value;
    if (!p1 || p1.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
    if (p1 !== p2) throw new Error("Les deux mots de passe ne correspondent pas.");

    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) throw error;

    statusEl.innerHTML = `<div class="submit-status ok">Mot de passe mis à jour.</div>`;
    document.getElementById('passwordForm').reset();

  } catch (err){
    statusEl.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Mettre à jour le mot de passe';
  }
}

init();
