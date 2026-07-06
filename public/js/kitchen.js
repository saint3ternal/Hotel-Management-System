// ============================================================
// Kitchen Dashboard — JS
// ============================================================
// • PIN screen handling
// • 5-second polling for all orders
// • Kanban card rendering with meal images and details
// • Live burn timer (ticks every second, colours based on age)
// • Status advance buttons (Confirm → Prepare → Serve)
//   and Cancel, all via PATCH /api/kitchen/orders/:id/status
// ============================================================
 
// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------
const State = {
  orders: new Map(),       // orderId -> order object
  pollTimer: null,
  tickTimer: null,
  pollErrors: 0,
  pinBuffer: ''
};
 
const POLL_INTERVAL_MS    = 5000;
const TICK_INTERVAL_MS    = 1000;
const WARM_THRESHOLD_SEC  = 10 * 60;  // 10 min → amber
const HOT_THRESHOLD_SEC   = 15 * 60;  // 15 min → orange
const CRITICAL_THRESHOLD_SEC = 20 * 60; // 20 min → red
 
// Status order for advance actions
const STATUS_SEQUENCE = ['pending', 'confirmed', 'preparing', 'served'];
const STATUS_LABELS   = { pending: 'Confirm', confirmed: 'Start cooking', preparing: 'Mark served' };
 
