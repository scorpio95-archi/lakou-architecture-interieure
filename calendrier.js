/* ============================================================
   ARCHITECTURE INTÉRIEURE — calendrier.js
   Visible par tous (events est en lecture publique). Création et
   changement de statut réservés à teacher/admin.
   ============================================================ */

const TYPE_LABELS = { cours: 'Cours', atelier: 'Atelier', examen: 'Examen', rencontre: 'Rencontre', autre: 'Autre' };
const STATUS_LABELS = { prevu: 'Prévu', reporte: 'Reporté', annule: 'Annulé' };

let currentRole = null;
let currentTypeFilter = '';
let allEvents = [];

const eventsList = document.getElementById('eventsList');
const fabAdd = document.getElementById('fabAdd');
const modalOverlay = document.getElementById('modalOverlay');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const eventForm = document.getElementById('eventForm');

function escapeHtml(str){
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function init(){
  const { data: { session } } = await sb.auth.getSession();
  if (session){
    const { data: profile } = await sb.from('profiles').select('role').eq('id', session.user.id).single();
    currentRole = profile ? profile.role : null;
    if (currentRole === 'teacher' || currentRole === 'admin'){
      fabAdd.style.display = 'flex';
    }
  }

  document.getElementById('eventFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.gfilter');
    if (!btn) return;
    document.querySelectorAll('#eventFilters .gfilter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTypeFilter = btn.dataset.cat;
    render();
  });

  fabAdd.addEventListener('click', () => modalOverlay.classList.add('open'));
  modalCloseBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  eventForm.addEventListener('submit', handleEventSubmit);

  loadEvents();
}

function closeModal(){
  modalOverlay.classList.remove('open');
  eventForm.reset();
  document.getElementById('eventStatus').innerHTML = '';
}

async function loadEvents(){
  eventsList.innerHTML = `<div class="empty-state">Chargement...</div>`;

  const { data, error } = await sb.from('events')
    .select('id, title, description, event_type, event_date, location, status')
    .order('event_date', { ascending: true });

  if (error){
    eventsList.innerHTML = `<div class="empty-state">Erreur de chargement.</div>`;
    return;
  }

  allEvents = data || [];
  render();
}

function render(){
  const isStaff = currentRole === 'teacher' || currentRole === 'admin';
  const now = new Date();

  let filtered = allEvents;
  if (currentTypeFilter) filtered = filtered.filter(e => e.event_type === currentTypeFilter);

  if (filtered.length === 0){
    eventsList.innerHTML = `<div class="empty-state">Aucun événement pour l'instant.</div>`;
    return;
  }

  eventsList.innerHTML = filtered.map(ev => {
    const isPast = new Date(ev.event_date) < now;
    const statusOptions = Object.entries(STATUS_LABELS)
      .map(([val, label]) => `<option value="${val}" ${ev.status === val ? 'selected' : ''}>${label}</option>`).join('');

    return `
      <div class="event-row${isPast ? ' event-past' : ''}${ev.status === 'annule' ? ' event-cancelled' : ''}" id="ev-${ev.id}">
        <div class="event-row-main">
          <span class="forum-topic-cat">${TYPE_LABELS[ev.event_type] || ev.event_type}</span>
          <span class="status-badge status-${ev.status === 'prevu' ? 'valide' : ev.status === 'reporte' ? 'soumis' : 'rejete'}">${STATUS_LABELS[ev.status]}</span>
          <h3 class="forum-topic-title">${escapeHtml(ev.title)}</h3>
          <div class="forum-topic-meta">${formatDate(ev.event_date)}${ev.location ? ' · ' + escapeHtml(ev.location) : ''}</div>
          ${ev.description ? `<p style="margin-top:8px; font-size:0.9rem; color:var(--ink-soft);">${escapeHtml(ev.description)}</p>` : ''}
        </div>
        ${isStaff ? `
          <div class="event-row-actions">
            <select class="event-status-select" data-id="${ev.id}">${statusOptions}</select>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  if (isStaff){
    eventsList.querySelectorAll('.event-status-select').forEach(select => {
      select.addEventListener('change', () => updateStatus(select.dataset.id, select.value));
    });
  }
}

async function updateStatus(id, status){
  const { error } = await sb.from('events').update({ status }).eq('id', id);
  if (error){ alert(error.message); return; }
  const ev = allEvents.find(e => e.id === id);
  if (ev) ev.status = status;
  render();
}

async function handleEventSubmit(e){
  e.preventDefault();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  const btn = document.getElementById('eventSubmitBtn');
  const statusEl = document.getElementById('eventStatus');
  btn.disabled = true;
  btn.textContent = 'Publication...';
  statusEl.innerHTML = '';

  try {
    const title = document.getElementById('e-title').value;
    const event_type = document.getElementById('e-type').value;
    const dateRaw = document.getElementById('e-date').value;
    const location = document.getElementById('e-location').value;
    const description = document.getElementById('e-description').value;

    const { error } = await sb.from('events').insert({
      title, event_type, event_date: new Date(dateRaw).toISOString(),
      location: location || null, description: description || null,
      created_by: session.user.id
    });
    if (error) throw error;

    closeModal();
    loadEvents();

  } catch (err){
    statusEl.innerHTML = `<div class="submit-status err">${escapeHtml(err.message || String(err))}</div>`;
    btn.disabled = false;
    btn.textContent = 'Publier';
  }
}

init();
