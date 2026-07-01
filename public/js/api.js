// ============================================================
// API helper — small wrapper around fetch() used by every
// other frontend script. Keeps credentials (session cookie)
// included on every request automatically.
// ============================================================

const API = {
  async request(method, path, body) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const apiBase = window.__API_BASE_URL__ || (
      window.location.port === '3000' ? '' : `${window.location.protocol}//${window.location.hostname}:3000`
    );
    const res = await fetch(`${apiBase}/api${path}`, options);
    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = { success: false, message: 'Unexpected server response.' };
    }
    if (!res.ok && !('success' in data)) {
      data.success = false;
    }
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); }
};

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, duration);
}

function formatMoney(amount) {
  return `$${Number(amount).toFixed(2)}`;
}
