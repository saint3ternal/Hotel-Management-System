-- ============================================================
-- Hotel Management System - Database Schema
-- ============================================================
-- Run this once on your MySQL server to create the database
-- and all required tables:
--
--   mysql -u root -p < database/schema.sql
--
-- ============================================================

CREATE DATABASE IF NOT EXISTS hotel_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hotel_management;

-- ------------------------------------------------------------
-- Customers
-- Stores registered customer details. Passwords are stored as
-- bcrypt hashes only -- never as plain text.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  customer_id     INT AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  phone           VARCHAR(20)  NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until    DATETIME NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Login attempts (audit trail for every login attempt, as
-- requested -- both successful and failed)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_id   INT AUTO_INCREMENT PRIMARY KEY,
  email        VARCHAR(150) NOT NULL,
  customer_id  INT NULL,
  success      BOOLEAN NOT NULL,
  ip_address   VARCHAR(45) NULL,
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attempt_customer FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Menu categories (Starters, Main Course, Desserts, Beverages...)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_categories (
  category_id   INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80) NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Menu items (the digital menu)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_items (
  item_id      INT AUTO_INCREMENT PRIMARY KEY,
  category_id  INT NOT NULL,
  name         VARCHAR(120) NOT NULL,
  description  TEXT,
  price        DECIMAL(10,2) NOT NULL,
  image_url    VARCHAR(255),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_vegetarian BOOLEAN NOT NULL DEFAULT FALSE,
  spice_level  ENUM('mild','medium','hot') DEFAULT 'mild',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_item_category FOREIGN KEY (category_id)
    REFERENCES menu_categories(category_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Orders (one row per order placed by a logged-in customer)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  order_id     INT AUTO_INCREMENT PRIMARY KEY,
  customer_id  INT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status       ENUM('pending','confirmed','preparing','served','cancelled')
                 NOT NULL DEFAULT 'pending',
  notes        VARCHAR(255),
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Order items (line items within an order)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id      INT NOT NULL,
  item_id       INT NOT NULL,
  quantity      INT NOT NULL DEFAULT 1,
  unit_price    DECIMAL(10,2) NOT NULL,
  subtotal      DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_orderitem_order FOREIGN KEY (order_id)
    REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_orderitem_menuitem FOREIGN KEY (item_id)
    REFERENCES menu_items(item_id)
) ENGINE=InnoDB;

-- ============================================================
-- Seed data: categories and sample menu items
-- ============================================================
INSERT INTO menu_categories (name, display_order) VALUES
  ('Starters', 1),
  ('Main Course', 2),
  ('Desserts', 3),
  ('Beverages', 4)
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO menu_items (category_id, name, description, price, image_url, is_vegetarian, spice_level)
VALUES
  (1, 'Crispy Spring Rolls', 'Vegetable-stuffed rolls served with sweet chili dip', 6.50,
     'https://images.unsplash.com/photo-1548811256-1627d99e26c2?w=400', TRUE, 'mild'),
  (1, 'Chicken Wings', 'Spicy buffalo wings with ranch dressing', 8.00,
     'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=400', FALSE, 'hot'),
  (2, 'Grilled Salmon', 'Served with lemon butter sauce and steamed vegetables', 18.00,
     'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400', FALSE, 'mild'),
  (2, 'Margherita Pizza', 'Classic pizza with fresh mozzarella, basil, and tomato sauce', 12.50,
     'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400', TRUE, 'mild'),
  (2, 'Beef Steak', 'Pan-seared ribeye steak with garlic mashed potatoes', 22.00,
     'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400', FALSE, 'medium'),
  (3, 'Chocolate Lava Cake', 'Warm chocolate cake with a molten center, vanilla ice cream', 7.00,
     'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400', TRUE, 'mild'),
  (3, 'Fruit Cheesecake', 'New York style cheesecake topped with mixed berries', 6.50,
     'https://images.unsplash.com/photo-1567171466295-4afa63d45416?w=400', TRUE, 'mild'),
  (4, 'Fresh Orange Juice', 'Freshly squeezed orange juice', 4.00,
     'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400', TRUE, 'mild'),
  (4, 'Iced Latte', 'Chilled espresso with milk over ice', 4.50,
     'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400', TRUE, 'mild')
ON DUPLICATE KEY UPDATE name = name;
