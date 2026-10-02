document.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  if (!user || !user.is_admin) { window.location.href = 'login.html'; return; }

  loadStats();
  // Support deep links like admin.html?tab=requests
  const requested = new URLSearchParams(location.search).get('tab');
  const valid = ['dashboard', 'requests', 'all', 'approved', 'users', 'analytics'];
  showTab(valid.includes(requested) ? requested : 'dashboard');
});

/* ── Stats ─────────────────────────────────── */
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

/* ── Tabs ──────────────────────────────────── */
const TAB_TITLES = {
  dashboard: 'Dashboard', requests: 'Pending Requests', all: 'All Coupons',
  approved: 'Approved Coupons', users: 'Users', analytics: 'Analytics'
};

function activeTab() {
  return document.querySelector('.sidebar-nav a.active')?.dataset.tab || 'dashboard';
}

function showTab(tab) {
  document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.sidebar-nav a').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('topbar-title').textContent = TAB_TITLES[tab] || 'Admin';
  const section = document.getElementById(`section-${tab}`);
  if (section) section.style.display = 'block';

  // Close mobile sidebar after navigation
  document.getElementById('sidebar')?.classList.remove('open');

  selectedIds.clear();
  updateBulkBar();

  if (tab === 'requests') loadCoupons('pending');
  else if (tab === 'all') loadCoupons(null);
  else if (tab === 'approved') loadCoupons('approved');
  else if (tab === 'users') loadUsers();
  else if (tab === 'analytics' || tab === 'dashboard') loadAnalytics();
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}

/* ── Coupons table ─────────────────────────── */
let selectedIds = new Set();

const TBODY_IDS = {
  requests: 'coupon-tbody-requests',
  all: 'coupon-tbody-all',
  approved: 'coupon-tbody-approved'
};

async function loadCoupons(status) {
  const tbody = document.getElementById(TBODY_IDS[activeTab()] || TBODY_IDS.requests);
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--muted)"><div class="spinner"></div></td></tr>';

  try {
    const coupons = await Admin.allCoupons(status);
    if (!coupons.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--muted)">No coupons found</td></tr>';
      return;
    }
    tbody.innerHTML = coupons.map(c => `
      <tr>
        <td><input type="checkbox" data-id="${c.id}" onchange="toggleSelect(${c.id},this)" /></td>
        <td>${escapeHtml(c.title)}<br><small style="color:var(--muted)">${escapeHtml(c.store || '—')}</small></td>
        <td><code style="background:var(--surface2);padding:0.2rem 0.5rem;border-radius:5px">${escapeHtml(c.code)}</code></td>
        <td>${escapeHtml(c.submitter_name || '—')}</td>
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

function toggleSelect(id, cb) {
  if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
  updateBulkBar();
}

function toggleAllCheckboxes(masterCb, tab) {
  const tbody = document.getElementById(TBODY_IDS[tab]);
  if (!tbody) return;
  tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = masterCb.checked;
    toggleSelect(parseInt(cb.dataset.id, 10), cb);
  });
}

function updateBulkBar() {
  document.querySelectorAll('.bulk-bar').forEach(bar => {
    bar.classList.toggle('show', selectedIds.size > 0);
    const label = bar.querySelector('span');
    if (label) label.textContent = `${selectedIds.size} selected`;
  });
}

async function actionCoupon(id, status, reason = null) {
  try {
    await Admin.updateCoupon(id, { status, reject_reason: reason });
    showToast(`Coupon ${status}!`);
    await loadCoupons(statusFilterForTab(activeTab()));
    loadStats();
  } catch (e) { showToast(e.message, 'error'); }
}

function statusFilterForTab(tab) {
  if (tab === 'all') return null;
  if (tab === 'approved') return 'approved';
  return 'pending';
}

/* ── Reject modal ──────────────────────────── */
let rejectCouponId = null;
function openRejectModal(id) {
  rejectCouponId = id;
  document.getElementById('reject-reason').value = '';
  document.getElementById('reject-modal').classList.add('open');
}
function closeRejectModal() {
  document.getElementById('reject-modal').classList.remove('open');
  rejectCouponId = null;
}
async function confirmReject() {
  const reason = document.getElementById('reject-reason').value;
  if (rejectCouponId) await actionCoupon(rejectCouponId, 'rejected', reason);
  closeRejectModal();
}

/* ── Bulk actions ──────────────────────────── */
async function bulkAction(action) {
  if (!selectedIds.size) { showToast('Select coupons first', 'info'); return; }
  const reason = action === 'rejected' ? (prompt('Rejection reason (optional):') || '') : '';
  try {
    const count = selectedIds.size;
    await Admin.bulkAction({ ids: [...selectedIds], action, reason });
    showToast(`${count} coupons ${action}`);
    selectedIds.clear(); updateBulkBar();
    await loadCoupons(statusFilterForTab(activeTab()));
    loadStats();
  } catch (e) { showToast(e.message, 'error'); }
}

/* ── Users ─────────────────────────────────── */
async function loadUsers() {
  const tbody = document.getElementById('user-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem"><div class="spinner"></div></td></tr>';
  try {
    const users = await Admin.allUsers();
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>⚡ ${u.points}</td>
        <td>${u.coupon_count}</td>
        <td><span class="badge ${u.is_banned ? 'badge-banned' : 'badge-active'}">${u.is_banned ? 'Banned' : 'Active'}</span></td>
        <td>
          <button class="btn btn-sm ${u.is_banned ? 'btn-success' : 'btn-danger'}" onclick="toggleBan(${u.id},${!!u.is_banned},this)">
            ${u.is_banned ? 'Unban' : 'Ban'}
          </button>
        </td>
      </tr>`).join('');
  } catch (e) { showToast(e.message, 'error'); }
}

