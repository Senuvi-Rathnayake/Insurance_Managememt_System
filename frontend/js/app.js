if (!SecureLife.getToken()) location.replace('/login.html');

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const formatDate = (value, includeTime = false) => new Intl.DateTimeFormat('en-LK', includeTime ? { dateStyle:'medium', timeStyle:'short' } : { dateStyle:'medium' }).format(new Date(value));
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
let claimCache = [];

function initializeComingSoonCards() {
  const modal = document.createElement('div');
  modal.className = 'service-modal hidden';
  modal.innerHTML = `<div class="service-modal-card" role="dialog" aria-modal="true" aria-labelledby="coming-service-title"><button class="modal-close" type="button" aria-label="Close">×</button><div class="coming-icon">◷</div><span class="availability">Coming soon</span><h2 id="coming-service-title"></h2><p>This insurance service is currently under development. Vehicle Insurance is available now.</p><button class="btn btn-primary modal-ok" type="button">Got it</button></div>`;
  document.body.append(modal);
  const close = () => modal.classList.add('hidden');
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('.modal-ok').addEventListener('click', close);
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  $$('.service-card.coming').forEach((card) => {
    card.querySelector('.availability')?.remove();
    card.setAttribute('role', 'button'); card.tabIndex = 0;
    const open = () => { modal.querySelector('h2').textContent = card.querySelector('h3').textContent; modal.classList.remove('hidden'); modal.querySelector('.modal-ok').focus(); };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  });
}

function initializeReviewsPage() {
  $('#page-feedback').innerHTML = `<div class="page-hero"><div class="container"><span class="eyebrow">Customer experiences</span><h1>Vehicle Insurance Reviews</h1><p>See what customers say about our accident notification and claims support.</p></div></div><div class="section-pad"><div class="container"><div class="section-heading center"><span class="eyebrow eyebrow-blue">Trusted on the road</span><h2>What our customers say</h2><p>Published feedback from SecureLife vehicle insurance customers.</p></div><div id="reviews-grid" class="reviews-grid"><div class="empty">Loading reviews…</div></div></div></div>`;
  document.querySelector('.nav-link[data-page="feedback"] small')?.remove();
}

const user = SecureLife.getUser();
if (user?.fullName) $('#user-name').textContent = user.fullName.split(' ')[0];
$('#incidentAt').max = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function toast(message, type = '') {
  const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message; $('#toast-zone').append(el); setTimeout(() => el.remove(), 4800);
}

async function showPage(page, updateHash = true) {
  if (!document.querySelector(`#page-${page}`)) page = 'home';
  $$('.app-section').forEach((section) => section.classList.toggle('active', section.id === `page-${page}`));
  $$('.nav-link').forEach((link) => link.classList.toggle('active', link.dataset.page === page));
  $('#nav-links').classList.remove('open');
  if (updateHash) history.replaceState(null, '', `#${page}`);
  window.scrollTo({ top:0, behavior:'smooth' });
  if (page === 'notify') await loadProfile();
  if (page === 'claims') await loadClaims();
  if (page === 'feedback') await loadReviews();
}

document.addEventListener('click', (event) => { const target = event.target.closest('[data-page]'); if (target) { event.preventDefault(); showPage(target.dataset.page); } });
$('#menu-toggle').addEventListener('click', () => $('#nav-links').classList.toggle('open'));
$('#logout').addEventListener('click', () => { SecureLife.clearSession(); location.replace('/login.html'); });

async function loadProfile() {
  try {
    const profile = await SecureLife.api('/auth/me');
    $('#customerFullName').value = profile.full_name;
    $('#customerEmail').value = profile.email;
    if (!$('#contactNumber').value) $('#contactNumber').value = profile.phone;
  } catch (error) { toast(error.message, 'error'); }
}

