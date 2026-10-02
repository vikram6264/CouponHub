// Use the page origin so API calls follow the host/port the site was loaded from.
const API = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null')
  ? window.location.origin
  : 'http://127.0.0.1:8000';

function getToken() { return localStorage.getItem('cs_token'); }

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(API + url, { ...options, headers });
  return res;
}

// Auth
const Auth = {
  register: async (body) => {
    const res = await apiFetch('/api/users/register', { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Registration failed');
    return data;
  },
  login: async (body) => {
    const res = await apiFetch('/api/users/login', { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Login failed');
    return data;
  },
  profile: async () => {
    const res = await apiFetch('/api/users/profile');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Failed to get profile');
    return data;
  },
  mySubmissions: async () => {
    const res = await apiFetch('/api/users/my-submissions');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch');
    return data;
  },
  myClaims: async () => {
    const res = await apiFetch('/api/users/my-claims');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch');
    return data;
  },
};

// Coupons
const Coupons = {
  submit: async (body) => {
    const res = await apiFetch('/api/coupons', { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Failed to submit coupon');
    return data;
  },
};

// Admin
const Admin = {
  stats: async () => {
    const res = await apiFetch('/api/admin/stats');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Failed');
    return data;
  },
  allCoupons: async (status) => {
    const res = await apiFetch('/api/admin/coupons' + (status ? `?status=${status}` : ''));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Failed');
    return data;
  },
  updateCoupon: async (id, body) => {
    const res = await apiFetch(`/api/admin/coupons/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Failed');
    return data;
  },
  bulkAction: async (body) => {
    const res = await apiFetch('/api/admin/coupons/bulk', { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Failed');
    return data;
  },
  allUsers: async () => {
    const res = await apiFetch('/api/admin/users');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Failed');
    return data;
  },
  banUser: async (id, is_banned) => {
    const res = await apiFetch(`/api/admin/users/${id}/ban`, { method: 'PUT', body: JSON.stringify({ is_banned }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Failed');
    return data;
  },
  analytics: async () => {
    const res = await apiFetch('/api/admin/analytics');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Failed');
    return data;
  },
};

// Toast utility
function showToast(msg, type = 'success') {
  let t = document.getElementById('toastContainer');
  if (!t) { 
    t = document.createElement('div'); 
    t.id = 'toastContainer'; 
    t.className = 'toast-container'; 
    document.body.appendChild(t); 
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${msg}`;
  t.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Alert utility
function showAlert(id, msg, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type} show`;
  el.textContent = msg;
}

function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.className = 'alert';
}

// Format date
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Days until expiry
function daysLeft(d) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d) - new Date()) / 86400000);
  return diff;
}

function platformClass(plat) {
  if (!plat) return 'pb-default';
  const p = plat.toLowerCase();
  if (p.includes('paytm')) return 'pb-paytm';
  if (p.includes('swiggy')) return 'pb-swiggy';
  if (p.includes('amazon')) return 'pb-amazon';
  if (p.includes('uber')) return 'pb-uber';
  if (p.includes('zomato')) return 'pb-zomato';
  if (p.includes('flipkart')) return 'pb-flipkart';
  if (p.includes('myntra')) return 'pb-myntra';
  if (p.includes('ajio')) return 'pb-ajio';
  return 'pb-default';
}

// Escape untrusted strings before inserting into HTML templates
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
