const express = require('express');
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM menu_items WHERE is_available = 1 ORDER BY category, name'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM menu_items ORDER BY category, name');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { name, category, price, description } = req.body;
  if (!name || !category || !price)
    return res.status(400).json({ error: 'name, category, price are required' });
  try {
    const [result] = await db.query(
      'INSERT INTO menu_items (name, category, price, description) VALUES (?, ?, ?, ?)',
      [name, category, parseFloat(price), description || '']
    );
    res.status(201).json({ id: result.insertId, name, category, price, description });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, category, price, description, is_available } = req.body;
  try {
    await db.query(
      'UPDATE menu_items SET name=?, category=?, price=?, description=?, is_available=? WHERE id=?',
      [name, category, parseFloat(price), description, is_available ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/toggle', authMiddleware, adminOnly, async (req, res) => {
  try {
    await db.query(
      'UPDATE menu_items SET is_available = NOT is_available WHERE id = ?',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
