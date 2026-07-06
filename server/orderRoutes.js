// ============================================================
// Order routes
// ============================================================
// Logged-in customers can place an order (one or more menu
// items + quantities). Orders and their line items are
// persisted to the database, with price calculated server-side
// from the current menu price (never trust client-sent prices).
// ============================================================

const express = require('express');
const { sql } = require('./db');
const { requireAuth } = require('./authMiddleware');

const router = express.Router();

router.use(requireAuth);

// ------------------------------------------------------------
// POST /api/orders
// Body: { items: [{ itemId, quantity }], notes }
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
    const itemIds = items.map(line => line.itemId);

    await sql.begin(async sqlTransaction => {
      const menuRows = await sqlTransaction`
        SELECT item_id, price, is_available
        FROM menu_items
        WHERE item_id = ANY(${itemIds})
      `;

      const priceMap = new Map(menuRows.map(row => [row.item_id, row]));

      let total = 0;
      const lineItemsToInsert = [];

      for (const line of items) {
        const menuItem = priceMap.get(line.itemId);
        if (!menuItem || !menuItem.is_available) {
          throw new Error(`Menu item ${line.itemId} is not available.`);
        }
        const unitPrice = Number(menuItem.price);
        const subtotal = unitPrice * line.quantity;
        total += subtotal;
        lineItemsToInsert.push({ itemId: line.itemId, quantity: line.quantity, unitPrice, subtotal });
      }

      const orderResult = await sqlTransaction`
        INSERT INTO orders (customer_id, total_amount, notes)
        VALUES (${customerId}, ${total}, ${notes || null})
        RETURNING order_id
      `;
      const orderId = orderResult[0].order_id;

      for (const li of lineItemsToInsert) {
        await sqlTransaction`
          INSERT INTO order_items (order_id, item_id, quantity, unit_price, subtotal)
          VALUES (${orderId}, ${li.itemId}, ${li.quantity}, ${li.unitPrice}, ${li.subtotal})
        `;
      }

      res.status(201).json({
        success: true,
        message: 'Order placed successfully.',
        order: { orderId, total: Number(total.toFixed(2)), itemCount: lineItemsToInsert.length }
      });
    });
  } catch (err) {
    console.error('Place order error:', err);
    res.status(400).json({ success: false, message: err.message || 'Could not place order.' });
  }
});

// ------------------------------------------------------------
// GET /api/orders
// Returns the logged-in customer's order history
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

    const orderItems = await sql`
      SELECT oi.order_id, oi.quantity, oi.unit_price, oi.subtotal, mi.name
      FROM order_items oi
      JOIN menu_items mi ON mi.item_id = oi.item_id
      WHERE oi.order_id IN (
        SELECT order_id FROM orders WHERE customer_id = ${customerId}
      )
    `;

    const result = orders.map(order => ({
      orderId: order.order_id,
      total: Number(order.total_amount),
      status: order.status,
      notes: order.notes,
      createdAt: order.created_at,
      items: orderItems
        .filter(oi => oi.order_id === order.order_id)
        .map(oi => ({
          name: oi.name,
          quantity: oi.quantity,
          unitPrice: Number(oi.unit_price),
          subtotal: Number(oi.subtotal)
        }))
    }));

    res.json({ success: true, orders: result });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ success: false, message: 'Could not load order history.' });
  }
});

module.exports = router;
