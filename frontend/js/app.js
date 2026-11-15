if (!SecureLife.getToken()) location.replace('/login.html');

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const money = (value) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(value);
const date = (value) => new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium' }).format(new Date(value));
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));

const user = SecureLife.getUser();
if (user?.fullName) $('#user-name').textContent = user.fullName.split(' ')[0];
$('#incidentDate').max = new Date().toISOString().split('T')[0];

function toast(message, type = '') {
  const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message; $('#toast-zone').append(el); setTimeout(() => el.remove(), 4200);
}

async function showPage(page, updateHash = true) {
  if (!document.querySelector(`#page-${page}`)) page = 'home';
  $$('.app-section').forEach((section) => section.classList.toggle('active', section.id === `page-${page}`));
  $$('.nav-link').forEach((link) => link.classList.toggle('active', link.dataset.page === page));
  $('#nav-links').classList.remove('open');
  if (updateHash) history.replaceState(null, '', `#${page}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (page === 'claims') await loadClaims();
  if (page === 'payments') await loadPayments();
  if (page === 'feedback') await loadFeedback();
}

document.addEventListener('click', (event) => { const target = event.target.closest('[data-page]'); if (target) { event.preventDefault(); showPage(target.dataset.page); } });
$('#menu-toggle').addEventListener('click', () => $('#nav-links').classList.toggle('open'));
$('#logout').addEventListener('click', () => { SecureLife.clearSession(); location.replace('/login.html'); });

function wireForm(selector, path, success, after) {
  $(selector).addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
    const button = form.querySelector('button[type=submit]'); SecureLife.setBusy(button, true, 'Submitting…');
    try {
      const body = Object.fromEntries(new FormData(form));
      const result = await SecureLife.api(path, { method: 'POST', body: JSON.stringify(body) });
      toast(result.message); form.reset(); if (after) await after(result);
    } catch (error) { toast(error.message, 'error'); } finally { SecureLife.setBusy(button, false); }
  });
}

wireForm('#contact-form', '/inquiries');
wireForm('#claim-form', '/claims', null, async () => showPage('claims'));
wireForm('#payment-form', '/payments', null, loadPayments);
wireForm('#feedback-form', '/feedback', null, loadFeedback);

$('#feedbackType').addEventListener('change', (event) => {
  const review = event.target.value === 'Review'; $('#rating-field').classList.toggle('hidden', !review); $$('#rating-field input').forEach((input) => input.required = review);
});
$$('#rating-field input').forEach((input) => input.required = true);

async function loadClaims() {
  const list = $('#claims-list');
  try {
    const rows = await SecureLife.api('/claims');
    list.innerHTML = rows.length ? rows.map((c) => `<article class="record"><div class="record-head"><div><h3>Claim #${c.id} · ${escapeHtml(c.claim_type)}</h3><p>Policy ${escapeHtml(c.policy_number)} · Incident ${date(c.incident_date)}</p></div><span class="badge ${c.status === 'Submitted' ? 'pending' : ''}">${escapeHtml(c.status)}</span></div><p>${escapeHtml(c.description)}</p><div class="record-head"><p>Submitted ${date(c.created_at)}</p><span class="amount">${money(c.estimated_amount)}</span></div></article>`).join('') : '<div class="empty">You have not submitted any claims yet.</div>';
  } catch (error) { list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

async function loadPayments() {
  const list = $('#payments-list');
  try {
    const rows = await SecureLife.api('/payments');
    list.innerHTML = rows.length ? rows.map((p) => `<article class="record"><div class="record-head"><div><h3>${escapeHtml(p.policy_number)}</h3><p>${escapeHtml(p.reference_number)}</p></div><span class="badge">${escapeHtml(p.status)}</span></div><div class="record-head"><p>${date(p.paid_at)} · ${escapeHtml(p.payment_method)}</p><span class="amount">${money(p.amount)}</span></div></article>`).join('') : '<div class="empty">No payments recorded yet.</div>';
  } catch (error) { list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

async function loadFeedback() {
  const list = $('#feedback-list');
  try {
    const rows = await SecureLife.api('/feedback');
    list.innerHTML = rows.length ? rows.map((f) => `<article class="record"><div class="record-head"><div><h3>${escapeHtml(f.title)}</h3><p>${escapeHtml(f.full_name)} · ${date(f.created_at)}</p></div><span class="badge ${f.feedback_type === 'Complaint' ? 'pending' : ''}">${escapeHtml(f.feedback_type)}</span></div>${f.rating ? `<div class="stars">${'★'.repeat(f.rating)}${'☆'.repeat(5-f.rating)}</div>` : ''}<p>${escapeHtml(f.message)}</p>${f.feedback_type === 'Complaint' ? `<p>Status: ${escapeHtml(f.status)}</p>` : ''}</article>`).join('') : '<div class="empty">No feedback has been submitted yet.</div>';
  } catch (error) { list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

showPage(location.hash.slice(1) || 'home', false);
