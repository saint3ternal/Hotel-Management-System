-- ============================================================
-- Hotel Management System — PostgreSQL Schema
-- ============================================================
-- Run once against your Postgres database:
--
--   psql "$DATABASE_URL" -f database/schema.sql
--
-- Or paste into Neon / Supabase / Railway SQL editor.
-- ============================================================

-- ------------------------------------------------------------
-- Customers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  customer_id   BIGSERIAL PRIMARY KEY,
  full_name     VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  phone         VARCHAR(20)   NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  failed_attempts INTEGER     NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ   NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Login attempts (audit trail — every attempt, pass or fail)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_id   BIGSERIAL PRIMARY KEY,
  email        VARCHAR(150) NOT NULL,
  customer_id  BIGINT       NULL REFERENCES customers(customer_id) ON DELETE SET NULL,
  success      BOOLEAN      NOT NULL,
  ip_address   VARCHAR(45)  NULL,
  attempted_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Menu categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_categories (
  category_id   BIGSERIAL PRIMARY KEY,
  name          VARCHAR(80) NOT NULL UNIQUE,
  display_order INTEGER     NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- Menu items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_items (
  item_id       BIGSERIAL PRIMARY KEY,
  category_id   BIGINT          NOT NULL REFERENCES menu_categories(category_id) ON DELETE CASCADE,
  name          VARCHAR(120)    NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2)   NOT NULL,
  image_url     VARCHAR(255),
  is_available  BOOLEAN         NOT NULL DEFAULT TRUE,
  is_vegetarian BOOLEAN         NOT NULL DEFAULT FALSE,
  spice_level   VARCHAR(10)     NOT NULL DEFAULT 'mild'
                  CHECK (spice_level IN ('mild','medium','hot')),
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Orders
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  order_id     BIGSERIAL PRIMARY KEY,
  customer_id  BIGINT        NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status       VARCHAR(20)   NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','confirmed','preparing','served','cancelled')),
  notes        VARCHAR(255),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Order items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id BIGSERIAL PRIMARY KEY,
  order_id      BIGINT        NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  item_id       BIGINT        NOT NULL REFERENCES menu_items(item_id),
  quantity      INTEGER       NOT NULL DEFAULT 1,
  unit_price    NUMERIC(10,2) NOT NULL,
  subtotal      NUMERIC(10,2) NOT NULL
);

-- ------------------------------------------------------------
-- Seed: categories
-- ------------------------------------------------------------
INSERT INTO menu_categories (name, display_order) VALUES
  ('Starters',     1),
  ('Main Course',  2),
  ('Desserts',     3),
  ('Beverages',    4)
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------
-- Seed: menu items
-- ------------------------------------------------------------
INSERT INTO menu_items
  (category_id, name, description, price, image_url, is_vegetarian, spice_level)
SELECT c.category_id, v.name, v.description, v.price, v.image_url, v.is_vegetarian, v.spice_level
FROM (VALUES
  ('Starters',    'Crispy Spring Rolls',   'Vegetable-stuffed rolls served with sweet chili dip',          6.50,  'https://images.unsplash.com/photo-1548811256-1627d99e26c2?w=400',  TRUE,  'mild'),
  ('Starters',    'Chicken Wings',          'Spicy buffalo wings with ranch dressing',                       8.00,  'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=400',  FALSE, 'hot'),
  ('Main Course', 'Grilled Salmon',         'Served with lemon butter sauce and steamed vegetables',         18.00, 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',  FALSE, 'mild'),
  ('Main Course', 'Margherita Pizza',       'Classic pizza with fresh mozzarella, basil, and tomato sauce', 12.50, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400',  TRUE,  'mild'),
  ('Main Course', 'Beef Steak',             'Pan-seared ribeye steak with garlic mashed potatoes',           22.00, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400',  FALSE, 'medium'),
  ('Desserts',    'Chocolate Lava Cake',    'Warm chocolate cake with a molten center, vanilla ice cream',   7.00,  'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400', TRUE,  'mild'),
  ('Desserts',    'Fruit Cheesecake',       'New York style cheesecake topped with mixed berries',            6.50,  'https://images.unsplash.com/photo-1567171466295-4afa63d45416?w=400', TRUE,  'mild'),
  ('Beverages',   'Fresh Orange Juice',     'Freshly squeezed orange juice',                                  4.00,  'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400', TRUE,  'mild'),
  ('Beverages',   'Iced Latte',             'Chilled espresso with milk over ice',                            4.50,  'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400', TRUE,  'mild')
) AS v(cat_name, name, description, price, image_url, is_vegetarian, spice_level)
JOIN menu_categories c ON c.name = v.cat_name
ON CONFLICT DO NOTHING;