/* ============================================================
   AURELLE — ADMIN DASHBOARD
   Talks to the API in server/. Token lives in sessionStorage,
   so closing the tab signs you out.
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const TOKEN_KEY = 'aurelle.admin.token';
  let token = null;
  let cache = { products: [], orders: [], messages: [], subs: [] };

  try { token = sessionStorage.getItem(TOKEN_KEY); } catch (e) { token = null; }

  /* ---------------------------------------------------- helpers -- */
  const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function when(iso) {
    if (!iso) return '—';
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    if (isNaN(d)) return iso;
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });

    if (res.status === 401 && token) { signOut(); throw new Error('Session expired — sign in again'); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  }

  /* ------------------------------------------------------- auth -- */
  function showApp(user) {
    $('#loginView').hidden = true;
    $('#appView').hidden = false;
    $('#whoName').textContent = user.name;
    $('#whoEmail').textContent = user.email;
    loadAll();
  }

  function signOut() {
    token = null;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
    $('#appView').hidden = true;
    $('#loginView').hidden = false;
    $('#loginForm').reset();
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#loginError');
    const btn = $('#loginBtn');
    err.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const r = await api('/api/auth/login', {
        method: 'POST',
        body: { email: $('#email').value.trim(), password: $('#password').value },
      });
      token = r.token;
      try { sessionStorage.setItem(TOKEN_KEY, token); } catch (e) {}
      showApp(r.user);
    } catch (e) {
      err.textContent = e.message;
      err.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });

  $('#logoutBtn').addEventListener('click', signOut);

  /* ---------------------------------------------------- routing -- */
  $$('.side nav button').forEach(b => b.addEventListener('click', () => {
    $$('.side nav button').forEach(x => x.classList.toggle('is-active', x === b));
    $$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== b.dataset.view; });
  }));

  /* ---------------------------------------------------- overview -- */
  function renderStats(s) {
    $('#kpis').innerHTML = `
      <div class="kpi"><span>Revenue</span><strong>${inr(s.revenue)}</strong><em>${s.orders} orders all time</em></div>
      <div class="kpi"><span>Average order</span><strong>${inr(s.aov)}</strong><em>Across every order</em></div>
      <div class="kpi"><span>Needs action</span><strong>${s.pending}</strong><em>Placed or packed</em></div>
      <div class="kpi"><span>Live products</span><strong>${s.products}</strong><em>${s.subscribers} subscribers</em></div>`;

    if (s.pending > 0) { $('#pillOrders').hidden = false; $('#pillOrders').textContent = s.pending; }
    else $('#pillOrders').hidden = true;
    if (s.unread > 0) { $('#pillMsgs').hidden = false; $('#pillMsgs').textContent = s.unread; }
    else $('#pillMsgs').hidden = true;

    const peak = Math.max(1, ...s.daily.map(d => d.revenue));
    $('#chart').innerHTML = s.daily.length
      ? s.daily.map(d => {
          const day = d.day.slice(8) + '/' + d.day.slice(5, 7);
          return `<div class="chart__bar" style="height:${Math.max(3, (d.revenue / peak) * 100)}%"
                       data-label="${day}"><span>${inr(d.revenue)} · ${d.orders} orders</span></div>`;
        }).join('')
      : `<p class="tbl__sub">No orders yet. Place one on the storefront and it appears here.</p>`;

    $('#topProducts').innerHTML = s.topProducts.length
      ? s.topProducts.map(p => `<tr>
          <td><span class="tbl__name">${esc(p.name)}</span></td>
          <td class="num">${p.units} sold</td>
          <td class="num">${inr(p.revenue)}</td></tr>`).join('')
      : `<tr><td class="tbl__sub">Nothing sold yet.</td></tr>`;

    $('#lowStock').innerHTML = s.lowStock.length
      ? s.lowStock.map(p => `<tr>
          <td><span class="tbl__name">${esc(p.name)}</span></td>
          <td class="num"><span class="tag ${p.stock <= 3 ? 'tag--low' : 'tag--ok'}">${p.stock} left</span></td>
          </tr>`).join('')
      : `<tr><td class="tbl__sub">Every product is above ten units.</td></tr>`;
  }

  /* ------------------------------------------------------ orders -- */
  function renderOrders() {
    const q = $('#orderSearch').value.toLowerCase();
    const st = $('#orderStatus').value;
    const list = cache.orders.filter(o =>
      (st === 'all' || o.status === st) &&
      (!q || (o.ref + o.email + o.first_name + o.last_name).toLowerCase().includes(q)));

    $('#ordersBody').innerHTML = list.length ? list.map(o => `
      <tr>
        <td><span class="tbl__name">${esc(o.ref)}</span></td>
        <td>${esc(o.first_name)} ${esc(o.last_name)}<div class="tbl__sub">${esc(o.email)}<br>${esc(o.city)} ${esc(o.pincode)}</div></td>
        <td class="tbl__sub">${o.items.map(i => `${esc(i.name)} × ${i.qty}`).join('<br>')}</td>
        <td class="num">${inr(o.total)}</td>
        <td>
          <select class="status-select" data-order="${esc(o.ref)}">
            ${['placed','packed','shipped','delivered','cancelled'].map(s =>
              `<option value="${s}"${o.status === s ? ' selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
          </select>
          <div style="margin-top:6px"><span class="tag tag--${esc(o.status)}">${esc(o.status)}</span></div>
        </td>
        <td class="tbl__sub">${when(o.created_at)}</td>
      </tr>`).join('')
      : `<tr><td colspan="6"><div class="state"><h3>No orders here</h3>
           <p>Place a test order on the storefront and refresh.</p></div></td></tr>`;
  }

  $('#ordersBody').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-order]');
    if (!sel) return;
    const ref = sel.dataset.order;
    const prev = cache.orders.find(o => o.ref === ref)?.status;
    try {
      await api(`/api/admin/orders/${ref}`, { method: 'PATCH', body: { status: sel.value } });
      const o = cache.orders.find(x => x.ref === ref);
      if (o) o.status = sel.value;
      renderOrders();
      loadStats();
    } catch (err) {
      alert(err.message);
      sel.value = prev;
    }
  });

  $('#orderSearch').addEventListener('input', renderOrders);
  $('#orderStatus').addEventListener('change', renderOrders);

  /* ---------------------------------------------------- products -- */
  function renderProducts() {
    const q = $('#productSearch').value.toLowerCase();
    const list = cache.products.filter(p => !q || (p.name + p.cat + p.metal).toLowerCase().includes(q));

    $('#productsBody').innerHTML = list.length ? list.map(p => `
      <tr>
        <td><img class="tbl__thumb" src="../${esc(p.img)}" alt=""></td>
        <td><span class="tbl__name">${esc(p.name)}</span><div class="tbl__sub">${esc(p.slug)}</div></td>
        <td class="tbl__sub">${esc(p.cat)}<br>${esc(p.metal)}</td>
        <td class="num">${inr(p.price)}</td>
        <td class="num tbl__sub">${inr(p.mrp)}</td>
        <td class="num"><span class="tag ${p.stock <= 10 ? 'tag--low' : 'tag--ok'}">${p.stock}</span></td>
        <td>
          <button class="link-btn" data-edit="${esc(p.slug)}">Edit</button>
          <button class="link-btn link-btn--danger" data-archive="${esc(p.slug)}" style="margin-left:var(--space-3)">Archive</button>
        </td>
      </tr>`).join('')
      : `<tr><td colspan="7"><div class="state"><h3>No products match</h3></div></td></tr>`;
  }

  $('#productSearch').addEventListener('input', renderProducts);

  const scrim = $('#productScrim');
  function openProduct(slug) {
    const p = slug ? cache.products.find(x => x.slug === slug) : null;
    $('#productModalTitle').textContent = p ? 'Edit product' : 'Add product';
    $('#pSlug').value = p ? p.slug : '';
    $('#pSlug').readOnly = !!p;
    $('#pName').value = p ? p.name : '';
    $('#pCat').value = p ? p.cat : 'Necklace Sets';
    $('#pMetal').value = p ? p.metal : 'Gold';
    $('#pPrice').value = p ? p.price : '';
    $('#pMrp').value = p ? p.mrp : '';
    $('#pStock').value = p ? p.stock : 25;
    $('#pBadge').value = p && p.badge ? p.badge : '';
    $('#pBlurb').value = p ? (p.blurb || '') : '';
    $('#productError').style.display = 'none';
    $$('.field--error', scrim).forEach(f => f.classList.remove('field--error'));
    scrim.classList.add('is-open');
  }
  const closeProduct = () => scrim.classList.remove('is-open');

  $('#newProductBtn').addEventListener('click', () => openProduct(null));
  $('#cancelProduct').addEventListener('click', closeProduct);
  scrim.addEventListener('click', e => { if (e.target === scrim) closeProduct(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProduct(); });

  $('#productsBody').addEventListener('click', async (e) => {
    const edit = e.target.closest('[data-edit]');
    if (edit) return openProduct(edit.dataset.edit);

    const arch = e.target.closest('[data-archive]');
    if (arch) {
      const p = cache.products.find(x => x.slug === arch.dataset.archive);
      if (!confirm(`Archive "${p ? p.name : arch.dataset.archive}"? It will disappear from the storefront.`)) return;
      try {
        await api(`/api/admin/products/${arch.dataset.archive}`, { method: 'DELETE' });
        await loadProducts();
        loadStats();
      } catch (err) { alert(err.message); }
    }
  });

  $('#productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#productError');
    err.style.display = 'none';

    const body = {
      slug: $('#pSlug').value.trim().toLowerCase(),
      name: $('#pName').value.trim(),
      cat: $('#pCat').value,
      metal: $('#pMetal').value,
      price: Number($('#pPrice').value),
      mrp: Number($('#pMrp').value),
      stock: Number($('#pStock').value),
      badge: $('#pBadge').value || null,
      blurb: $('#pBlurb').value.trim(),
    };

    let ok = true;
    const flag = (id, bad) => { $(id).closest('.field').classList.toggle('field--error', bad); if (bad) ok = false; };
    flag('#pSlug', !/^[a-z0-9-]+$/.test(body.slug));
    flag('#pName', !body.name);
    flag('#pPrice', !(body.price > 0));
    flag('#pMrp', !(body.mrp >= body.price));
    if (!ok) return;

    try {
      await api('/api/admin/products', { method: 'POST', body });
      closeProduct();
      await loadProducts();
      loadStats();
    } catch (e2) {
      err.textContent = e2.message;
      err.style.display = 'block';
    }
  });

  /* ---------------------------------------------------- messages -- */
  function renderMessages() {
    $('#messagesBody').innerHTML = cache.messages.length ? cache.messages.map(m => `
      <div class="msg${m.handled ? ' is-handled' : ''}">
        <div class="msg__head">
          <strong>${esc(m.name)}</strong>
          <span>${esc(m.email)}</span>
          ${m.order_ref ? `<span class="tag tag--placed">${esc(m.order_ref)}</span>` : ''}
          <span>${esc(m.subject || 'General')}</span>
          <span style="margin-left:auto">${when(m.created_at)}</span>
          <button class="link-btn" data-handled="${esc(m.id)}" data-to="${m.handled ? 0 : 1}">
            ${m.handled ? 'Reopen' : 'Mark handled'}</button>
        </div>
        <p class="msg__body">${esc(m.body)}</p>
      </div>`).join('')
      : `<div class="state"><h3>No messages</h3><p>Enquiries from the contact form land here.</p></div>`;
  }

  $('#messagesBody').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-handled]');
    if (!b) return;
    try {
      await api(`/api/admin/messages/${b.dataset.handled}`, {
        method: 'PATCH', body: { handled: b.dataset.to === '1' },
      });
      await loadMessages();
      loadStats();
    } catch (err) { alert(err.message); }
  });

  /* -------------------------------------------------- subscribers -- */
  function renderSubs() {
    $('#subsBody').innerHTML = cache.subs.length
      ? cache.subs.map(s => `<tr><td>${esc(s.email)}</td><td class="tbl__sub">${when(s.created_at)}</td></tr>`).join('')
      : `<tr><td colspan="2"><div class="state"><h3>No subscribers yet</h3></div></td></tr>`;
  }

  $('#exportSubs').addEventListener('click', () => {
    if (!cache.subs.length) return alert('Nothing to export yet.');
    const csv = 'email,joined\n' + cache.subs.map(s => `${s.email},${s.created_at}`).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aurelle-subscribers.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  /* -------------------------------------------------------- load -- */
  async function loadStats()    { renderStats(await api('/api/admin/stats')); }
  async function loadOrders()   { cache.orders = (await api('/api/admin/orders')).orders; renderOrders(); }
  async function loadProducts() { cache.products = (await api('/api/admin/products')).products; renderProducts(); }
  async function loadMessages() { cache.messages = (await api('/api/admin/messages')).messages; renderMessages(); }
  async function loadSubs()     { cache.subs = (await api('/api/admin/subscribers')).subscribers; renderSubs(); }

  async function loadAll() {
    try {
      await Promise.all([loadStats(), loadOrders(), loadProducts(), loadMessages(), loadSubs()]);
    } catch (e) {
      console.error(e);
      if (token) alert(`Could not load dashboard data: ${e.message}`);
    }
  }

  $('#refreshBtn').addEventListener('click', loadAll);

  /* -------------------------------------------------------- boot -- */
  (async function boot() {
    if (!token) return;
    try {
      const me = await api('/api/auth/me');
      showApp(me.user);
    } catch (e) { signOut(); }
  })();
})();
