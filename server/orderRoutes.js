// ============================================================
// Order routes — PostgreSQL (postgres.js) edition
// ============================================================
 
const express = require('express');
const { sql } = require('./db');
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
 
  try {
    const resultOrder = await sql.begin(async sql => {
      const itemIds = items.map(l => l.itemId);
 
      // Array mapping corrected using ${sql(itemIds)} without parenthesized wraps
      const menuRows = await sql`
        SELECT item_id, price, is_available FROM menu_items WHERE item_id IN ${sql(itemIds)}
      `;
 
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
 
      const [orderRes] = await sql`
        INSERT INTO orders (customer_id, total_amount, notes)
        VALUES (${customerId}, ${total}, ${notes || null})
        RETURNING order_id
      `;
      const orderId = orderRes.order_id;
 
      for (const li of lineItems) {
        await sql`
          INSERT INTO order_items (order_id, item_id, quantity, unit_price, subtotal)
          VALUES (${orderId}, ${li.itemId}, ${li.quantity}, ${li.unitPrice}, ${li.subtotal})
        `;
      }

      return { orderId, total, lineItemsCount: lineItems.length };
    });
 
    res.status(201).json({
      success: true,
      message: 'Order placed successfully.',
      order: { 
        orderId: resultOrder.orderId, 
        total: Number(resultOrder.total.toFixed(2)), 
        itemCount: resultOrder.lineItemsCount 
      }
    });
  } catch (err) {
    console.error('Place order error:', err);
    res.status(400).json({ success: false, message: err.message || 'Could not place order.' });
  }
});
 
// ------------------------------------------------------------
// GET /api/orders  — customer's own order history
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const customerId = req.session.customerId;
 
    const orders = await sql`
      SELECT order_id, total_amount, status, notes, created_at
      FROM orders
      WHERE customer_id = ${customerId}
      ORDER BY created_at DESC
    `;
 
    if (orders.length === 0) {
      return res.json({ success: true, orders: [] });
    }

    const targetOrderIds = orders.map(o => o.order_id);

    // Array mapping corrected using ${sql(targetOrderIds)}
    const orderItems = await sql`
      SELECT oi.order_id, oi.quantity, oi.unit_price, oi.subtotal, mi.name
      FROM order_items oi
      JOIN menu_items mi ON mi.item_id = oi.item_id
      WHERE oi.order_id IN ${sql(targetOrderIds)}
    `;
 
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
