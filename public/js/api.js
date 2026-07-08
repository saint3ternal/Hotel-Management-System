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

    // API is served from the same origin as the frontend (server.js serves
    // both). Only override this if you deliberately point at a different
    // API host by setting window.__API_BASE_URL__ before this script loads.
    const apiBase = window.__API_BASE_URL__ || '';

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