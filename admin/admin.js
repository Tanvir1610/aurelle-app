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
  let token = null;                 // local-auth token
  let cfg = { auth: 'local' };      // filled from /api/config
  let clerk = null;                 // Clerk instance when auth=clerk
  let clerkReady = false;           // true only after load() resolves
  let clerkError = null;            // why it failed, if it did
  let pendingSignIn = false;        // user clicked before Clerk was ready
  let cache = { products: [], orders: [], messages: [], subs: [] };

  try { token = sessionStorage.getItem(TOKEN_KEY); } catch (e) { token = null; }

  /** Current bearer token, whichever auth driver is active. */
  async function bearer() {
    if (cfg.auth === 'clerk') {
      if (!clerk || !clerk.session) return null;
      try { return await clerk.session.getToken(); } catch (e) { return null; }
    }
    return token;
  }

  function loadClerkScript(publishableKey, frontendApi) {
    return new Promise((resolve, reject) => {
      if (window.Clerk) return resolve(window.Clerk);
      const s = document.createElement('script');
      s.async = true; s.crossOrigin = 'anonymous';
      s.dataset.clerkPublishableKey = publishableKey;
      s.src = `https://${frontendApi}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
      s.onload = () => resolve(window.Clerk);
      s.onerror = () => reject(new Error('Clerk script blocked or unreachable'));
      document.head.appendChild(s);
      setTimeout(() => {
        if (!window.Clerk) reject(new Error('Clerk script did not load in time'));
      }, 12000);
    });
  }

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
    ]);
  }

  /**
   * Open Clerk's sign-in. The modal occasionally refuses to mount (blocked
   * third-party frames, unregistered origin); fall back to the hosted page,
   * and tell the user if even that is impossible.
   */
  function openClerkSignIn() {
    if (!clerkReady || !clerk) { pendingSignIn = true; return; }
    try {
      clerk.openSignIn({ afterSignInUrl: window.location.href });
    } catch (e) {
      try {
        clerk.redirectToSignIn({ afterSignInUrl: window.location.href });
      } catch (e2) {
        clerkError = e2.message || e.message;
        renderLogin();
      }
    }
  }

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
    const t = await bearer();
    if (t) headers.authorization = `Bearer ${t}`;
    const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });

    if (res.status === 401 && t) { signOut(); throw new Error('Session expired — sign in again'); }
    if (res.status === 403) {
      const who = cfg.auth === 'clerk' && clerk && clerk.user
        ? (clerk.user.primaryEmailAddress?.emailAddress || 'This account')
        : 'This account';
      showDenied(who);
      throw new Error('Not an administrator');
    }
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

  async function signOut() {
    token = null;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
    if (cfg.auth === 'clerk' && clerk) { try { await clerk.signOut(); } catch (e) {} }
    $('#appView').hidden = true;
    $('#loginView').hidden = false;
    $('#loginForm').reset();
    renderLogin();
  }

  /** Signed in with Clerk, but not on the admin allow-list. */
  function showDenied(who) {
    const noneConfigured = cfg.adminCount === 0;
    $('#appView').hidden = true;
    $('#loginView').hidden = false;
    $('#loginPanel').innerHTML = `
      <h1>${noneConfigured ? 'No administrators configured' : 'Not an administrator'}</h1>
      <p style="font-size:var(--fs-sm);color:var(--text-secondary);line-height:var(--lh-relaxed)">
        <strong>${who}</strong> signed in successfully, but ${noneConfigured
          ? 'this shop has no administrator accounts at all.'
          : 'is not on the admin list for this shop.'}
      </p>
      <div class="login-hint" style="margin-top:var(--space-5)">
        ${noneConfigured
          ? `Set <code>ADMIN_EMAIL</code> on the server to the address you just
             signed in with, then restart. It is applied on every boot.`
          : `The server's <code>ADMIN_EMAIL</code> is set to a different address.
             Change it to this one and restart, or add this address to the
             admin list.`}
      </div>
      <button class="btn btn--ghost btn--block" type="button" id="denyOut"
              style="margin-top:var(--space-5)">Sign out</button>`;
    $('#denyOut').addEventListener('click', signOut);
  }

  /** Paints either the Clerk button or the password form. */
  function renderLogin() {
    const panel = $('#loginPanel');
    if (cfg.auth === 'clerk') {
      if (clerkError) {
        panel.innerHTML = `
          <h1>Sign-in unavailable</h1>
          <p style="font-size:var(--fs-sm);color:var(--red-500);text-align:center;margin-bottom:var(--space-5)">
            ${clerkError}</p>
          <div class="login-hint" style="margin-bottom:var(--space-5)">
            Usually one of: this site's address is not listed in Clerk under
            <strong>Domains</strong>, the keys on the server are for a different
            Clerk instance, or a browser extension is blocking the script.
          </div>
          <button class="btn btn--gold btn--block" type="button" id="clerkRetry">Try again</button>`;
        $('#clerkRetry').addEventListener('click', startClerk);
        return;
      }

      const waiting = !clerkReady;
      panel.innerHTML = `
        <h1>Store dashboard</h1>
        <p style="font-size:var(--fs-sm);color:var(--text-secondary);text-align:center;margin-bottom:var(--space-6)">
          We email you a one-time code.
        </p>
        <button class="btn btn--gold btn--block" type="button" id="clerkSignIn"
                ${waiting ? 'disabled' : ''}>
          ${waiting ? 'Preparing sign-in…' : 'Sign in with email'}
        </button>
        <div class="login-hint">
          Only addresses in the admin list can open this dashboard. Signing in
          with any other account is refused.
        </div>`;
      const btn = $('#clerkSignIn');
      if (btn) btn.addEventListener('click', openClerkSignIn);
    } else {
      panel.innerHTML = `
        <h1>Store dashboard</h1>
        <div class="field"><label for="email">Email</label>
          <input id="email" type="email" autocomplete="username" required></div>
        <div class="field"><label for="password">Password</label>
          <input id="password" type="password" autocomplete="current-password" required></div>
        <div id="loginError" style="display:none;color:var(--red-500);font-size:var(--fs-xs);margin-bottom:var(--space-4)"></div>
        <button class="btn btn--primary btn--block" type="submit" id="loginBtn">Sign in</button>
        <div class="login-hint">
          Set <code>ADMIN_EMAIL</code> and <code>ADMIN_PASSWORD</code> to change these.
          They are re-applied on every restart.
        </div>`;
    }
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (cfg.auth === 'clerk') return;
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
    /* Compare the last 7 days against the 7 before, so the KPIs say
       whether things are moving rather than just where they stand. */
    const days = s.daily || [];
    const last7 = days.slice(-7).reduce((a, d) => a + Number(d.revenue), 0);
    const prev7 = days.slice(-14, -7).reduce((a, d) => a + Number(d.revenue), 0);
    const delta = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;

    const trend = (pct) => {
      if (pct === null) return `<span class="kpi__trend kpi__trend--flat">no earlier data</span>`;
      const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
      const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '—';
      return `<span class="kpi__trend kpi__trend--${dir}">${arrow} ${Math.abs(pct)}% vs previous week</span>`;
    };

    $('#kpis').innerHTML = `
      <div class="kpi"><span>Revenue</span><strong>${inr(s.revenue)}</strong>
        ${trend(delta)}</div>
      <div class="kpi kpi--info"><span>Average order</span><strong>${inr(s.aov)}</strong>
        <em>${s.orders} orders all time</em></div>
      <div class="kpi ${s.pending > 0 ? 'kpi--warn' : 'kpi--good'}"><span>Needs action</span>
        <strong>${s.pending}</strong><em>placed or packed</em></div>
      <div class="kpi kpi--good"><span>Customers</span><strong>${s.customers ?? 0}</strong>
        <em>${s.subscribers} on the mailing list</em></div>`;

    if (s.pending > 0) { $('#pillOrders').hidden = false; $('#pillOrders').textContent = s.pending; }
    else $('#pillOrders').hidden = true;
    if (s.unread > 0) { $('#pillMsgs').hidden = false; $('#pillMsgs').textContent = s.unread; }
    else $('#pillMsgs').hidden = true;

    /* revenue chart */
    const peak = Math.max(1, ...days.map(d => Number(d.revenue)));
    $('#chart').innerHTML = days.length
      ? days.map(d => {
          const day = d.day.slice(8) + '/' + d.day.slice(5, 7);
          return `<div class="chart__bar" style="height:${Math.max(3, (Number(d.revenue) / peak) * 100)}%"
                       data-label="${day}"><span>${inr(d.revenue)} · ${d.orders} orders</span></div>`;
        }).join('')
      : `<p class="tbl__sub">No orders yet. Place one on the storefront and it appears here.</p>`;

    /* order status funnel */
    const byStatus = {};
    (s.byStatus || []).forEach(x => { byStatus[x.status] = Number(x.n); });
    const maxN = Math.max(1, ...Object.values(byStatus));
    const ORDER = ['placed', 'packed', 'shipped', 'delivered', 'cancelled'];
    $('#funnel').innerHTML = ORDER.map(st => {
      const n = byStatus[st] || 0;
      return `<div class="funnel__row">
        <span class="funnel__label">${st}</span>
        <div class="funnel__bar"><div class="funnel__fill funnel__fill--${st}"
             style="width:${(n / maxN) * 100}%"></div></div>
        <span class="funnel__n">${n}</span>
      </div>`;
    }).join('');

    /* best sellers with a mini bar for share of units */
    const top = s.topProducts || [];
    const topMax = Math.max(1, ...top.map(p => Number(p.units)));
    $('#topProducts').innerHTML = top.length
      ? top.map(p => `<tr>
          <td><span class="tbl__name">${esc(p.name)}</span>
            <div class="tbl__sub">${inr(p.revenue)} revenue</div></td>
          <td style="width:110px"><div class="funnel__bar" style="height:8px">
            <div class="funnel__fill funnel__fill--delivered"
                 style="width:${(Number(p.units) / topMax) * 100}%"></div></div></td>
          <td class="num">${p.units}</td></tr>`).join('')
      : `<tr><td class="tbl__sub">Nothing sold yet.</td></tr>`;

    /* low stock */
    $('#lowStock').innerHTML = (s.lowStock || []).length
      ? s.lowStock.map(p => `<tr>
          <td><span class="tbl__name">${esc(p.name)}</span></td>
          <td class="num"><span class="tag ${p.stock <= 3 ? 'tag--low' : 'tag--ok'}">${p.stock} left</span></td>
          <td class="num"><button class="link-btn" data-edit="${esc(p.slug)}">Restock</button></td>
          </tr>`).join('')
      : `<tr><td class="tbl__sub">Every product is above ten units.</td></tr>`;

    renderFeed();
  }

  /** Recent activity, assembled from orders and messages already in cache. */
  function renderFeed() {
    const host = $('#feed');
    if (!host) return;

    const events = [];
    cache.orders.slice(0, 6).forEach(o => events.push({
      at: o.created_at, icon: 'bag',
      title: `${o.first_name} ${o.last_name} ordered ${inr(o.total)}`,
      sub: `${o.ref} · ${o.items.length} item${o.items.length === 1 ? '' : 's'} · ${o.city}`,
    }));
    cache.messages.slice(0, 4).forEach(m => events.push({
      at: m.created_at, icon: 'mail',
      title: `${m.name} sent an enquiry`,
      sub: m.subject || 'General',
    }));

    events.sort((a, b) => String(b.at).localeCompare(String(a.at)));

    const ICONS = {
      bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/>',
      mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>',
    };

    host.innerHTML = events.length
      ? `<div class="feed">${events.slice(0, 8).map(e => `
          <div class="feed__item">
            <span class="feed__dot"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.6">${ICONS[e.icon]}</svg></span>
            <div class="feed__body">
              <strong>${esc(e.title)}</strong>
              <div>${esc(e.sub)} · ${when(e.at)}</div>
            </div>
          </div>`).join('')}</div>`
      : `<p class="tbl__sub">Nothing has happened yet.</p>`;
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
  async function loadOrders()   { cache.orders = (await api('/api/admin/orders')).orders; renderOrders(); renderFeed(); }
  async function loadProducts() { cache.products = (await api('/api/admin/products')).products; renderProducts(); }
  async function loadMessages() { cache.messages = (await api('/api/admin/messages')).messages; renderMessages(); renderFeed(); }
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

  /** Load and start Clerk, updating the login panel as it goes. */
  async function startClerk() {
    clerkError = null;
    clerkReady = false;
    renderLogin();

    try {
      await withTimeout(
        loadClerkScript(cfg.clerk.publishableKey, cfg.clerk.frontendApi),
        14000, 'Loading sign-in');

      const instance = window.Clerk;
      // Only publish the instance once load() has actually finished —
      // calling openSignIn() before then silently does nothing.
      await withTimeout(instance.load({ afterSignOutUrl: window.location.href }),
                        14000, 'Starting sign-in');

      clerk = instance;
      clerkReady = true;
      renderLogin();

      clerk.addListener(async () => {
        if (clerk.user && $('#appView').hidden) {
          try {
            const me = await api('/api/auth/me');
            showApp(me.user);
          } catch (e) { /* showDenied handles 403 */ }
        }
      });

      if (clerk.user) {
        try {
          const me = await api('/api/auth/me');
          showApp(me.user);
        } catch (e) { /* handled */ }
      } else if (pendingSignIn) {
        // They clicked while we were still loading — honour it now.
        pendingSignIn = false;
        openClerkSignIn();
      }
    } catch (e) {
      clerkError = e.message;
      clerkReady = false;
      renderLogin();
    }
  }

  /* -------------------------------------------------------- boot -- */
  (async function boot() {
    try {
      cfg = await (await fetch('/api/config')).json();
    } catch (e) { cfg = { auth: 'local' }; }

    renderLogin();

    if (cfg.auth === 'clerk' && cfg.clerk && cfg.clerk.enabled) {
      startClerk();
      return;
    }

    if (!token) return;
    try {
      const me = await api('/api/auth/me');
      showApp(me.user);
    } catch (e) { signOut(); }
  })();
})();
