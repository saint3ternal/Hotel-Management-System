// ============================================================
// Auth screen logic — tab switching, login, register
// ============================================================

function setFormMessage(elId, message, type) {
  const el = document.getElementById(elId);
  el.textContent = message || '';
  el.classList.remove('error', 'success');
  if (message) el.classList.add(type === 'success' ? 'success' : 'error');
}

function initAuthTabs() {
  const tabs = document.querySelectorAll('.form-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`${tab.dataset.tab}Form`).classList.add('active');
      setFormMessage('loginMessage', '');
      setFormMessage('registerMessage', '');
    });
  });
}

function clientValidatePassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

function initLoginForm(onLoginSuccess) {
  const form = document.getElementById('loginForm');
  const submitBtn = document.getElementById('loginSubmit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFormMessage('loginMessage', '');

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      setFormMessage('loginMessage', 'Please enter both email and password.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    try {
      const data = await API.post('/auth/login', { email, password });
      if (data.success) {
        onLoginSuccess(data.customer);
      } else {
        setFormMessage('loginMessage', data.message || 'Login failed.', 'error');
      }
    } catch (err) {
      setFormMessage('loginMessage', 'Could not reach the server. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });
}

function initRegisterForm() {
  const form = document.getElementById('registerForm');
  const submitBtn = document.getElementById('registerSubmit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFormMessage('registerMessage', '');

    const fullName = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!fullName || !email || !phone || !password) {
      setFormMessage('registerMessage', 'Please fill in every field.', 'error');
      return;
    }

    const pwError = clientValidatePassword(password);
    if (pwError) {
      setFormMessage('registerMessage', pwError, 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';

    try {
      const data = await API.post('/auth/register', { fullName, email, phone, password });
      if (data.success) {
        setFormMessage('registerMessage', 'Account created! You can sign in now.', 'success');
        form.reset();
        setTimeout(() => {
          document.querySelector('.form-tab[data-tab="login"]').click();
          document.getElementById('loginEmail').value = email;
        }, 900);
      } else {
        setFormMessage('registerMessage', data.message || 'Registration failed.', 'error');
      }
    } catch (err) {
      setFormMessage('registerMessage', 'Could not reach the server. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  });
}
