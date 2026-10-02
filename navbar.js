/* Shared Navbar Component
   Usage: <div id="navbar-root"></div> then renderNavbar('pageName')
   Requires api.js + auth.js to be loaded BEFORE this call. */
function renderNavbar(activePage = '') {
  const root = document.getElementById('navbar-root');
  if (!root) return;

  const user = typeof getUser === 'function' ? getUser() : null;
  const loggedIn = !!user;
  const initials = user
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  root.innerHTML = `
    <nav class="navbar">
      <a href="index.html" class="nav-logo">Coupon<span>Share</span></a>
      <div class="nav-right">
        <div class="pts-badge" id="ptsDisplay" style="display:${loggedIn ? 'flex' : 'none'};">
          <span class="pts-icon"></span>
          <span id="ptsNum">${user ? user.points || 0 : 0}</span> pts
        </div>
        <div id="authBtns" style="display:${loggedIn ? 'none' : 'flex'};">
          <a href="login.html" class="nav-btn nav-btn-ghost">Login</a>
          <a href="register.html" class="nav-btn nav-btn-primary">Register</a>
        </div>
        <div id="userArea" style="display:${loggedIn ? 'block' : 'none'};position:relative;">
          <button class="avatar" id="avatarBtn" onclick="toggleDD()" aria-label="User menu" aria-haspopup="true">
            <span id="avatarInitials">${initials}</span>
          </button>
          <div class="avatar-dd" id="avatarDD" role="menu">
            <a href="browse.html" class="${activePage === 'browse' ? 'active' : ''}" role="menuitem">🏠 Browse Coupons</a>
            <a href="submit.html" class="${activePage === 'submit' ? 'active' : ''}" role="menuitem">➕ Share a Coupon</a>
            <a href="dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}" role="menuitem">📊 Dashboard</a>
            ${user && user.is_admin ? `<a href="admin.html" class="${activePage === 'admin' ? 'active' : ''}" role="menuitem">⚙️ Admin Panel</a>` : ''}
            <hr>
            <button class="dd-logout" onclick="logout()" role="menuitem">🚪 Logout</button>
          </div>
        </div>
      </div>
    </nav>`;
}

function toggleDD() {
  document.getElementById('avatarDD')?.classList.toggle('open');
}

// Close dropdown when clicking outside (registered once, guarded)
if (!window.__navbarOutsideClickBound) {
  window.__navbarOutsideClickBound = true;
  document.addEventListener('click', e => {
    if (!e.target.closest('#userArea')) {
      document.getElementById('avatarDD')?.classList.remove('open');
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('avatarDD')?.classList.remove('open');
  });
}

// Navbar-specific styles (injected once)
if (!window.__navbarStylesInjected) {
  window.__navbarStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    .nav-btn { padding:8px 16px; border-radius:8px; font-size:13px; font-weight:500;
      text-decoration:none; transition:all .2s; margin-right:8px; display:inline-flex; align-items:center; }
    .nav-btn-ghost { background:transparent; border:1px solid rgba(255,255,255,0.15); color:var(--text); }
    .nav-btn-ghost:hover { background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.3); }
    .nav-btn-primary { background:var(--purple); color:#fff; }
    .nav-btn-primary:hover { background:var(--purple-hover); }
    .avatar { border:none; font-family:inherit; }
    .avatar-dd a.active { background:rgba(108,92,231,0.15); color:var(--purple2) !important; font-weight:600; }
    .avatar-dd button.dd-logout { width:100%; text-align:left; background:none; border:none;
      padding:10px 16px; font-size:13px; color:var(--red); cursor:pointer; font-family:inherit; }
    .avatar-dd button.dd-logout:hover { background:rgba(239,68,68,0.1); }
    @media (max-width:680px) { .nav-btn { padding:7px 12px; font-size:12px; } }
  `;
  document.head.appendChild(s);
}
