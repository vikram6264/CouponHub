/* ═══════════════════════════════════════════════════
   api.js — CouponShare
   Sab API calls yahan se hoti hain.
   Har HTML page mein <script src="api.js"> include karo.
═══════════════════════════════════════════════════ */

// Use the page origin so API calls follow the host/port the site was loaded from.
const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://127.0.0.1:8000';
console.log('API_BASE =', API_BASE);

/* ── Core fetch helper ─────────────────────────────
   Token automatically lagata hai agar login hua ho.
   4xx/5xx pe Error throw karta hai with server message.
─────────────────────────────────────────────────── */
async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = localStorage.getItem('cs_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = API_BASE + path;
  console.debug('apiFetch ->', options.method || 'GET', url);
  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (netErr) {
    console.error('apiFetch network error', netErr);
    throw new Error('Network error: ' + (netErr && netErr.message));
  }

  // Try to parse JSON (even on error responses)
  let data;
  try { data = await res.json(); } catch (e) { data = null; }

  if (!res.ok) {
    // Include status and body in the thrown error for easier debugging
    const bodyText = data ? JSON.stringify(data) : await res.text().catch(() => '');
    const msg = (data && (data.detail || data.message)) || `Error ${res.status}`;
    const err = new Error(msg + ' (status=' + res.status + ')');
    err.status = res.status;
    err.body = data || bodyText;
    console.error('apiFetch response error', { url, method: options.method || 'GET', status: res.status, body: err.body });
    throw err;
  }
  return data;
}

/* ═══════════════════════════════════════════════════
   Auth API
═══════════════════════════════════════════════════ */
const Auth = {
  register: (payload) =>
    apiFetch('/api/users/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload) =>
    apiFetch('/api/users/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  profile: () => apiFetch('/api/users/profile'),

  mySubmissions: () => apiFetch('/api/users/my-submissions'),

  myClaims: () => apiFetch('/api/users/my-claims'),
};

/* ═══════════════════════════════════════════════════
   Coupons API
═══════════════════════════════════════════════════ */
const Coupons = {
  /* Browse with optional filters */
  browse: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search)   q.set('search',   params.search);
    if (params.category) q.set('category', params.category);
    if (params.store)    q.set('store',    params.store);
    if (params.page)     q.set('page',     params.page);
    if (params.limit)    q.set('limit',    params.limit);
    return apiFetch('/api/coupons?' + q.toString());
  },

  /* Submit a new coupon (login required) */
  submit: (payload) =>
    apiFetch('/api/coupons', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /* Claim a coupon (login required) */
  claim: (id) =>
    apiFetch(`/api/coupons/${id}/claim`, { method: 'POST' }),

  /* Get distinct categories */
  categories: () => apiFetch('/api/coupons/categories'),
};

/* ═══════════════════════════════════════════════════
   Admin API  (admin token required for all)
═══════════════════════════════════════════════════ */
const Admin = {
  /* Dashboard stats */
  stats: () => apiFetch('/api/admin/stats'),

  /* All coupons with optional status filter */
  coupons: (status = '') => {
    const q = status ? `?status=${status}` : '';
    return apiFetch('/api/admin/coupons' + q);
  },

  /* Approve or reject a coupon */
  reviewCoupon: (id, status, reject_reason = '') =>
    apiFetch(`/api/admin/coupons/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, reject_reason }),
    }),

  /* Delete a coupon */
  deleteCoupon: (id) =>
    apiFetch(`/api/admin/coupons/${id}`, { method: 'DELETE' }),

  /* All users */
  users: (search = '') => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiFetch('/api/admin/users' + q);
  },

  /* Ban or unban */
  banUser: (id, is_banned) =>
    apiFetch(`/api/admin/users/${id}/ban`, {
      method: 'PUT',
      body: JSON.stringify({ is_banned }),
    }),
};

/* ═══════════════════════════════════════════════════
   Toast  (shared UI helper used everywhere)
═══════════════════════════════════════════════════ */
function showToast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const t = document.createElement('div');
  t.className = `toast ${type}`;

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  t.innerHTML = `<span style="font-size:16px">${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  container.appendChild(t);

  // Trigger animation
  requestAnimationFrame(() => t.classList.add('show'));

  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 3200);
}

/* ═══════════════════════════════════════════════════
   Alert helpers  (used in auth forms)
═══════════════════════════════════════════════════ */
function showAlert(id, msg, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `alert alert-${type} show`;
}
function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

/* ═══════════════════════════════════════════════════
   Date / format helpers
═══════════════════════════════════════════════════ */
function formatDate(str) {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return str; }
}

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  return diff;
}

/* ═══════════════════════════════════════════════════
   Platform CSS class helper
═══════════════════════════════════════════════════ */
function platformClass(store) {
  const s = (store || '').toLowerCase();
  if (s.includes('paytm'))    return 'pb-paytm';
  if (s.includes('swiggy'))   return 'pb-swiggy';
  if (s.includes('amazon'))   return 'pb-amazon';
  if (s.includes('uber'))     return 'pb-uber';
  if (s.includes('zomato'))   return 'pb-zomato';
  if (s.includes('flipkart')) return 'pb-flipkart';
  return 'pb-default';
}
