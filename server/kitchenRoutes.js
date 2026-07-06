// ============================================================
// Kitchen dashboard API routes
// ============================================================
// GET  /api/kitchen/orders        — all orders (non-cancelled),
//                                   with full meal line items,
//                                   customer name, elapsed time
// PATCH /api/kitchen/orders/:id/status — advance order status
// GET  /api/kitchen/stats         — live summary counts
// POST /api/kitchen/auth          — staff PIN login
// POST /api/kitchen/auth/logout   — staff logout
// GET  /api/kitchen/auth/session  — check staff session
// ============================================================
 
const express = require('express');
const { sql } = require('./db');
const { requireStaff, staffLogin, staffLogout } = require('./kitchenMiddleware');
 
const router = express.Router();
 
const STATUS_ORDER = ['pending', 'confirmed', 'preparing', 'served', 'cancelled'];
 
// ------------------------------------------------------------
// Auth endpoints (no requireStaff guard — these ARE the gate)
// ------------------------------------------------------------
router.post('/auth', staffLogin);
router.post('/auth/logout', staffLogout);
router.get('/auth/session', (req, res) => {
  res.json({ isStaff: !!(req.session && req.session.isStaff) });
});
 
// All routes below this line require staff session
router.use(requireStaff);
 
// ------------------------------------------------------------
// GET /api/kitchen/orders
// Returns all active orders (pending, confirmed, preparing, served)
// Each order includes: customer name, notes, created_at, elapsed
// seconds, status, and the full list of ordered meal items with
// their image URLs so the card can render them.
// ------------------------------------------------------------
router.get('/orders', async (req, res) => {
  try {
    const orders = await sql`
      SELECT
        o.order_id,
        o.status,
        o.total_amount,
        o.notes,
        o.created_at,
        c.full_name AS customer_name,
        EXTRACT(EPOCH FROM (NOW() - o.created_at))::int AS elapsed_seconds
      FROM orders o
      JOIN customers c ON c.customer_id = o.customer_id
      WHERE o.status != 'cancelled'
      ORDER BY o.created_at ASC
    `;
 
    if (orders.length === 0) {
      return res.json({ success: true, orders: [] });
    }
 
    const orderIds = orders.map(o => o.order_id);
 
    const lines = await sql`
      SELECT
        oi.order_id,
        oi.quantity,
        oi.unit_price,
        oi.subtotal,
        mi.item_id,
        mi.name AS meal_name,
        mi.image_url,
        mi.spice_level,
        mi.is_vegetarian,
        mc.name AS category_name
      FROM order_items oi
      JOIN menu_items mi ON mi.item_id = oi.item_id
      JOIN menu_categories mc ON mc.category_id = mi.category_id
      WHERE oi.order_id = ANY(${orderIds})
      ORDER BY mc.display_order, mi.name
    `;
 
    const linesByOrder = new Map();
    lines.forEach(line => {
      if (!linesByOrder.has(line.order_id)) linesByOrder.set(line.order_id, []);
      linesByOrder.get(line.order_id).push({
        itemId: line.item_id,
        mealName: line.meal_name,
        imageUrl: line.image_url,
        category: line.category_name,
        quantity: line.quantity,
        unitPrice: Number(line.unit_price),
        subtotal: Number(line.subtotal),
        spiceLevel: line.spice_level,
        isVegetarian: !!line.is_vegetarian
      });
    });
 
    const result = orders.map(o => ({
      orderId: o.order_id,
      status: o.status,
      total: Number(o.total_amount),
      notes: o.notes,
      createdAt: o.created_at,
      elapsedSeconds: o.elapsed_seconds,
      customerName: o.customer_name,
      items: linesByOrder.get(o.order_id) || []
    }));
 
    res.json({ success: true, orders: result });
  } catch (err) {
    console.error('Kitchen orders error:', err);
    res.status(500).json({ success: false, message: 'Could not load orders.' });
  }
});
 
// ------------------------------------------------------------
// PATCH /api/kitchen/orders/:id/status
// Body: { status: 'confirmed' | 'preparing' | 'served' | 'cancelled' }
// Only allows valid forward (or cancel) transitions.
// ------------------------------------------------------------
router.patch('/orders/:id/status', async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const { status } = req.body;
 
  if (!Number.isFinite(orderId)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID.' });
  }
  if (!STATUS_ORDER.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid status: ${status}.` });
  }
 
  try {
    const rows = await sql`SELECT status FROM orders WHERE order_id = ${orderId}`;
 
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
 
    const currentIdx = STATUS_ORDER.indexOf(rows[0].status);
    const nextIdx = STATUS_ORDER.indexOf(status);
 
    // Allow forward moves and cancellation from any non-terminal state
    const isForward = nextIdx === currentIdx + 1;
    const isCancel = status === 'cancelled' && rows[0].status !== 'served';
 
    if (!isForward && !isCancel) {
      return res.status(422).json({
        success: false,
        message: `Cannot move order from '${rows[0].status}' to '${status}'.`
      });
    }
 
    await sql`UPDATE orders SET status = ${status} WHERE order_id = ${orderId}`;
 
    res.json({ success: true, orderId, status });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ success: false, message: 'Could not update status.' });
  }
});
 
// ------------------------------------------------------------
// GET /api/kitchen/stats
// Quick counts per status for the header summary bar
// ------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    const rows = await sql`
      SELECT status, COUNT(*) AS cnt
      FROM orders
      WHERE DATE(created_at) = CURRENT_DATE
      GROUP BY status
    `;
 
    const stats = { pending: 0, confirmed: 0, preparing: 0, served: 0, cancelled: 0, total: 0 };
    rows.forEach(r => {
      stats[r.status] = r.cnt;
      stats.total += r.cnt;
    });
 
    res.json({ success: true, stats });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Could not load stats.' });
  }
});
 
module.exports = router;
 
