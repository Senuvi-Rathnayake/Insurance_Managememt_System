if (SecureLife.getToken()) location.replace('/app.html');
SecureLife.setupPasswordToggles();

const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const alertBox = document.querySelector('#alert');

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;
    const button = loginForm.querySelector('button[type="submit"]');
    alertBox.classList.add('hidden');
    SecureLife.setBusy(button, true, 'Signing in…');
    try {
      const result = await SecureLife.api('/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(loginForm))) });
      SecureLife.setSession(result.token, result.user);
      location.replace('/app.html');
    } catch (error) {
      SecureLife.showAlert(alertBox, error.message);
    } finally {
      SecureLife.setBusy(button, false);
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertBox.classList.add('hidden');
    if (!registerForm.reportValidity()) return;
    if (registerForm.password.value !== registerForm.confirmPassword.value) {
      SecureLife.showAlert(alertBox, 'Passwords do not match.');
      return;
    }
    const button = registerForm.querySelector('button[type="submit"]');
    SecureLife.setBusy(button, true, 'Creating account…');
    try {
      const result = await SecureLife.api('/auth/register', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(registerForm))) });
      SecureLife.showAlert(alertBox, result.message, 'success');
      registerForm.reset();
      setTimeout(() => location.replace('/login.html'), 1200);
    } catch (error) {
      SecureLife.showAlert(alertBox, error.message);
    } finally {
      SecureLife.setBusy(button, false);
    }
  });
}
