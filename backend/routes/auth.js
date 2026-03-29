const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const SECRET     = process.env.JWT_SECRET       || 'canteen_secret_key';
const REG_SECRET = process.env.REGISTER_SECRET  || 'canteen2024';

// ── LOGIN ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  try {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE username = ?', [username]
    );
    if (!rows.length)
      return res.status(401).json({ error: 'Invalid credentials' });

    const user  = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      SECRET,
      { expiresIn: '10h' }
    );
    res.json({ token, role: user.role, username: user.username, full_name: user.full_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── OPEN REGISTER (uses secret key, no login needed) ──
router.post('/register-open', async (req, res) => {
  const { username, password, role, full_name, secret_key } = req.body;

  // Validate secret key
  if (!secret_key || secret_key !== REG_SECRET)
    return res.status(403).json({ error: 'Invalid secret key' });

  // Validate fields
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3)
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const allowedRoles = ['admin', 'staff'];
  const userRole = allowedRoles.includes(role) ? role : 'staff';

  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
      [username, hash, userRole, full_name || '']
    );
    res.status(201).json({
      id:       result.insertId,
      username,
      role:     userRole,
      full_name: full_name || '',
      message:  'Account created successfully'
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ error: 'Username already taken. Choose a different one.' });
    res.status(500).json({ error: err.message });
  }
});

// ── PROTECTED REGISTER (admin must be logged in) ──────
router.post('/register', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin only' });

  const { username, password, role, full_name } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
      [username, hash, role || 'staff', full_name || '']
    );
    res.json({ id: result.insertId, username, role: role || 'staff' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

// ── GET CURRENT USER ───────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

module.exports = router;