// ----------------------------------------------------------------
// API helpers
// ----------------------------------------------------------------
async function kFetch(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api/kitchen${path}`, opts);
  const data = await res.json().catch(() => ({ success: false, message: 'Bad response' }));
  return data;
}
 
// ----------------------------------------------------------------
// PIN SCREEN
// ----------------------------------------------------------------
function initPinScreen() {
  document.querySelectorAll('.pin-key[data-digit]').forEach(btn => {
    btn.addEventListener('click', () => appendPin(btn.dataset.digit));
  });
  document.getElementById('pinClear').addEventListener('click', clearPin);
  document.getElementById('pinEnter').addEventListener('click', submitPin);
 
  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (document.getElementById('pinScreen').hidden) return;
    if (e.key >= '0' && e.key <= '9') appendPin(e.key);
    else if (e.key === 'Backspace') clearPin();
    else if (e.key === 'Enter') submitPin();
  });
}
 
function appendPin(digit) {
  if (State.pinBuffer.length >= 4) return;
  State.pinBuffer += digit;
  updatePinDots();
  if (State.pinBuffer.length === 4) {
    // Auto-submit when 4 digits entered
    setTimeout(submitPin, 120);
  }
}
 
function clearPin() {
  State.pinBuffer = '';
  updatePinDots();
  document.getElementById('pinError').textContent = '';
  document.getElementById('pinDots').classList.remove('error');
}
 
function updatePinDots() {
  const dots = document.querySelectorAll('#pinDots span');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < State.pinBuffer.length);
  });
}
 
async function submitPin() {
  if (State.pinBuffer.length === 0) return;
  const pin = State.pinBuffer;
  State.pinBuffer = '';
  updatePinDots();
 
  const data = await kFetch('POST', '/auth', { pin });
  if (data.success) {
    enterDashboard();
  } else {
    document.getElementById('pinError').textContent = data.message || 'Incorrect PIN.';
    document.getElementById('pinDots').classList.add('error');
    setTimeout(() => {
      document.getElementById('pinDots').classList.remove('error');
      document.getElementById('pinError').textContent = '';
    }, 800);
  }
}
 
// ----------------------------------------------------------------
// DASHBOARD
// ----------------------------------------------------------------
function enterDashboard() {
  document.getElementById('pinScreen').hidden = true;
  document.getElementById('dashboard').hidden = false;
  startPolling();
  startTicker();
}
 
async function checkExistingSession() {
  const data = await kFetch('GET', '/auth/session');
  if (data.isStaff) {
    enterDashboard();
  }
}
 
// ----------------------------------------------------------------
// POLLING — every 5 seconds
// ----------------------------------------------------------------
function startPolling() {
  fetchOrders();
  fetchStats();
  State.pollTimer = setInterval(() => {
    fetchOrders();
    fetchStats();
  }, POLL_INTERVAL_MS);
}
 
async function fetchOrders() {
  try {
    const data = await kFetch('GET', '/orders');
    if (!data.success) throw new Error(data.message);
 
    State.pollErrors = 0;
    setPollIndicator(true);
    setLastUpdated();
 
    const incoming = new Map(data.orders.map(o => [o.orderId, o]));
    reconcileOrders(incoming);
  } catch (err) {
    State.pollErrors++;
    if (State.pollErrors >= 2) setPollIndicator(false);
    console.error('Poll error:', err);
  }
}
 
async function fetchStats() {
  try {
    const data = await kFetch('GET', '/stats');
    if (!data.success) return;
    const s = data.stats;
    document.getElementById('statPending').textContent   = s.pending;
    document.getElementById('statConfirmed').textContent = s.confirmed;
    document.getElementById('statPreparing').textContent = s.preparing;
    document.getElementById('statServed').textContent    = s.served;
  } catch (e) { /* silently skip */ }
}
 
// ----------------------------------------------------------------
// RECONCILE — diff new orders against state; update / add / remove
// ----------------------------------------------------------------
function reconcileOrders(incoming) {
  // 1. Remove orders no longer in the response (served disappears after some time, etc.)
  State.orders.forEach((_, id) => {
    if (!incoming.has(id)) {
      State.orders.delete(id);
      removeCard(id);
    }
  });
 
  // 2. Add new, move changed
  incoming.forEach((order, id) => {
    const existing = State.orders.get(id);
    if (!existing) {
      // Brand new order
      State.orders.set(id, order);
      addCard(order);
    } else if (existing.status !== order.status) {
      // Status changed — move the card to the new column and flash it
      State.orders.set(id, order);
      moveCard(order);
    } else {
      // Same status — update elapsed seconds stored (for the ticker)
      existing.elapsedSeconds = order.elapsedSeconds;
    }
  });
 
  updateEmptyState();
  updateColumnCounts();
}
 
// ----------------------------------------------------------------
// CARD RENDERING
// ----------------------------------------------------------------
function addCard(order) {
  const card = buildCard(order);
  const col = document.getElementById(`cards-${order.status}`);
  if (!col) return;
  col.prepend(card);
}
 
function moveCard(order) {
  const existing = document.getElementById(`card-${order.orderId}`);
  if (existing) existing.remove();
 
  const card = buildCard(order);
  card.classList.add('flash');
  const col = document.getElementById(`cards-${order.status}`);
  if (col) col.prepend(card);
}
 
function removeCard(orderId) {
  const el = document.getElementById(`card-${orderId}`);
  if (el) el.remove();
}
 
function buildCard(order) {
  const tpl = document.getElementById('orderCardTemplate');
  const card = tpl.content.cloneNode(true).querySelector('.order-card');
 
  card.id = `card-${order.orderId}`;
  card.dataset.orderId  = order.orderId;
  card.dataset.status   = order.status;
  card.dataset.created  = order.createdAt; // ISO string from DB
  card.dataset.elapsed  = order.elapsedSeconds;
 
  card.querySelector('.order-id').textContent = `#${String(order.orderId).padStart(4, '0')}`;
  card.querySelector('.order-customer').textContent = order.customerName;
 
  // Meal items
  const itemsList = card.querySelector('.order-items-list');
  order.items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'order-item-row';
 
    // Image or emoji fallback
    let imgEl;
    if (item.imageUrl) {
      imgEl = document.createElement('img');
      imgEl.className = 'order-item-img';
      imgEl.src = item.imageUrl;
      imgEl.alt = item.mealName;
      imgEl.loading = 'lazy';
      imgEl.onerror = () => {
        imgEl.classList.add('no-img');
        imgEl.outerHTML = `<div class="order-item-img no-img">🍽</div>`;
      };
    } else {
      imgEl = document.createElement('div');
      imgEl.className = 'order-item-img no-img';
      imgEl.textContent = '🍽';
    }
 
    const spiceIcon = item.spiceLevel === 'hot' ? '🌶🌶' : item.spiceLevel === 'medium' ? '🌶' : '';
 
    row.innerHTML = `
      <div class="order-item-info">
        <div class="order-item-name">${escHtml(item.mealName)}</div>
        <div class="order-item-meta">
          <span class="order-item-qty">&times;${item.quantity}</span>
          <span class="order-item-cat">${escHtml(item.category)}</span>
          ${item.isVegetarian ? '<span class="order-item-veg">Veg</span>' : ''}
          ${spiceIcon ? `<span class="order-item-spice">${spiceIcon}</span>` : ''}
        </div>
      </div>
    `;
    row.prepend(imgEl);
    itemsList.appendChild(row);
  });
 
  // Notes
  if (order.notes) {
    const notesEl = card.querySelector('.order-notes');
    notesEl.textContent = `📝 ${order.notes}`;
    notesEl.hidden = false;
  }
 
  card.querySelector('.order-total').textContent = `$${Number(order.total).toFixed(2)}`;
 
  // Burn timer — initial render
  renderTimer(card, order.elapsedSeconds);
 
  // Action buttons
  const actionsEl = card.querySelector('.order-actions');
  const nextStatus = STATUS_SEQUENCE[STATUS_SEQUENCE.indexOf(order.status) + 1];
 
  if (nextStatus && order.status !== 'served') {
    const advBtn = document.createElement('button');
    advBtn.className = `btn-action btn-advance--${order.status}`;
    advBtn.textContent = STATUS_LABELS[order.status] || 'Advance';
    advBtn.addEventListener('click', () => updateStatus(order.orderId, nextStatus, advBtn));
    actionsEl.appendChild(advBtn);
  }
 
  if (order.status !== 'served') {
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-action btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => updateStatus(order.orderId, 'cancelled', cancelBtn));
    actionsEl.appendChild(cancelBtn);
  }
 
  return card;
}
 