async function toggleBan(id, currentBanned, btn) {
  btn.disabled = true;
  try {
    await Admin.banUser(id, !currentBanned);
    showToast(currentBanned ? 'User unbanned' : 'User banned');
    loadUsers();
  } catch (e) { showToast(e.message, 'error'); btn.disabled = false; }
}

/* ── Analytics (class-based: fills dashboard + analytics sections) ── */
async function loadAnalytics() {
  try {
    const data = await Admin.analytics();

    const catRows = data.by_category.length
      ? data.by_category.map(r => `
          <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border)">
            <span>${escapeHtml(r.category || 'Uncategorized')}</span>
            <strong>${r.count}</strong>
          </div>`).join('')
      : '<div style="color:var(--muted);text-align:center;padding:1rem">No data yet</div>';
    document.querySelectorAll('.analytics-cats').forEach(el => el.innerHTML = catRows);

    if (data.top_stores.length) {
      const max = data.top_stores[0].count;
      const storeRows = data.top_stores.map(r => `
        <div style="margin-bottom:0.6rem">
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:0.2rem">
            <span>${escapeHtml(r.store)}</span><span>${r.count}</span>
          </div>
          <div style="background:var(--border);border-radius:4px;height:6px">
            <div style="background:var(--accent);height:6px;border-radius:4px;width:${Math.max(4, (r.count / max) * 100).toFixed(0)}%"></div>
          </div>
        </div>`).join('');
      document.querySelectorAll('.analytics-stores').forEach(el => el.innerHTML = storeRows);
    } else {
      document.querySelectorAll('.analytics-stores').forEach(el =>
        el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:1rem">No data yet</div>');
    }

    // 30-day sparkline bars
    const dayEls = document.querySelectorAll('.analytics-days');
    if (dayEls.length && data.by_day.length) {
      const maxDay = Math.max(...data.by_day.map(d => d.count));
      dayEls.forEach(el => {
        el.innerHTML = `
          <div style="display:flex;align-items:flex-end;gap:4px;height:120px">
            ${data.by_day.map(d => `
              <div title="${formatDate(d.date)}: ${d.count} coupons"
                   style="flex:1;background:var(--accent2);min-height:4px;border-radius:3px 3px 0 0;
                          height:${Math.max(4, (d.count / maxDay) * 100)}%"></div>`).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--muted);margin-top:0.4rem">
            <span>${formatDate(data.by_day[0].date)}</span>
            <span>${formatDate(data.by_day[data.by_day.length - 1].date)}</span>
          </div>`;
      });
    }
  } catch (e) { console.error(e); }
}
