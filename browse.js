let currentPage = 1;
let totalPages = 1;

async function loadCoupons() {
  const search = document.getElementById('search')?.value || '';
  const category = document.getElementById('filter-cat')?.value || '';
  const store = document.getElementById('filter-store')?.value || '';

  const grid = document.getElementById('coupon-grid');
  grid.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted)"><div class="spinner"></div></div>';

  try {
    const data = await Coupons.browse({ search, category, store, page: currentPage, limit: 12 });
    totalPages = data.pages;
    renderCoupons(data.coupons);
    renderPagination(data.total);
  } catch (e) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Failed to load</h3><p>${e.message}</p></div>`;
  }
}

function renderCoupons(coupons) {
  const grid = document.getElementById('coupon-grid');
  if (!coupons.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">🎟️</div><h3>No coupons found</h3><p>Try a different search or category</p></div>';
    return;
  }

  const user = getUser();
  grid.innerHTML = coupons.map(c => {
    const days = daysLeft(c.expiry_date);
    const expStr = days === null ? '' : days <= 3 ? `<div class="expiry-tag soon">⚠ Expires in ${days}d</div>` : `<div class="expiry-tag">Expires ${formatDate(c.expiry_date)}</div>`;
    const discount = c.discount_value ? `${c.discount_value}${c.discount_type === 'percent' ? '%' : '₹'} OFF` : 'DEAL';
    return `
      <div class="coupon-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div class="coupon-store">${c.store || 'General'}</div>
          ${c.category ? `<span class="badge badge-category">${c.category}</span>` : ''}
        </div>
        <div class="coupon-title">${c.title}</div>
        <div class="coupon-discount">${discount}</div>
        <div class="coupon-code-box" onclick="copyCoupon('${c.code}',this)">
          <span class="coupon-code">${c.code}</span>
          <span class="copy-hint">Click to copy</span>
        </div>
        ${c.description ? `<p style="font-size:0.82rem;color:var(--muted);margin-bottom:0.5rem">${c.description}</p>` : ''}
        ${expStr}
        <div style="margin-top:1rem;display:flex;gap:0.5rem;align-items:center">
          <button onclick="claimCoupon(${c.id},this)" class="btn btn-primary btn-sm btn-full">
            ${user ? 'Claim & Copy' : 'Login to Claim'}
          </button>
        </div>
        <div style="margin-top:0.6rem;font-size:0.75rem;color:var(--muted)">🔥 ${c.claim_count} claimed · by ${c.submitter_name || 'Anonymous'}</div>
      </div>`;
  }).join('');
}

function copyCoupon(code, el) {
  navigator.clipboard.writeText(code).then(() => {
    const hint = el.querySelector('.copy-hint');
    if (hint) { hint.textContent = 'Copied!'; setTimeout(() => hint.textContent = 'Click to copy', 2000); }
    showToast('Code copied: ' + code);
  });
}

async function claimCoupon(id, btn) {
  if (!isLoggedIn()) { window.location.href = 'login.html'; return; }
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';
  try {
    const data = await Coupons.claim(id);
    await navigator.clipboard.writeText(data.code).catch(() => {});
    showToast('Claimed! Code: ' + data.code);
    btn.textContent = '✓ Claimed';
    btn.style.background = 'var(--green)';
  } catch (e) {
    showToast(e.message, 'error');
    btn.textContent = 'Claim & Copy';
    btn.disabled = false;
  }
}

function renderPagination(total) {
  const pg = document.getElementById('pagination');
  if (!pg || totalPages <= 1) { if (pg) pg.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  pg.innerHTML = html;
}

function goPage(p) { currentPage = p; loadCoupons(); window.scrollTo(0,0); }

async function loadCategories() {
  try {
    const cats = await Coupons.categories();
    const sel = document.getElementById('filter-cat');
    if (!sel) return;
    cats.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
  } catch {}
}

let searchTimer;
function onSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(() => { currentPage = 1; loadCoupons(); }, 400); }

document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadCoupons();
  document.getElementById('search')?.addEventListener('input', onSearch);
  document.getElementById('filter-cat')?.addEventListener('change', () => { currentPage = 1; loadCoupons(); });
  document.getElementById('filter-store')?.addEventListener('input', onSearch);
});