$('#contact-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
  const button = form.querySelector('button[type=submit]'); SecureLife.setBusy(button, true, 'Sending…');
  try { const result = await SecureLife.api('/inquiries', { method:'POST', body:JSON.stringify(Object.fromEntries(new FormData(form))) }); toast(result.message); form.reset(); }
  catch (error) { toast(error.message, 'error'); } finally { SecureLife.setBusy(button, false); }
});

const accidentForm = $('#accident-form');
const submitButton = accidentForm.querySelector('button[type=submit]');
const cancelEditButton = document.createElement('button');
cancelEditButton.type = 'button'; cancelEditButton.className = 'btn btn-outline hidden'; cancelEditButton.textContent = 'Cancel edit';
submitButton.insertAdjacentElement('afterend', cancelEditButton);

const editPhotoNote = document.createElement('p');
editPhotoNote.className = 'small-note hidden';
$('#photo-preview').insertAdjacentElement('afterend', editPhotoNote);

const photosInput = $('#accidentPhotos');
photosInput.addEventListener('change', () => {
  const preview = $('#photo-preview'); preview.innerHTML = '';
  const files = [...photosInput.files];
  if (files.length > 6) { toast('Select no more than 6 photos.', 'error'); photosInput.value = ''; return; }
  files.forEach((file) => {
    const item = document.createElement('div'); item.className = 'photo-thumb';
    const img = document.createElement('img'); img.alt = file.name; img.src = URL.createObjectURL(file); img.onload = () => URL.revokeObjectURL(img.src);
    const name = document.createElement('span'); name.textContent = file.name; item.append(img, name); preview.append(item);
  });
});

function resetClaimForm() {
  delete accidentForm.dataset.editId;
  accidentForm.reset();
  submitButton.textContent = 'Submit accident notification';
  cancelEditButton.classList.add('hidden');
  editPhotoNote.classList.add('hidden');
  editPhotoNote.textContent = '';
  $('#photo-preview').innerHTML = '';
  loadProfile();
}
cancelEditButton.addEventListener('click', resetClaimForm);

accidentForm.addEventListener('submit', async (event) => {
  event.preventDefault(); if (!accidentForm.reportValidity()) return;
  const editing = accidentForm.dataset.editId;
  SecureLife.setBusy(submitButton, true, editing ? 'Updating notification…' : 'Submitting notification…');
  try {
    const result = await SecureLife.api(editing ? `/accidents/${editing}` : '/accidents', { method:editing ? 'PUT' : 'POST', body:new FormData(accidentForm) });
    const n = result.notification;
    const confirmation = $('#submission-confirmation');
    confirmation.innerHTML = `<div class="confirmation-check">✓</div><div><span class="eyebrow eyebrow-blue">${editing ? 'Notification updated' : 'Notification submitted'}</span><h2>${escapeHtml(n.reference_number)}</h2><p>${escapeHtml(result.message)}</p><div class="confirmation-details"><span><b>Vehicle</b>${escapeHtml(n.registration_number)} · ${escapeHtml(n.vehicle_type)}</span><span><b>Incident</b>${escapeHtml(n.incident_type)} · ${formatDate(n.incident_at, true)}</span><span><b>Status</b><em class="status-pill pending">${escapeHtml(n.status)}</em></span></div><button class="btn btn-secondary" data-page="claims">View in Manage Claim</button></div>`;
    confirmation.classList.remove('hidden'); resetClaimForm(); confirmation.scrollIntoView({ behavior:'smooth', block:'start' });
  } catch (error) { toast(error.message, 'error'); } finally { SecureLife.setBusy(submitButton, false); }
});

