/* ═══════════════════════════════════════════════════
   auth.js — CouponShare
   Login state management, navbar rendering, guards.
   Include AFTER api.js on every page.
═══════════════════════════════════════════════════ */

/* ── Storage keys ─────────────────────────────── */
const TOKEN_KEY = 'cs_token';
const USER_KEY  = 'cs_user';

/* ── Read helpers ─────────────────────────────── */
function getToken()   { return localStorage.getItem(TOKEN_KEY); }
function getUser()    { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
function isLoggedIn() { return !!getToken(); }
function isAdmin()    { const u = getUser(); return u && (u.is_admin === true || u.is_admin === 1); }

/* ── Save after login ─────────────────────────── */
function saveLogin(data) {
  // data = { access_token, user: { id, name, email, points, is_admin } }
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(USER_KEY,  JSON.stringify(data.user));
}

/* ── Logout ───────────────────────────────────── */
function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = 'login.html';
}

/* ── Route guards ─────────────────────────────── */
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function requireAdminAuth() {
  if (!isLoggedIn() || !isAdmin()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.href = isAdmin() ? 'admin.html' : 'browse.html';
  }
}

/* ═══════════════════════════════════════════════════
   Navbar renderer
   Reads current user from localStorage and builds
   the right-side nav: pts badge + avatar dropdown.
═══════════════════════════════════════════════════ */
function renderNavUser() {
  const user = getUser();

  const ptsDisplay = document.getElementById('ptsDisplay');
  const authBtns   = document.getElementById('authBtns');
  const userArea   = document.getElementById('userArea');
  const ptsNum     = document.getElementById('ptsNum');
  const avatarInit = document.getElementById('avatarInitials');

  if (!ptsDisplay && !authBtns) return; // not a nav page

  if (user) {
    if (ptsDisplay) { ptsDisplay.style.display = 'flex';  }
    if (authBtns)   { authBtns.style.display   = 'none';  }
    if (userArea)   { userArea.style.display    = 'block'; }
    if (ptsNum)     { ptsNum.textContent = user.points || 0; }
    if (avatarInit) {
      const initials = (user.name || '?')
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
      avatarInit.textContent = initials;
    }
  } else {
    if (ptsDisplay) { ptsDisplay.style.display = 'none';  }
    if (authBtns)   { authBtns.style.display   = 'block'; }
    if (userArea)   { userArea.style.display    = 'none';  }
  }
}

/* Avatar dropdown toggle */
function toggleDD() {
  document.getElementById('avatarDD')?.classList.toggle('open');
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('#userArea')) {
    document.getElementById('avatarDD')?.classList.remove('open');
  }
});

/* ── Auto-render nav on every page load ───────── */
document.addEventListener('DOMContentLoaded', renderNavUser);
