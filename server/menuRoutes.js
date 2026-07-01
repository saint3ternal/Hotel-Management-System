// ============================================================
// Menu routes
// ============================================================
// Logged-in customers can browse the digital menu by category
// and view full details of a specific meal.
// ============================================================

const express = require('express');
const { pool } = require('./db');
const { requireAuth } = require('./authMiddleware');

const router = express.Router();

// All menu routes require a logged-in customer
router.use(requireAuth);

// ------------------------------------------------------------
// GET /api/menu
// Returns all categories with their items (the full digital menu)
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const [categories] = await pool.query(
      'SELECT category_id, name FROM menu_categories ORDER BY display_order'
    );

    const [items] = await pool.query(
      `SELECT item_id, category_id, name, description, price, image_url,
              is_available, is_vegetarian, spice_level
       FROM menu_items
       WHERE is_available = TRUE
       ORDER BY name`
    );

    const menu = categories.map(cat => ({
      categoryId: cat.category_id,
      name: cat.name,
      items: items
        .filter(item => item.category_id === cat.category_id)
        .map(formatItem)
    }));

    res.json({ success: true, menu });
  } catch (err) {
    console.error('Get menu error:', err);
    res.status(500).json({ success: false, message: 'Could not load menu.' });
  }
});

// ------------------------------------------------------------
// GET /api/menu/item/:id
// Returns full details for one specific meal
// ------------------------------------------------------------
router.get('/item/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id, 10);
    if (Number.isNaN(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid item id.' });
    }

    const [rows] = await pool.query(
      `SELECT mi.item_id, mi.category_id, mc.name AS category_name, mi.name,
              mi.description, mi.price, mi.image_url, mi.is_available,
              mi.is_vegetarian, mi.spice_level
       FROM menu_items mi
       JOIN menu_categories mc ON mc.category_id = mi.category_id
       WHERE mi.item_id = ?`,
      [itemId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }

    res.json({ success: true, item: formatItem(rows[0], rows[0].category_name) });
  } catch (err) {
    console.error('Get item error:', err);
    res.status(500).json({ success: false, message: 'Could not load item.' });
  }
});

function formatItem(item, categoryName) {
  return {
    id: item.item_id,
    categoryId: item.category_id,
    categoryName: categoryName,
    name: item.name,
    description: item.description,
    price: Number(item.price),
    imageUrl: item.image_url,
    isAvailable: !!item.is_available,
    isVegetarian: !!item.is_vegetarian,
    spiceLevel: item.spice_level
  };
}

module.exports = router;
