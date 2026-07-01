// ============================================================
// App bootstrap — screen switching, session check, logout,
// order history rendering
// ============================================================

function showScreen(name) {
  document.getElementById('authScreen').hidden = name !== 'auth';
  document.getElementById('menuScreen').hidden = name !== 'menu';
  document.getElementById('historyScreen').hidden = name !== 'history';
  document.getElementById('topbarNav').hidden = name === 'auth';
}

function enterApp(customer) {
  document.getElementById('guestGreeting').textContent = `Welcome, ${customer.fullName.split(' ')[0]}`;
  showScreen('menu');
  loadMenu();
}

async function checkSession() {
  const data = await API.get('/auth/session');
  if (data.loggedIn) {
    enterApp(data.customer);
  } else {
    showScreen('auth');
  }
}

async function logout() {
  await API.post('/auth/logout');
  MenuState.ticket.clear();
  showScreen('auth');
  showToast('You have been signed out.');
}

async function loadOrderHistory() {
  const listEl = document.getElementById('historyList');
  listEl.innerHTML = '<p class="history-empty">Loading your orders…</p>';

  const data = await API.get('/orders');
  if (!data.success) {
    listEl.innerHTML = `<p class="history-empty">${data.message || 'Could not load order history.'}</p>`;
    return;
  }

  if (data.orders.length === 0) {
    listEl.innerHTML = '<p class="history-empty">No orders yet. Head to the menu to place your first one.</p>';
    return;
  }

  listEl.innerHTML = '';
  data.orders.forEach(order => {
    const card = document.createElement('div');
    card.className = 'history-card';
    const itemsText = order.items.map(it => `${it.quantity}× ${escapeHtml(it.name)}`).join(', ');
    const date = new Date(order.createdAt).toLocaleString();

    card.innerHTML = `
      <div class="history-card-top">
        <span class="history-order-id">Order #${order.orderId}</span>
        <span class="history-status">${escapeHtml(order.status)}</span>
      </div>
      <p class="history-date">${date}</p>
      <p class="history-items">${itemsText}</p>
      <p class="history-total">${formatMoney(order.total)}</p>
    `;
    listEl.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthTabs();
  initLoginForm(enterApp);
  initRegisterForm();
  initModal();
  initTicket();

  document.getElementById('navLogoutBtn').addEventListener('click', logout);
  document.getElementById('navHistoryBtn').addEventListener('click', () => {
    showScreen('history');
    loadOrderHistory();
  });
  document.getElementById('backToMenuBtn').addEventListener('click', () => showScreen('menu'));

  checkSession();
});
