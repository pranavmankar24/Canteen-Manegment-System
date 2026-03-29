const API = 'http://localhost:3000/api';

function getToken() { return localStorage.getItem('canteen_token'); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('canteen_user')); }
  catch { return null; }
}
function setAuth(token, user) {
  localStorage.setItem('canteen_token', token);
  localStorage.setItem('canteen_user', JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem('canteen_token');
  localStorage.removeItem('canteen_user');
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + endpoint, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

let _toastTimer;
function showToast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function formatCurrency(n) { return '₹' + parseFloat(n).toFixed(2); }

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const STATUS_ORDER = ['pending', 'preparing', 'ready', 'completed'];
function nextStatus(current) {
  const idx = STATUS_ORDER.indexOf(current);
  return idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
}
