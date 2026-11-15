const TOKEN_KEY = 'securelife_token';
const USER_KEY = 'securelife_user';

function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
function getUser() { try { return JSON.parse(sessionStorage.getItem(USER_KEY)); } catch { return null; } }
function setSession(token, user) { sessionStorage.setItem(TOKEN_KEY, token); sessionStorage.setItem(USER_KEY, JSON.stringify(user)); }
function clearSession() { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); }

async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const headers = { ...(options.body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const response = await fetch(`/api${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.includes('/auth/login')) { clearSession(); location.href = '/login.html'; }
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

function showAlert(element, message, type = 'error') {
  element.textContent = message; element.className = `alert ${type}`; element.classList.remove('hidden');
}

function setBusy(button, busy, label = 'Please wait…') {
  if (busy) { button.dataset.label = button.textContent; button.textContent = label; button.disabled = true; }
  else { button.textContent = button.dataset.label || button.textContent; button.disabled = false; }
}

function setupPasswordToggles() {
  document.querySelectorAll('.toggle-password').forEach((button) => button.addEventListener('click', () => {
    const input = button.previousElementSibling; input.type = input.type === 'password' ? 'text' : 'password'; button.textContent = input.type === 'password' ? 'Show' : 'Hide';
  }));
}

window.SecureLife = { api, getToken, getUser, setSession, clearSession, showAlert, setBusy, setupPasswordToggles };
