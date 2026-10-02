function getUser() {
  try { return JSON.parse(localStorage.getItem('cs_user')); } catch { return null; }
}

function isLoggedIn() { return !!getToken() && !!getUser(); }

function requireAuth() {
  if (!isLoggedIn()) { window.location.href = 'login.html'; return false; }
  return true;
}

function requireAdmin() {
  const user = getUser();
  if (!isLoggedIn() || !user?.is_admin) { window.location.href = 'login.html'; return false; }
  return true;
}

function logout() {
  localStorage.removeItem('cs_token');
  localStorage.removeItem('cs_user');
  window.location.href = 'index.html';
}

function saveLogin(data) {
  localStorage.setItem('cs_token', data.access_token);
  localStorage.setItem('cs_user', JSON.stringify(data.user));
}

// Render nav user info globally across the dark theme pages
function renderNavUser() {
  const user = getUser();
  const ptsDisplay = document.getElementById('ptsDisplay');
  const ptsNum = document.getElementById('ptsNum');
  const userArea = document.getElementById('userArea');
  const authBtns = document.getElementById('authBtns');
  const avatarInitials = document.getElementById('avatarInitials');
  
  if (user) {
    if(ptsDisplay) ptsDisplay.style.display = 'flex';
    if(ptsNum) ptsNum.textContent = user.points || 0;
    if(userArea) userArea.style.display = 'block';
    if(authBtns) authBtns.style.display = 'none';
    if(avatarInitials) {
      avatarInitials.textContent = user.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    }
  } else {
    if(ptsDisplay) ptsDisplay.style.display = 'none';
    if(userArea) userArea.style.display = 'none';
    if(authBtns) authBtns.style.display = 'block';
  }
}

function toggleDD() {
  document.getElementById('avatarDD')?.classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('#userArea')) {
    document.getElementById('avatarDD')?.classList.remove('open');
  }
});

document.addEventListener('DOMContentLoaded', renderNavUser);