// ----------------------------------------------------------------
// BURN TIMER — updates every second on every visible card
// ----------------------------------------------------------------
function startTicker() {
  State.tickTimer = setInterval(tickTimers, TICK_INTERVAL_MS);
}
 
function tickTimers() {
  document.querySelectorAll('.order-card').forEach(card => {
    const current = parseInt(card.dataset.elapsed || '0', 10) + 1;
    card.dataset.elapsed = current;
    const timerEl = card.querySelector('.burn-timer');
    if (timerEl) renderTimer(card, current);
  });
}
 
function renderTimer(card, elapsedSec) {
  const timerEl = card.querySelector('.burn-timer');
  if (!timerEl) return;
  timerEl.textContent = formatElapsed(elapsedSec);
  timerEl.className = 'burn-timer';
  if (elapsedSec >= CRITICAL_THRESHOLD_SEC)  timerEl.classList.add('critical');
  else if (elapsedSec >= HOT_THRESHOLD_SEC)  timerEl.classList.add('hot');
  else if (elapsedSec >= WARM_THRESHOLD_SEC) timerEl.classList.add('warm');
}
 
function formatElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
 
// ----------------------------------------------------------------
// STATUS UPDATE
// ----------------------------------------------------------------
async function updateStatus(orderId, newStatus, btn) {
  btn.disabled = true;
  const data = await kFetch('PATCH', `/orders/${orderId}/status`, { status: newStatus });
 
  if (data.success) {
    const order = State.orders.get(orderId);
    if (order) {
      const elapsed = parseInt(document.getElementById(`card-${orderId}`)?.dataset.elapsed || '0', 10);
      order.status = newStatus;
      order.elapsedSeconds = elapsed;
      if (newStatus === 'cancelled') {
        State.orders.delete(orderId);
        removeCard(orderId);
        showToast(`Order #${String(orderId).padStart(4,'0')} cancelled.`);
      } else {
        moveCard(order);
        showToast(`Order #${String(orderId).padStart(4,'0')} moved to ${newStatus}.`);
      }
    }
    updateEmptyState();
    updateColumnCounts();
    fetchStats();
  } else {
    showToast(data.message || 'Could not update order.', true);
    btn.disabled = false;
  }
}
 
// ----------------------------------------------------------------
// UI HELPERS
// ----------------------------------------------------------------
function updateColumnCounts() {
  ['pending', 'confirmed', 'preparing', 'served'].forEach(status => {
    const col = document.getElementById(`cards-${status}`);
    const count = col ? col.querySelectorAll('.order-card').length : 0;
    const el = document.getElementById(`count-${status}`);
    if (el) el.textContent = count;
  });
}
 
function updateEmptyState() {
  const hasAny = ['pending', 'confirmed', 'preparing', 'served']
    .some(s => document.getElementById(`cards-${s}`)?.querySelector('.order-card'));
  document.getElementById('emptyState').hidden = hasAny;
}
 
function setPollIndicator(ok) {
  const el = document.getElementById('pollIndicator');
  el.classList.toggle('stale', !ok);
  el.querySelector('.poll-label').textContent = ok ? 'Live' : 'Offline';
}
 
function setLastUpdated() {
  const el = document.getElementById('lastUpdated');
  const now = new Date();
  el.textContent = `Updated ${now.toLocaleTimeString()}`;
}
 
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { t.hidden = true; }, 3000);
}
 
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
 
document.getElementById('logoutBtn').addEventListener('click', async () => {
  clearInterval(State.pollTimer);
  clearInterval(State.tickTimer);
  await kFetch('POST', '/auth/logout');
  document.getElementById('dashboard').hidden = true;
  document.getElementById('pinScreen').hidden = false;
  State.orders.clear();
  ['pending','confirmed','preparing','served'].forEach(s => {
    const col = document.getElementById(`cards-${s}`);
    if (col) col.innerHTML = '';
  });
});
 
// ----------------------------------------------------------------
// BOOT
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initPinScreen();
  checkExistingSession();
});