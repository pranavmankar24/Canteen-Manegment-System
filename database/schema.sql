CREATE DATABASE IF NOT EXISTS canteen_db;
USE canteen_db;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','staff') DEFAULT 'staff',
  full_name     VARCHAR(100),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  category     VARCHAR(50)  NOT NULL,
  price        DECIMAL(8,2) NOT NULL,
  description  VARCHAR(255),
  is_available BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  customer_name  VARCHAR(100) NOT NULL,
  token_number   INT NOT NULL,
  total_amount   DECIMAL(10,2) NOT NULL,
  paid_amount    DECIMAL(10,2) DEFAULT 0,
  payment_method ENUM('cash','upi','card') DEFAULT 'cash',
  status         ENUM('pending','preparing','ready','completed','cancelled') DEFAULT 'pending',
  notes          VARCHAR(255),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT NOT NULL,
  menu_item_id INT NOT NULL,
  quantity     INT NOT NULL,
  unit_price   DECIMAL(8,2) NOT NULL,
  FOREIGN KEY (order_id)     REFERENCES orders(id)     ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS token_counter (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  counter_date DATE NOT NULL UNIQUE,
  last_token   INT  NOT NULL DEFAULT 0
);

INSERT IGNORE INTO users (username, password_hash, role, full_name)
VALUES ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'admin', 'Admin User');

INSERT IGNORE INTO users (username, password_hash, role, full_name)
VALUES ('staff1', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'staff', 'Canteen Staff');

INSERT IGNORE INTO menu_items (name, category, price, description) VALUES
('Veg Thali',      'Meals',     60.00, 'Dal, sabzi, rice, roti, salad'),
('Non-Veg Thali',  'Meals',     90.00, 'Chicken curry, rice, roti, salad'),
('Paneer Rice',    'Meals',     70.00, 'Fried rice with paneer'),
('Egg Rice',       'Meals',     55.00, 'Fried rice with egg'),
('Masala Chai',    'Beverages', 10.00, 'Freshly brewed masala tea'),
('Cold Coffee',    'Beverages', 30.00, 'Chilled coffee with milk'),
('Lassi',          'Beverages', 25.00, 'Sweet or salted lassi'),
('Mineral Water',  'Beverages', 10.00, '500ml bottle'),
('Samosa (2 pcs)', 'Snacks',    15.00, 'Crispy with green chutney'),
('Bread Omelette', 'Snacks',    35.00, '2 eggs, 2 bread slices'),
('Veg Sandwich',   'Snacks',    30.00, 'Toasted with veggies and chutney'),
('Maggi Noodles',  'Snacks',    25.00, 'Classic masala maggi'),
('Gulab Jamun',    'Desserts',  20.00, '2 pieces'),
('Kheer',          'Desserts',  25.00, 'Rice pudding');

CREATE OR REPLACE VIEW order_summary AS
SELECT
  o.id, o.token_number, o.customer_name, o.total_amount,
  o.paid_amount, o.payment_method, o.status, o.notes, o.created_at,
  GROUP_CONCAT(
    CONCAT(oi.quantity,'x ', mi.name)
    ORDER BY mi.name SEPARATOR ', '
  ) AS items_summary
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN menu_items  mi ON mi.id = oi.menu_item_id
GROUP BY o.id;
