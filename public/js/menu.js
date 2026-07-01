// ============================================================
// Menu screen logic — load digital menu, category filter,
// meal detail modal, and the order ticket (cart)
// ============================================================

const MenuState = {
  categories: [],
  activeCategoryId: 'all',
  ticket: new Map(), // itemId -> { item, quantity }
  currentModalItem: null,
  modalQty: 1
};

async function loadMenu() {
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = '<p class="menu-loading">Setting the table…</p>';

  const data = await API.get('/menu');
  if (!data.success) {
    grid.innerHTML = `<p class="menu-loading">${data.message || 'Could not load the menu.'}</p>`;
    return;
  }

  MenuState.categories = data.menu;
  renderCategoryTabs();
  renderMenuGrid();
}

function renderCategoryTabs() {
  const wrap = document.getElementById('categoryTabs');
  wrap.innerHTML = '';

  const allTab = document.createElement('button');
  allTab.className = 'category-tab' + (MenuState.activeCategoryId === 'all' ? ' active' : '');
  allTab.textContent = 'All';
  allTab.addEventListener('click', () => { MenuState.activeCategoryId = 'all'; renderCategoryTabs(); renderMenuGrid(); });
  wrap.appendChild(allTab);

  MenuState.categories.forEach(cat => {
    const tab = document.createElement('button');
    tab.className = 'category-tab' + (MenuState.activeCategoryId === cat.categoryId ? ' active' : '');
    tab.textContent = cat.name;
    tab.addEventListener('click', () => { MenuState.activeCategoryId = cat.categoryId; renderCategoryTabs(); renderMenuGrid(); });
    wrap.appendChild(tab);
  });
}

