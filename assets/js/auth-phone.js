/* ============================================================
   AURELLE — PHONE SIGN-IN
   ------------------------------------------------------------
   Mobile number, then a one-time code. A number we have not
   seen before is asked for a name before the account is made.

   Wherever the shopper was heading is remembered, so after
   signing in they land there rather than back at the top.
   ============================================================ */
window.AU_PHONE = (function () {

  const KEY = 'aurelle.customer.token';
  const RETURN_KEY = 'aurelle.returnTo';

  let token = null;
  let me = null;
  const listeners = [];

  try { token = localStorage.getItem(KEY); } catch (e) { token = null; }

  const emit = () => listeners.forEach(fn => { try { fn(state()); } catch (e) {} });

  function state() {
    return { signedIn: !!token, customer: me };
  }

  async function req(path, body) {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: Object.assign({},
        body ? { 'content-type': 'application/json' } : {},
        token ? { authorization: `Bearer ${token}` } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.retryAfter = data && data.retryAfter;
      throw err;
    }
    return data;
  }

  /* Ask for a code. Returns whether this number is new to us. */
  const requestCode = (phone) => req('/api/auth/otp/request', { phone });

  /* Verify. A new customer supplies a name at the same time. */
  let regToken = null;

  async function verifyCode(phone, code, profile) {
    const payload = Object.assign({ phone }, profile || {});
    // After the code is spent, the ticket stands in for it.
    if (regToken && profile && profile.name) payload.regToken = regToken;
    else payload.code = code;

    const r = await req('/api/auth/otp/verify', payload);
    if (r.needsRegistration) {
      regToken = r.regToken || null;        // hold it for the register step
      return r;
    }
    regToken = null;
    token = r.token;
    try { localStorage.setItem(KEY, token); } catch (e) {}
    me = r.customer;
    emit();
    return r;
  }

  function signOut() {
    token = null;
    me = null;
    try { localStorage.removeItem(KEY); } catch (e) {}
    emit();
  }

  /** Load the signed-in shopper, if the stored token is still good. */
  async function load() {
    if (!token) { emit(); return state(); }
    try {
      const r = await req('/api/me/phone');
      me = r.customer;
      me.orders = r.orders || [];
    } catch (e) {
      token = null;
      try { localStorage.removeItem(KEY); } catch (e2) {}
    }
    emit();
    return state();
  }

  /* --------------------------------------------- return-to-page -- */
  /** Remember where the shopper was headed before we asked them to sign in. */
  function rememberReturn(url) {
    try { sessionStorage.setItem(RETURN_KEY, url || location.href); } catch (e) {}
  }

  /** Where to send them afterwards. Same-origin only — an open redirect
      here would let a phishing link bounce people off the site. */
  function takeReturn(fallback) {
    let url = null;
    try {
      url = sessionStorage.getItem(RETURN_KEY);
      sessionStorage.removeItem(RETURN_KEY);
    } catch (e) {}
    if (!url) return fallback || 'account.html';
    try {
      const target = new URL(url, location.origin);
      if (target.origin !== location.origin) return fallback || 'account.html';
      if (/\/account\.html/.test(target.pathname)) return fallback || 'account.html';
      return target.pathname + target.search;
    } catch (e) {
      return fallback || 'account.html';
    }
  }

  /** Send an unauthenticated shopper to sign in, remembering this page. */
  function requireSignIn() {
    rememberReturn(location.href);
    location.href = 'account.html';
  }

  function subscribe(fn) {
    listeners.push(fn);
    fn(state());
    return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); };
  }

  const getToken = () => token;

  return { requestCode, verifyCode, signOut, load, state, subscribe,
           rememberReturn, takeReturn, requireSignIn, getToken };
})();
