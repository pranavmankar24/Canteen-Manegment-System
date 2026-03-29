const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth',   require('./routes/auth'));
app.use('/api/menu',   require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));

app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  } else {
    res.status(404).json({ error: 'Route not found' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Canteen Server started');
  console.log('Customer page: http://localhost:' + PORT + '/index.html');
  console.log('Admin panel:   http://localhost:' + PORT + '/admin.html');
});