function renderMenuGrid() {
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = '';

  let itemsToShow = [];
  MenuState.categories.forEach(cat => {
    if (MenuState.activeCategoryId === 'all' || MenuState.activeCategoryId === cat.categoryId) {
      itemsToShow = itemsToShow.concat(cat.items.map(it => ({ ...it, categoryName: cat.name })));
    }
  });

  if (itemsToShow.length === 0) {
    grid.innerHTML = '<p class="menu-loading">No dishes in this category right now.</p>';
    return;
  }

  itemsToShow.forEach(item => {
    const card = document.createElement('div');
    card.className = 'meal-card';
    card.innerHTML = `
      <img class="meal-card-img" src="${item.imageUrl || ''}" alt="${escapeHtml(item.name)}" loading="lazy">
      <div class="meal-card-body">
        <h3 class="meal-card-name">${escapeHtml(item.name)}</h3>
        <p class="meal-card-desc">${escapeHtml(item.description || '')}</p>
        <div class="meal-card-footer">
          <span class="meal-card-price">${formatMoney(item.price)}</span>
          ${item.isVegetarian ? '<span class="meal-card-veg">Veg</span>' : ''}
        </div>
      </div>
    `;
    card.addEventListener('click', () => openMealModal(item.id));
    grid.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ------------------------------------------------------------
// MEAL DETAIL MODAL
// ------------------------------------------------------------
async function openMealModal(itemId) {
  const data = await API.get(`/menu/item/${itemId}`);
  if (!data.success) {
    showToast(data.message || 'Could not load that dish.');
    return;
  }

  const item = data.item;
  MenuState.currentModalItem = item;
  MenuState.modalQty = 1;

  document.getElementById('modalImage').src = item.imageUrl || '';
  document.getElementById('modalImage').alt = item.name;
  document.getElementById('modalVegTag').hidden = !item.isVegetarian;
  document.getElementById('modalCategory').textContent = item.categoryName;
  document.getElementById('modalName').textContent = item.name;
  document.getElementById('modalDescription').textContent = item.description || '';
  document.getElementById('modalSpice').textContent = `${capitalize(item.spiceLevel)} spice`;
  document.getElementById('modalPrice').textContent = formatMoney(item.price);
  document.getElementById('qtyValue').textContent = '1';

  document.getElementById('mealModal').hidden = false;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function closeMealModal() {
  document.getElementById('mealModal').hidden = true;
  MenuState.currentModalItem = null;
}

function initModal() {
  document.getElementById('modalClose').addEventListener('click', closeMealModal);
  document.getElementById('mealModal').addEventListener('click', (e) => {
    if (e.target.id === 'mealModal') closeMealModal();
  });

  document.getElementById('qtyMinus').addEventListener('click', () => {
    if (MenuState.modalQty > 1) {
      MenuState.modalQty--;
      document.getElementById('qtyValue').textContent = MenuState.modalQty;
    }
  });
  document.getElementById('qtyPlus').addEventListener('click', () => {
    MenuState.modalQty++;
    document.getElementById('qtyValue').textContent = MenuState.modalQty;
  });

  document.getElementById('modalAddBtn').addEventListener('click', () => {
    if (!MenuState.currentModalItem) return;
    addToTicket(MenuState.currentModalItem, MenuState.modalQty);
    showToast(`Added ${MenuState.modalQty} × ${MenuState.currentModalItem.name} to your ticket.`);
    closeMealModal();
  });
}

// ------------------------------------------------------------
// ORDER TICKET (cart)
// ------------------------------------------------------------
function addToTicket(item, quantity) {
  const existing = MenuState.ticket.get(item.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    MenuState.ticket.set(item.id, { item, quantity });
  }
  renderTicket();
}

function removeFromTicket(itemId) {
  MenuState.ticket.delete(itemId);
  renderTicket();
}

function renderTicket() {
  const linesEl = document.getElementById('ticketLines');
  const totalEl = document.getElementById('ticketTotal');
  const placeBtn = document.getElementById('placeOrderBtn');

  if (MenuState.ticket.size === 0) {
    linesEl.innerHTML = '<p class="ticket-empty">No items yet. Tap a dish to add it.</p>';
    totalEl.textContent = formatMoney(0);
    placeBtn.disabled = true;
    return;
  }

  linesEl.innerHTML = '';
  let total = 0;

  MenuState.ticket.forEach(({ item, quantity }) => {
    const subtotal = item.price * quantity;
    total += subtotal;

    const line = document.createElement('div');
    line.className = 'ticket-line';
    line.innerHTML = `
      <span class="ticket-line-qty">${quantity}×</span>
      <span class="ticket-line-name">${escapeHtml(item.name)}</span>
      <span class="ticket-line-price">${formatMoney(subtotal)}</span>
      <button class="ticket-line-remove" aria-label="Remove">&times;</button>
    `;
    line.querySelector('.ticket-line-remove').addEventListener('click', () => removeFromTicket(item.id));
    linesEl.appendChild(line);
  });

  totalEl.textContent = formatMoney(total);
  placeBtn.disabled = false;
}

async function placeOrder() {
  const placeBtn = document.getElementById('placeOrderBtn');
  const notes = document.getElementById('orderNotes').value.trim();
  setFormMessage('orderMessage', '');

  if (MenuState.ticket.size === 0) return;

  const items = Array.from(MenuState.ticket.values()).map(({ item, quantity }) => ({
    itemId: item.id,
    quantity
  }));

  placeBtn.disabled = true;
  placeBtn.textContent = 'Sending…';

  try {
    const data = await API.post('/orders', { items, notes });
    if (data.success) {
      showToast(`Order #${data.order.orderId} sent to the kitchen — ${formatMoney(data.order.total)}.`, 4000);
      MenuState.ticket.clear();
      document.getElementById('orderNotes').value = '';
      renderTicket();
    } else {
      setFormMessage('orderMessage', data.message || 'Could not place order.', 'error');
    }
  } catch (err) {
    setFormMessage('orderMessage', 'Could not reach the server. Please try again.', 'error');
  } finally {
    placeBtn.disabled = MenuState.ticket.size === 0;
    placeBtn.textContent = 'Send to kitchen';
  }
}

function initTicket() {
  document.getElementById('placeOrderBtn').addEventListener('click', placeOrder);
}
