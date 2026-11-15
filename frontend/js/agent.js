const AGENT_TOKEN = 'securelife_agent_token';
const AGENT_USER = 'securelife_agent_user';
const STATUSES = ['Pending', 'Under Review', 'Agent Contacted', 'Processing', 'Approved', 'Rejected', 'Closed'];
const ACTIVE_STATUSES = ['Under Review', 'Agent Contacted', 'Processing'];
const RESOLVED_STATUSES = ['Approved', 'Rejected', 'Closed'];
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const formatDate = (value) => new Intl.DateTimeFormat('en-LK', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value));
const statusClass = (status) => status.toLowerCase().replaceAll(' ', '-');
let notificationCache = [];

async function request(path, options = {}) {
  const token = sessionStorage.getItem(AGENT_TOKEN);
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type':'application/json' } : {}),
      ...(token ? { Authorization:`Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/agent/login') signOut();
    throw new Error(data.message || 'Request failed.');
  }
  return data;
}

function toast(message, error = false) {
  const element = document.createElement('div');
  element.className = `toast ${error ? 'error' : ''}`;
  element.textContent = message;
  $('#toast-zone').append(element);
  setTimeout(() => element.remove(), 4000);
}

function setView(signedIn) {
  $('#agent-login-panel').classList.toggle('hidden', signedIn);
  $('#agent-dashboard').classList.toggle('hidden', !signedIn);
  $('#agent-logout').classList.toggle('hidden', !signedIn);
  if (signedIn) {
    const agent = JSON.parse(sessionStorage.getItem(AGENT_USER) || '{}');
    $('#agent-welcome').textContent = `Signed in as ${agent.fullName || 'Insurance Agent'}`;
    loadNotifications();
  }
}

function signOut() {
  sessionStorage.removeItem(AGENT_TOKEN);
  sessionStorage.removeItem(AGENT_USER);
  notificationCache = [];
  setView(false);
}

function updateMetrics(rows) {
  $('#metric-total').textContent = rows.length;
  $('#metric-pending').textContent = rows.filter((row) => row.status === 'Pending').length;
  $('#metric-active').textContent = rows.filter((row) => ACTIVE_STATUSES.includes(row.status)).length;
  $('#metric-resolved').textContent = rows.filter((row) => RESOLVED_STATUSES.includes(row.status)).length;
}

function contactTarget(notification) {
  const deadline = new Date(new Date(notification.submitted_at).getTime() + (24 * 60 * 60 * 1000));
  const overdue = notification.status === 'Pending' && deadline < new Date();
  return `<span class="contact-target ${overdue ? 'overdue' : ''}">${overdue ? 'Contact overdue' : 'Contact by'} ${formatDate(deadline)}</span>`;
}

function historyMarkup(history) {
  return history.map((item) => `<div class="timeline-item"><i></i><div><strong>${escapeHtml(item.status)}</strong><span>${formatDate(item.changed_at)}${item.agent_name ? ` · ${escapeHtml(item.agent_name)}` : ''}</span>${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}</div></div>`).join('');
}

function notificationMarkup(notification) {
  return `<article class="agent-card" data-notification-id="${notification.id}">
    <div class="record-head">
      <div><span class="reference">${escapeHtml(notification.reference_number)}</span><h2>${escapeHtml(notification.registration_number)} · ${escapeHtml(notification.incident_type)}</h2>${contactTarget(notification)}</div>
      <span class="status-pill ${statusClass(notification.status)}">${escapeHtml(notification.status)}</span>
    </div>
    <div class="agent-card-grid">
      <div><b>Customer</b>${escapeHtml(notification.full_name)}<br><a href="mailto:${escapeHtml(notification.email)}">${escapeHtml(notification.email)}</a><br><a href="tel:${escapeHtml(notification.contact_number)}">${escapeHtml(notification.contact_number)}</a></div>
      <div><b>Vehicle</b>${escapeHtml(notification.vehicle_type)}<br>${escapeHtml(notification.registration_number)}</div>
      <div><b>Incident</b>${formatDate(notification.incident_at)}<br>${escapeHtml(notification.accident_location)}</div>
      <div><b>Assigned agent</b>${escapeHtml(notification.assigned_agent_name || 'Not assigned')}</div>
    </div>
    <div class="agent-description"><b>Customer description</b><p>${escapeHtml(notification.description)}</p></div>
    ${notification.photos.length ? `<h3>Accident photos</h3><div class="agent-photos">${notification.photos.map((photo) => `<img data-photo-id="${photo.id}" alt="${escapeHtml(photo.original_name)}">`).join('')}</div>` : '<p class="small-note">No accident photos were uploaded.</p>'}
    <details class="agent-history"><summary>Status history (${notification.history.length})</summary><div class="timeline">${historyMarkup(notification.history)}</div></details>
    <form class="status-form" data-id="${notification.id}">
      <label><span>New status</span><select name="status" required>${STATUSES.map((status) => `<option ${status === notification.status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
      <label><span>Note visible to customer</span><input name="note" maxlength="500" placeholder="Explain the update or next step"></label>
      <button class="btn btn-primary" type="submit">Save update</button>
    </form>
    <div class="agent-quick-actions"><button class="btn btn-success" type="button" data-quick-status="Approved">Approve claim</button><button class="btn btn-danger" type="button" data-quick-status="Rejected">Reject claim</button></div>
  </article>`;
}

function renderNotifications() {
  const search = $('#agent-search').value.trim().toLowerCase();
  const status = $('#agent-status-filter').value;
  const rows = notificationCache.filter((row) => {
    const searchable = [row.reference_number, row.full_name, row.email, row.registration_number].join(' ').toLowerCase();
    return (!search || searchable.includes(search)) && (!status || row.status === status);
  });
  const list = $('#agent-notifications');
  list.innerHTML = rows.length ? rows.map(notificationMarkup).join('') : '<div class="empty">No claims match the selected filters.</div>';
  list.querySelectorAll('img[data-photo-id]').forEach((image) => loadPhoto(image.dataset.photoId, image));
}

async function loadPhoto(photoId, image) {
  try {
    const response = await fetch(`/api/accident-photos/${photoId}`, { headers:{ Authorization:`Bearer ${sessionStorage.getItem(AGENT_TOKEN)}` } });
    if (response.ok) image.src = URL.createObjectURL(await response.blob());
    else image.remove();
  } catch {
    image.remove();
  }
}

async function loadNotifications() {
  const list = $('#agent-notifications');
  list.innerHTML = '<div class="empty">Loading notifications…</div>';
  try {
    notificationCache = await request('/agent/notifications');
    updateMetrics(notificationCache);
    renderNotifications();
  } catch (error) {
    list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

async function updateStatus(id, status, note, button) {
  if (status === 'Rejected' && !note.trim()) {
    toast('Add a customer-visible reason before rejecting this claim.', true);
    return;
  }
  button.disabled = true;
  try {
    const result = await request(`/agent/notifications/${id}/status`, { method:'PATCH', body:JSON.stringify({ status, note }) });
    toast(result.message);
    await loadNotifications();
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
  }
}

$('#agent-login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  const alert = $('#agent-alert');
  button.disabled = true;
  alert.className = 'alert hidden';
  try {
    const result = await request('/agent/login', { method:'POST', body:JSON.stringify(Object.fromEntries(new FormData(form))) });
    sessionStorage.setItem(AGENT_TOKEN, result.token);
    sessionStorage.setItem(AGENT_USER, JSON.stringify(result.agent));
    form.reset();
    setView(true);
  } catch (error) {
    alert.textContent = error.message;
    alert.className = 'alert error';
  } finally {
    button.disabled = false;
  }
});

$('#agent-logout').addEventListener('click', signOut);
$('#refresh-agent').addEventListener('click', loadNotifications);
$('#agent-search').addEventListener('input', renderNotifications);
$('#agent-status-filter').addEventListener('change', renderNotifications);
$('#agent-notifications').addEventListener('submit', (event) => {
  const form = event.target.closest('.status-form');
  if (!form) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  updateStatus(form.dataset.id, data.status, data.note, form.querySelector('button'));
});
$('#agent-notifications').addEventListener('click', (event) => {
  const button = event.target.closest('[data-quick-status]');
  if (!button) return;
  const card = button.closest('.agent-card');
  const form = card.querySelector('.status-form');
  const note = form.elements.note.value;
  const status = button.dataset.quickStatus;
  updateStatus(form.dataset.id, status, note || (status === 'Approved' ? 'Your vehicle claim has been approved.' : ''), button);
});

setView(Boolean(sessionStorage.getItem(AGENT_TOKEN)));
