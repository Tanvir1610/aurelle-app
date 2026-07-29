/* ============================================================
   AURELLE — API BRIDGE
   ------------------------------------------------------------
   If a backend is reachable, the storefront uses it: live
   catalogue, real orders, real tracking.

   If not — opened as plain files, or the API is down — every
   call falls back to the bundled data and the local behaviour
   from phase one. The site never breaks because the server is
   asleep.
   ============================================================ */
window.AU_API = (function () {

  // Same-origin by default. Point this at a deployed API to run
  // the frontend on a CDN and the backend elsewhere.
  const BASE = window.AU_API_BASE || '';

  let online = false;
  const isOnline = () => online;

  let payCfg = { enabled: false, mode: 'sandbox', appId: null };

  async function req(path, { method = 'GET', body, timeout = 6000, auth = true } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);

    const headers = body ? { 'content-type': 'application/json' } : {};

    // Attach the Clerk session token when the shopper is signed in, so
    // orders are linked to their account instead of being anonymous.
    if (auth && window.AU_AUTH) {
      try {
        const t = await window.AU_AUTH.token();
        if (t) headers.authorization = `Bearer ${t}`;
      } catch (e) { /* guest */ }
    }

    try {
      const res = await fetch(BASE + path, {
        method, headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      let data = null;
      try { data = await res.json(); } catch (e) { /* empty */ }
      if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Called once before the page renders. Merges live catalogue data
   * into the bundled AU_DATA.
   *
   * This mutates the existing object rather than replacing it: page
   * controllers capture `AU_DATA` by reference when their script runs,
   * so swapping in a new object would leave them reading stale data.
   */
  async function init() {
    try {
      const data = await req('/api/catalogue', { timeout: 2500 });
      if (data && Array.isArray(data.products) && data.products.length) {
        if (window.AU_DATA) Object.assign(window.AU_DATA, data);
        else window.AU_DATA = data;
        online = true;
      }
    } catch (e) {
      online = false; // static mode — entirely expected offline
    }

    /* Payment availability lives on /api/config, separate from the
       catalogue. Fetch it in the background — nothing on the page should
       wait for it, and only checkout needs the answer. */
    if (online) {
      req('/api/config', { timeout: 4000, auth: false })
        .then(cfg => { if (cfg && cfg.payments) payCfg = cfg.payments; })
        .catch(() => { /* payments stay off */ });
    }
    return online;
  }

  /* ------------------------------------------------------ orders -- */
  async function createOrder(details, lines) {
    const items = lines.map(l => ({ slug: l.slug, qty: l.qty, finish: l.finish }));
    if (!online) {
      // Local fallback so checkout still completes without a server.
      return { ref: 'AUR' + Math.floor(100000 + Math.random() * 899999), offline: true };
    }
    return req('/api/orders', { method: 'POST', body: { ...details, items } });
  }

  async function trackOrder(ref) {
    if (!online) return null;
    return req(`/api/orders/${encodeURIComponent(ref)}`);
  }

  /* ------------------------------------------- contact & mailing -- */
  async function contact(payload) {
    if (!online) return { received: true, offline: true };
    return req('/api/contact', { method: 'POST', body: payload });
  }

  async function subscribe(email) {
    if (!online) return { subscribed: true, offline: true };
    return req('/api/newsletter', { method: 'POST', body: { email } });
  }

  /* ---------------------------------------------- customer area -- */
  async function myOrders() {
    if (!online) return { orders: [] };
    return req('/api/me/orders');
  }

  /* ------------------------------------------------------ payments -- */
  const paymentsEnabled = () => !!payCfg.enabled;

  /** Checkout can be reached before the background fetch lands. */
  async function ensurePayCfg() {
    if (payCfg.enabled) return payCfg;
    try {
      const cfg = await req('/api/config', { timeout: 5000, auth: false });
      if (cfg && cfg.payments) payCfg = cfg.payments;
    } catch (e) { /* stays off */ }
    return payCfg;
  }

  /** Load Cashfree's checkout SDK once, on demand. */
  function loadCashfreeSdk() {
    return new Promise((resolve, reject) => {
      if (window.Cashfree) return resolve(window.Cashfree);
      const s = document.createElement('script');
      s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      s.onload = () => resolve(window.Cashfree);
      s.onerror = () => reject(new Error('Payment SDK could not load'));
      document.head.appendChild(s);
      setTimeout(() => { if (!window.Cashfree) reject(new Error('Payment SDK timed out')); }, 12000);
    });
  }

  /**
   * Open Cashfree checkout for an order we already created.
   * Returns false when the hand-off fails, so the caller can restore the
   * form rather than stranding the shopper on a dead page.
   */
  async function startPayment(ref) {
    try {
      await ensurePayCfg();
      if (!payCfg.enabled) {
        return { ok: false, reason: 'Online payment is not switched on for this shop.' };
      }
      const session = await req('/api/payments/session', { method: 'POST', body: { ref } });
      if (!session.paymentSessionId) {
        return { ok: false, reason: 'The payment provider did not return a session.' };
      }
      const Cashfree = await loadCashfreeSdk();
      const cf = Cashfree({ mode: session.mode === 'production' ? 'production' : 'sandbox' });
      const result = await cf.checkout({
        paymentSessionId: session.paymentSessionId,
        redirectTarget: '_self',
      });
      // The SDK reports its own failures rather than throwing.
      if (result && result.error) {
        return { ok: false, reason: result.error.message || 'Payment could not be started.' };
      }
      return { ok: true };
    } catch (e) {
      console.error('[pay]', e.message);
      return { ok: false, reason: e.message };
    }
  }

  /** Ask our server whether the gateway actually took the money. */
  async function verifyPayment(ref) {
    return req(`/api/payments/verify/${encodeURIComponent(ref)}`);
  }

  return { init, isOnline, createOrder, trackOrder, contact, subscribe, myOrders,
           paymentsEnabled, ensurePayCfg, startPayment, verifyPayment, req,
           _setPayCfg: c => { payCfg = c || payCfg; } };
})();
