// ============================================================
// Order routes — PostgreSQL edition
// ============================================================
// Key differences from MySQL version:
//  - $1..$n placeholders instead of ?
//  - pool.connect() + client.query() for transactions
//  - ANY($1) instead of IN (?) for array membership
//  - RETURNING order_id instead of result.insertId
// ============================================================
 
const express = require('express');
const { pool } = require('./db');
const { requireAuth } = require('./authMiddleware');
 
const router = express.Router();
router.use(requireAuth);
 
// ------------------------------------------------------------
// POST /api/orders
// ------------------------------------------------------------
router.post('/', async (req, res) => {
  const { items, notes } = req.body;
  const customerId = req.session.customerId;
 
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Order must contain at least one item.' });
  }
 
  for (const line of items) {
    if (!line.itemId || !line.quantity || line.quantity < 1) {
      return res.status(400).json({ success: false, message: 'Each order line needs a valid itemId and quantity.' });
    }
  }
 
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
 
    const itemIds = items.map(l => l.itemId);
 
    // ANY($1) with a JS array works natively in pg
    const { rows: menuRows } = await client.query(
      'SELECT item_id, price, is_available FROM menu_items WHERE item_id = ANY($1)',
      [itemIds]
    );
 
    const priceMap = new Map(menuRows.map(row => [row.item_id, row]));
 
    let total = 0;
    const lineItems = [];
 
    for (const line of items) {
      const menuItem = priceMap.get(line.itemId);
      if (!menuItem || !menuItem.is_available) {
        throw new Error(`Menu item ${line.itemId} is not available.`);
      }
      const unitPrice = Number(menuItem.price);
      const subtotal  = unitPrice * line.quantity;
      total += subtotal;
      lineItems.push({ itemId: line.itemId, quantity: line.quantity, unitPrice, subtotal });
    }
 
    const orderRes = await client.query(
      `INSERT INTO orders (customer_id, total_amount, notes)
       VALUES ($1, $2, $3)
       RETURNING order_id`,
      [customerId, total, notes || null]
    );
    const orderId = orderRes.rows[0].order_id;
 
    for (const li of lineItems) {
      await client.query(
        `INSERT INTO order_items (order_id, item_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, li.itemId, li.quantity, li.unitPrice, li.subtotal]
      );
    }
 
    await client.query('COMMIT');
 
    res.status(201).json({
      success: true,
      message: 'Order placed successfully.',
      order: { orderId, total: Number(total.toFixed(2)), itemCount: lineItems.length }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Place order error:', err);
    res.status(400).json({ success: false, message: err.message || 'Could not place order.' });
  } finally {
    client.release();
  }
});
 
// ------------------------------------------------------------
// GET /api/orders  — customer's own order history
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const customerId = req.session.customerId;
 
    const { rows: orders } = await pool.query(
      `SELECT order_id, total_amount, status, notes, created_at
       FROM orders
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [customerId]
    );
 
    const { rows: orderItems } = await pool.query(
      `SELECT oi.order_id, oi.quantity, oi.unit_price, oi.subtotal, mi.name
       FROM order_items oi
       JOIN menu_items mi ON mi.item_id = oi.item_id
       WHERE oi.order_id IN (
         SELECT order_id FROM orders WHERE customer_id = $1
       )`,
      [customerId]
    );
 
    const result = orders.map(order => ({
      orderId:   order.order_id,
      total:     Number(order.total_amount),
      status:    order.status,
      notes:     order.notes,
      createdAt: order.created_at,
      items: orderItems
        .filter(oi => oi.order_id === order.order_id)
        .map(oi => ({
          name:       oi.name,
          quantity:   oi.quantity,
          unitPrice:  Number(oi.unit_price),
          subtotal:   Number(oi.subtotal)
        }))
    }));
 
    res.json({ success: true, orders: result });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ success: false, message: 'Could not load order history.' });
  }
});
 
module.exports = router;
 


