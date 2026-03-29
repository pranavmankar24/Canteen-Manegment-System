const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

async function getNextToken(conn) {
  const today = new Date().toISOString().slice(0, 10);
  await conn.query(
    `INSERT INTO token_counter (counter_date, last_token)
     VALUES (?, 1)
     ON DUPLICATE KEY UPDATE last_token = last_token + 1`,
    [today]
  );
  const [rows] = await conn.query(
    'SELECT last_token FROM token_counter WHERE counter_date = ?', [today]
  );
  return rows[0].last_token;
}

router.post('/', async (req, res) => {
  const { customer_name, items, notes, payment_method } = req.body;
  if (!customer_name || !items || !items.length)
    return res.status(400).json({ error: 'customer_name and items are required' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const ids = items.map(i => i.menu_item_id);
    const [menuItems] = await conn.query(
      'SELECT id, name, price, is_available FROM menu_items WHERE id IN (?)', [ids]
    );
    const priceMap = {};
    for (const m of menuItems) {
      if (!m.is_available) throw new Error(`"${m.name}" is currently not available`);
      priceMap[m.id] = m.price;
    }
    for (const item of items) {
      if (!priceMap[item.menu_item_id])
        throw new Error(`Menu item ID ${item.menu_item_id} not found`);
    }
    const total = items.reduce((sum, i) => sum + priceMap[i.menu_item_id] * i.quantity, 0);
    const token = await getNextToken(conn);
    const [orderResult] = await conn.query(
      `INSERT INTO orders (customer_name, token_number, total_amount, payment_method, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [customer_name, token, total.toFixed(2), payment_method || 'cash', notes || '']
    );
    const orderId = orderResult.insertId;
    for (const item of items) {
      await conn.query(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderId, item.menu_item_id, item.quantity, priceMap[item.menu_item_id]]
      );
    }
    await conn.commit();
    res.status(201).json({ order_id: orderId, token_number: token, total: total.toFixed(2), status: 'pending' });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.get('/', authMiddleware, async (req, res) => {
  const { status, date, limit = 100 } = req.query;
  let sql = 'SELECT * FROM order_summary WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (date)   { sql += ' AND DATE(created_at) = ?'; params.push(date); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats', authMiddleware, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [[todayStats]] = await db.query(
      `SELECT
         COUNT(*)                                                           AS total_orders,
         COALESCE(SUM(total_amount), 0)                                    AS total_revenue,
         COALESCE(SUM(CASE WHEN status='pending'   THEN 1 ELSE 0 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN status='preparing' THEN 1 ELSE 0 END), 0) AS preparing,
         COALESCE(SUM(CASE WHEN status='ready'     THEN 1 ELSE 0 END), 0) AS ready,
         COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END), 0) AS completed
       FROM orders WHERE DATE(created_at) = ?`, [today]
    );
    const [topItems] = await db.query(
      `SELECT mi.name, SUM(oi.quantity) AS qty
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       JOIN orders o ON o.id = oi.order_id
       WHERE DATE(o.created_at) = ?
       GROUP BY mi.id ORDER BY qty DESC LIMIT 5`, [today]
    );
    res.json({ today: todayStats, top_items: topItems });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const [items] = await db.query(
      `SELECT oi.quantity, oi.unit_price, mi.name, mi.category,
              (oi.quantity * oi.unit_price) AS subtotal
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE oi.order_id = ?`, [req.params.id]
    );
    res.json({ ...orders[0], items });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  const valid = ['pending','preparing','ready','completed','cancelled'];
  if (!valid.includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  try {
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/pay', authMiddleware, async (req, res) => {
  const { paid_amount, payment_method } = req.body;
  try {
    await db.query(
      'UPDATE orders SET paid_amount = ?, payment_method = ? WHERE id = ?',
      [paid_amount, payment_method || 'cash', req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
