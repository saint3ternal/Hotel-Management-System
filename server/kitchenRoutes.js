// ============================================================
// Kitchen dashboard API routes — PostgreSQL edition
// ============================================================
// Key changes from MySQL version:
//  - $1..$n placeholders
//  - EXTRACT(EPOCH FROM ...) instead of TIMESTAMPDIFF
//  - created_at::date = CURRENT_DATE instead of DATE(created_at) = CURDATE()
//  - ANY($1) instead of IN (?)
//  - rows from pool.query() directly (no [rows] destructuring)
// ============================================================

const express = require('express');
const { pool } = require('./db');
const { requireStaff, staffLogin, staffLogout } = require('./kitchenMiddleware');

const router = express.Router();

const STATUS_ORDER = ['pending', 'confirmed', 'preparing', 'served', 'cancelled'];

// Auth endpoints
router.post('/auth', staffLogin);
router.post('/auth/logout', staffLogout);
router.get('/auth/session', (req, res) => {
  res.json({ isStaff: !!(req.session && req.session.isStaff) });
});

router.use(requireStaff);

// ------------------------------------------------------------
// GET /api/kitchen/orders
// ------------------------------------------------------------
router.get('/orders', async (req, res) => {
  try {
    const { rows: orders } = await pool.query(
      `SELECT
         o.order_id,
         o.status,
         o.total_amount,
         o.notes,
         o.created_at,
         c.full_name                                           AS customer_name,
         EXTRACT(EPOCH FROM (NOW() - o.created_at))::int      AS elapsed_seconds
       FROM orders o
       JOIN customers c ON c.customer_id = o.customer_id
       WHERE o.status != 'cancelled'
       ORDER BY o.created_at ASC`
    );

    if (orders.length === 0) {
      return res.json({ success: true, orders: [] });
    }

    const orderIds = orders.map(o => o.order_id);

    const { rows: lines } = await pool.query(
      `SELECT
         oi.order_id,
         oi.quantity,
         oi.unit_price,
         oi.subtotal,
         mi.item_id,
         mi.name        AS meal_name,
         mi.image_url,
         mi.spice_level,
         mi.is_vegetarian,
         mc.name        AS category_name
       FROM order_items oi
       JOIN menu_items mi ON mi.item_id = oi.item_id
       JOIN menu_categories mc ON mc.category_id = mi.category_id
       WHERE oi.order_id = ANY($1)
       ORDER BY mc.display_order, mi.name`,
      [orderIds]
    );

    const linesByOrder = new Map();
    lines.forEach(line => {
      if (!linesByOrder.has(line.order_id)) linesByOrder.set(line.order_id, []);
      linesByOrder.get(line.order_id).push({
        itemId:       line.item_id,
        mealName:     line.meal_name,
        imageUrl:     line.image_url,
        category:     line.category_name,
        quantity:     line.quantity,
        unitPrice:    Number(line.unit_price),
        subtotal:     Number(line.subtotal),
        spiceLevel:   line.spice_level,
        isVegetarian: line.is_vegetarian   // pg returns real boolean
      });
    });

    const result = orders.map(o => ({
      orderId:        o.order_id,
      status:         o.status,
      total:          Number(o.total_amount),
      notes:          o.notes,
      createdAt:      o.created_at,
      elapsedSeconds: o.elapsed_seconds,
      customerName:   o.customer_name,
      items:          linesByOrder.get(o.order_id) || []
    }));

    res.json({ success: true, orders: result });
  } catch (err) {
    console.error('Kitchen orders error:', err);
    res.status(500).json({ success: false, message: 'Could not load orders.' });
  }
});

// ------------------------------------------------------------
// PATCH /api/kitchen/orders/:id/status
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
    const { rows } = await pool.query(
      'SELECT status FROM orders WHERE order_id = $1',
      [orderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const currentIdx = STATUS_ORDER.indexOf(rows[0].status);
    const nextIdx    = STATUS_ORDER.indexOf(status);
    const isForward  = nextIdx === currentIdx + 1;
    const isCancel   = status === 'cancelled' && rows[0].status !== 'served';

    if (!isForward && !isCancel) {
      return res.status(422).json({
        success: false,
        message: `Cannot move order from '${rows[0].status}' to '${status}'.`
      });
    }

    await pool.query(
      'UPDATE orders SET status = $1 WHERE order_id = $2',
      [status, orderId]
    );

    res.json({ success: true, orderId, status });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ success: false, message: 'Could not update status.' });
  }
});

// ------------------------------------------------------------
// GET /api/kitchen/stats
// ------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    // created_at::date = CURRENT_DATE works across all timezones in PG
    const { rows } = await pool.query(
      `SELECT status, COUNT(*)::int AS cnt
       FROM orders
       WHERE created_at::date = CURRENT_DATE
       GROUP BY status`
    );

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