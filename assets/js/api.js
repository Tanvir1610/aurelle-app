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

  async function req(path, { method = 'GET', body, timeout = 6000 } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(BASE + path, {
        method,
        headers: body ? { 'content-type': 'application/json' } : {},
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

  return { init, isOnline, createOrder, trackOrder, contact, subscribe, req };
})();
