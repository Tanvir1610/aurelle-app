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
  let cache = { products: [], orders: [], messages: [], subs: [],
                customers: [], guests: [], admins: [], images: [] };

  /* Editor working state — the piece currently open in the modal. */
  let draft = { img: null, imgAlt: null, occasion: [], swatches: [] };

  const OCCASIONS = ['Everyday', 'Office', 'Wedding', 'Festive', 'Gifting'];
  const FINISHES = [
    { key: 'gold',    color: '#b8935a', label: 'Gold' },
    { key: 'rose',    color: '#c08a82', label: 'Rose Gold' },
    { key: 'silver',  color: '#e6e2dc', label: 'Silver' },
    { key: 'pearl',   color: '#f0e9dd', label: 'Pearl' },
    { key: 'emerald', color: '#2f5d4e', label: 'Emerald' },
    { key: 'ruby',    color: '#8e2a3b', label: 'Ruby' },
  ];

  try { token = sessionStorage.getItem(TOKEN_KEY); } catch (e) { token = null; }

  /** Current bearer token, whichever auth driver is active. */
  async function bearer() {
    // A password token, once issued, is authoritative — it does not depend
    // on Clerk being reachable.
    if (token) return token;
    if (cfg.auth === 'clerk' && clerk && clerk.session) {
      try { return await clerk.session.getToken(); } catch (e) { return null; }
    }
    return null;
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

    /* Under Clerk, a 401 must not sign the user out. Clerk owns the session;
       a 401 here means our server could not accept the token, which is a
       server-side configuration problem. Signing out would bounce them back
       to the login card and loop forever. */
    if (res.status === 401 && t) {
      if (cfg.auth === 'clerk') {
        let detail = '';
        try { detail = (await res.clone().json()).error || ''; } catch (e) {}
        showBlocked('Your session was rejected by the server', detail ||
          'The server could not verify the sign-in token.');
        throw new Error('Session rejected');
      }
      signOut();
      throw new Error('Session expired — sign in again');
    }

    if (res.status === 403) {
      let payload = {};
      try { payload = await res.clone().json(); } catch (e) {}
      const who = payload.email ||
        (clerk && clerk.user && clerk.user.primaryEmailAddress
          ? clerk.user.primaryEmailAddress.emailAddress : 'This account');
      if (payload.detail || payload.fix) {
        showBlocked(payload.error, `${payload.detail || ''}\n${payload.fix || ''}`.trim());
      } else {
        showDenied(who);
      }
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

  /**
   * Signed in, but the server will not let us in — and it is a configuration
   * problem rather than the wrong account. Keep the Clerk session alive so a
   * retry works the moment the server is fixed.
   */
  function showBlocked(title, detail) {
    $('#appView').hidden = true;
    $('#loginView').hidden = false;
    $('#loginPanel').innerHTML = `
      <h1>${esc(title)}</h1>
      <p style="font-size:var(--fs-sm);color:var(--text-secondary);line-height:var(--lh-relaxed);
                white-space:pre-line">${esc(detail || '')}</p>
      <button class="btn btn--gold btn--block" type="button" id="blockedRetry"
              style="margin-top:var(--space-5)">Try again</button>
      <button class="btn btn--ghost btn--block" type="button" id="blockedOut"
              style="margin-top:var(--space-3)">Sign out</button>`;
    $('#blockedRetry').addEventListener('click', async () => {
      try {
        const me = await api('/api/auth/me');
        showApp(me.user);
      } catch (e) { /* the screen has already been repainted */ }
    });
    $('#blockedOut').addEventListener('click', signOut);
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

  /** Paints the sign-in options this deployment actually supports. */
  function renderLogin() {
    const panel = $('#loginPanel');
    const useClerk = cfg.auth === 'clerk' && cfg.clerk && cfg.clerk.enabled;
    const usePassword = cfg.passwordLogin !== false;

    if (useClerk && clerkError) {
      panel.innerHTML = `
        <h1>Sign-in service unavailable</h1>
        <p style="font-size:var(--fs-sm);color:var(--red-500);text-align:center;margin-bottom:var(--space-4)">
          ${esc(clerkError)}</p>
        ${usePassword ? `
          <div class="login-hint" style="margin-bottom:var(--space-5)">
            You can still sign in with your email and password below.
          </div>${passwordFormHTML()}` : `
          <div class="login-hint" style="margin-bottom:var(--space-5)">
            Check that this site's address is listed in Clerk under Domains, and
            that both Clerk keys come from the same instance.
          </div>
          <button class="btn btn--gold btn--block" type="button" id="clerkRetry">Try again</button>`}`;
      $('#clerkRetry')?.addEventListener('click', startClerk);
      wirePasswordForm();
      return;
    }

    let html = '<h1>Store dashboard</h1>';

    if (useClerk) {
      const waiting = !clerkReady;
      html += `
        <p style="font-size:var(--fs-sm);color:var(--text-secondary);text-align:center;margin-bottom:var(--space-5)">
          We email you a one-time code.
        </p>
        <button class="btn btn--gold btn--block" type="button" id="clerkSignIn"
                ${waiting ? 'disabled' : ''}>
          ${waiting ? 'Preparing sign-in…' : 'Sign in with email code'}
        </button>`;
      if (usePassword) {
        html += `
          <div style="display:flex;align-items:center;gap:var(--space-3);margin:var(--space-5) 0">
            <span style="flex:1;height:1px;background:var(--border)"></span>
            <span style="font-size:var(--fs-xs);color:var(--text-muted);
                         letter-spacing:var(--ls-wide);text-transform:uppercase">or</span>
            <span style="flex:1;height:1px;background:var(--border)"></span>
          </div>${passwordFormHTML()}`;
      }
    } else if (usePassword) {
      html += passwordFormHTML();
    } else {
      html += `<div class="login-hint">
        No sign-in method is configured. Set <code>ADMIN_PASSWORD</code>, or
        configure Clerk, then restart the server.</div>`;
    }

    html += `<div class="login-hint">
      Only addresses on the admin list can open this dashboard.
    </div>`;

    panel.innerHTML = html;
    $('#clerkSignIn')?.addEventListener('click', openClerkSignIn);
    wirePasswordForm();
  }

  function passwordFormHTML() {
    return `
      <div class="field"><label for="email">Email</label>
        <input id="email" type="email" autocomplete="username"
               value="${esc(cfg.adminHint || '')}"></div>
      <div class="field"><label for="password">Password</label>
        <input id="password" type="password" autocomplete="current-password"></div>
      <div id="loginError" style="display:none;color:var(--red-500);font-size:var(--fs-xs);
           margin-bottom:var(--space-4)"></div>
      <button class="btn btn--primary btn--block" type="button" id="pwSignIn">Sign in with password</button>`;
  }

  function wirePasswordForm() {
    const btn = $('#pwSignIn');
    if (!btn) return;
    btn.addEventListener('click', doPasswordLogin);
    $('#password')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); doPasswordLogin(); }
    });
  }

  async function doPasswordLogin() {
    const err = $('#loginError');
    const btn = $('#pwSignIn');
    if (err) err.style.display = 'none';
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
      if (err) { err.textContent = e.message; err.style.display = 'block'; }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in with password';
    }
  }

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

    // A stored password session takes precedence and needs no Clerk at all.
    if (token) {
      try {
        const me = await api('/api/auth/me');
        return showApp(me.user);
      } catch (e) { token = null; try { sessionStorage.removeItem(TOKEN_KEY); } catch (e2) {} }
    }

    if (cfg.auth === 'clerk' && cfg.clerk && cfg.clerk.enabled) {
      startClerk();
    }
  })();
})();
