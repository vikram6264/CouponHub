document.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  if (!user || !user.is_admin) { window.location.href = 'login.html'; return; }

  loadStats();
  showTab('requests');
});

async function loadStats() {
  try {
    const s = await Admin.stats();
    document.getElementById('stat-users').textContent = s.users;
    document.getElementById('stat-pending').textContent = s.pending;
    document.getElementById('stat-approved').textContent = s.approved;
    document.getElementById('stat-rejected').textContent = s.rejected;
    document.getElementById('stat-claims').textContent = s.claims;
    const badge = document.getElementById('pending-badge');
    if (badge) badge.textContent = s.pending;
  } catch (e) { showToast('Stats load failed', 'error'); }
}

let selectedIds = new Set();

async function loadCoupons(status) {
  // Get the visible section's tbody
  const visibleSection = document.querySelector('.admin-section[style="display: block;"], .admin-section:not([style*="none"])');
  const tbody = visibleSection ? visibleSection.querySelector('tbody') : document.getElementById('coupon-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--muted)"><div class="spinner"></div></td></tr>';
  selectedIds.clear(); updateBulkBar();

  try {
    const coupons = await Admin.allCoupons(status);
    if (!coupons.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--muted)">No coupons found</td></tr>'; return; }
    tbody.innerHTML = coupons.map(c => `
      <tr>
        <td><input type="checkbox" onchange="toggleSelect(${c.id},this)" /></td>
        <td>${c.title}<br><small style="color:var(--muted)">${c.store||'—'}</small></td>
        <td><code style="background:var(--surface2);padding:0.2rem 0.5rem;border-radius:5px">${c.code}</code></td>
        <td>${c.submitter_name||'—'}</td>
        <td><span class="badge badge-${c.status}">${c.status}</span></td>
        <td>${formatDate(c.expiry_date)}</td>
        <td>
          <div class="table-actions">
            ${c.status !== 'approved' ? `<button class="btn btn-success btn-sm" onclick="actionCoupon(${c.id},'approved')">✓ Approve</button>` : ''}
            ${c.status !== 'rejected' ? `<button class="btn btn-danger btn-sm" onclick="openRejectModal(${c.id})">✕ Reject</button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  } catch (e) { showToast(e.message, 'error'); }
}

async function loadUsers() {
  const tbody = document.getElementById('user-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem"><div class="spinner"></div></td></tr>';
  try {
    const users = await Admin.allUsers();
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>⚡ ${u.points}</td>
        <td>${u.coupon_count}</td>
        <td><span class="badge ${u.is_banned ? 'badge-banned' : 'badge-active'}">${u.is_banned ? 'Banned' : 'Active'}</span></td>
        <td>
          <button class="btn btn-sm ${u.is_banned ? 'btn-success' : 'btn-danger'}" onclick="toggleBan(${u.id},${u.is_banned},this)">
            ${u.is_banned ? 'Unban' : 'Ban'}
          </button>
        </td>
      </tr>`).join('');
  } catch (e) { showToast(e.message, 'error'); }
}

async function loadAnalytics() {
  try {
    const data = await Admin.analytics();
    // Category breakdown
    const catEl = document.getElementById('analytics-cats');
    if (catEl && data.by_category.length) {
      catEl.innerHTML = data.by_category.map(r =>
        `<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border)">
          <span>${r.category || 'Uncategorized'}</span>
          <strong>${r.count}</strong>
        </div>`).join('');
    }
    // Top stores
    const stEl = document.getElementById('analytics-stores');
    if (stEl && data.top_stores.length) {
      const max = data.top_stores[0].count;
      stEl.innerHTML = data.top_stores.map(r =>
        `<div style="margin-bottom:0.6rem">
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:0.2rem"><span>${r.store}</span><span>${r.count}</span></div>
          <div style="background:var(--border);border-radius:4px;height:6px"><div style="background:var(--accent);height:6px;border-radius:4px;width:${(r.count/max*100).toFixed(0)}%"></div></div>
        </div>`).join('');
    }
  } catch (e) { console.error(e); }
}

function toggleSelect(id, cb) {
  if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  if (!bar) return;
  if (selectedIds.size > 0) { bar.classList.add('show'); bar.querySelector('span').textContent = `${selectedIds.size} selected`; }
  else bar.classList.remove('show');
}

async function actionCoupon(id, status, reason = null) {
  try {
    await Admin.updateCoupon(id, { status, reject_reason: reason });
    showToast(`Coupon ${status}!`);
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'pending';
    loadCoupons(activeTab === 'all' ? null : activeTab);
    loadStats();
  } catch (e) { showToast(e.message, 'error'); }
}

let rejectCouponId = null;
function openRejectModal(id) {
  rejectCouponId = id;
  document.getElementById('reject-reason').value = '';
  document.getElementById('reject-modal').classList.add('open');
}

function closeRejectModal() { document.getElementById('reject-modal').classList.remove('open'); rejectCouponId = null; }

async function confirmReject() {
  const reason = document.getElementById('reject-reason').value;
  if (rejectCouponId) await actionCoupon(rejectCouponId, 'rejected', reason);
  closeRejectModal();
}

async function bulkAction(action) {
  if (!selectedIds.size) return;
  const reason = action === 'rejected' ? prompt('Rejection reason (optional):') : null;
  try {
    await Admin.bulkAction({ ids: [...selectedIds], action, reason });
    showToast(`${selectedIds.size} coupons ${action}`);
    selectedIds.clear(); updateBulkBar();
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'pending';
    loadCoupons(activeTab === 'all' ? null : activeTab);
    loadStats();
  } catch (e) { showToast(e.message, 'error'); }
}

async function toggleBan(id, currentBanned, btn) {
  try {
    await Admin.banUser(id, !currentBanned);
    showToast(currentBanned ? 'User unbanned' : 'User banned');
    loadUsers();
  } catch (e) { showToast(e.message, 'error'); }
}

function showTab(tab) {
  document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.sidebar-nav a').forEach(b => b.classList.remove('active'));
  const section = document.getElementById(`section-${tab}`);
  if (section) section.style.display = 'block';

  // Load data for the tab
  setTimeout(() => {
    if (tab === 'requests') loadCoupons('pending');
    else if (tab === 'all') loadCoupons(null);
    else if (tab === 'approved') loadCoupons('approved');
    else if (tab === 'users') loadUsers();
    else if (tab === 'analytics') loadAnalytics();
    else if (tab === 'dashboard') { loadStats(); loadAnalytics(); }
  }, 50);
}