function toLocalInput(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

async function editClaim(id) {
  const claim = claimCache.find((item) => String(item.id) === String(id));
  if (!claim || claim.status !== 'Pending') return;
  await showPage('notify');
  accidentForm.dataset.editId = claim.id;
  $('#contactNumber').value = claim.contact_number;
  $('#vehicleRegistrationNumber').value = claim.registration_number;
  $('#vehicleType').value = claim.vehicle_type;
  $('#incidentType').value = claim.incident_type;
  $('#incidentAt').value = toLocalInput(claim.incident_at);
  $('#accidentLocation').value = claim.accident_location;
  $('#accidentDescription').value = claim.description;
  submitButton.textContent = 'Update accident notification';
  cancelEditButton.classList.remove('hidden');
  if (claim.photos.length) {
    editPhotoNote.textContent = `${claim.photos.length} existing photo${claim.photos.length === 1 ? '' : 's'} will be kept. You may add more, up to 6 total.`;
    editPhotoNote.classList.remove('hidden');
  }
  accidentForm.scrollIntoView({ behavior:'smooth', block:'start' });
}

async function deleteClaim(id) {
  const claim = claimCache.find((item) => String(item.id) === String(id));
  if (!claim || claim.status !== 'Pending') return;
  if (!confirm(`Delete notification ${claim.reference_number}? This cannot be undone.`)) return;
  try {
    const result = await SecureLife.api(`/accidents/${id}`, { method:'DELETE' });
    toast(result.message); await loadClaims();
  } catch (error) { toast(error.message, 'error'); }
}

$('#claims-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-claim-action]');
  if (!button) return;
  if (button.dataset.claimAction === 'edit') editClaim(button.dataset.id);
  if (button.dataset.claimAction === 'delete') deleteClaim(button.dataset.id);
});

function statusClass(status) { return status.toLowerCase().replaceAll(' ', '-'); }

async function loadClaims() {
  const list = $('#claims-list'); list.innerHTML = '<div class="empty">Loading notifications…</div>';
  try {
    claimCache = await SecureLife.api('/accidents');
    list.innerHTML = claimCache.length ? claimCache.map((n) => `<article class="claim-card"><div class="record-head"><div><span class="reference">${escapeHtml(n.reference_number)}</span><h3>${escapeHtml(n.registration_number)} · ${escapeHtml(n.vehicle_type)}</h3></div><span class="status-pill ${statusClass(n.status)}">${escapeHtml(n.status)}</span></div><div class="claim-summary"><span><b>Incident type</b>${escapeHtml(n.incident_type)}</span><span><b>Incident date</b>${formatDate(n.incident_at, true)}</span><span><b>Submitted</b>${formatDate(n.submitted_at, true)}</span><span><b>Location</b>${escapeHtml(n.accident_location)}</span></div><p>${escapeHtml(n.description)}</p>${n.status === 'Pending' ? `<div class="claim-actions"><button class="btn btn-secondary" data-claim-action="edit" data-id="${n.id}">Edit notification</button><button class="btn btn-danger" data-claim-action="delete" data-id="${n.id}">Delete</button></div>` : '<p class="locked-note">Agent processing has started; this notification is now read-only.</p>'}<details><summary>Status history (${n.history.length})</summary><div class="timeline">${n.history.map((h) => `<div class="timeline-item"><i></i><div><strong>${escapeHtml(h.status)}</strong><span>${formatDate(h.changed_at, true)}</span>${h.note ? `<p>${escapeHtml(h.note)}</p>` : ''}</div></div>`).join('')}</div></details></article>`).join('') : '<div class="empty">You have not reported any vehicle accidents yet.</div>';
  } catch (error) { list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

async function loadReviews() {
  const grid = $('#reviews-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="empty">Loading reviews…</div>';
  try {
    const rows = (await SecureLife.api('/feedback')).filter((item) => item.feedback_type === 'Review');
    grid.innerHTML = rows.length ? rows.map((review) => {
      const initials = review.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('');
      return `<article class="review-card"><div class="review-stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div><h3>${escapeHtml(review.title)}</h3><p>“${escapeHtml(review.message)}”</p><div class="review-author"><span>${escapeHtml(initials)}</span><div><strong>${escapeHtml(review.full_name)}</strong><small>Verified vehicle customer</small></div></div></article>`;
    }).join('') : '<div class="empty">No published reviews yet.</div>';
  } catch (error) { grid.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

initializeComingSoonCards();
initializeReviewsPage();
showPage(location.hash.slice(1) || 'home', false);
