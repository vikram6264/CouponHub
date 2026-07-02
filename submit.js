document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  document.getElementById('submit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('form-alert');
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Submitting...';

    const expiry = document.getElementById('expiry_date').value;
    const payload = {
      title: document.getElementById('title').value.trim(),
      code: document.getElementById('code').value.trim().toUpperCase(),
      description: document.getElementById('description').value.trim() || null,
      category: document.getElementById('category').value || null,
      discount_type: document.getElementById('discount_type').value,
      discount_value: parseFloat(document.getElementById('discount_value').value) || null,
      store: document.getElementById('store').value.trim() || null,
      expiry_date: expiry || null,
    };

    try {
      const res = await Coupons.submit(payload);
      showAlert('form-alert', `✓ ${res.message} (+${res.points_earned} points)`, 'success');
      e.target.reset();
      // Update points in localStorage
      const user = getUser();
      if (user) { user.points += res.points_earned; localStorage.setItem('cs_user', JSON.stringify(user)); renderNavUser(); }
    } catch (err) {
      showAlert('form-alert', err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit Coupon';
    }
  });
});
