/* ============================================================
   AURELLE — CART & WISHLIST STATE
   Client-only for now. When the backend lands, swap the read/
   write functions for API calls — the public surface (add,
   setQty, remove, totals, subscribe) does not change.
   ============================================================ */
window.AU_CART = (function () {

  const KEY_CART = 'aurelle.cart.v1';
  const KEY_WISH = 'aurelle.wishlist.v1';
  const FREE_SHIP_AT = 999;
  const SHIP_FEE = 79;

  /* Storage may be unavailable (private mode, sandboxed frame).
     Fall back to memory so the site never throws. */
  const memory = {};
  const store = {
    get(k, dflt) {
      try {
        const raw = window.localStorage.getItem(k);
        return raw ? JSON.parse(raw) : dflt;
      } catch (e) {
        return k in memory ? memory[k] : dflt;
      }
    },
    set(k, v) {
      memory[k] = v;
      try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* memory only */ }
    },
  };

  let lines = store.get(KEY_CART, []);
  let wishlist = store.get(KEY_WISH, []);
  const listeners = [];

  function emit() {
    store.set(KEY_CART, lines);
    store.set(KEY_WISH, wishlist);
    listeners.forEach(fn => { try { fn(snapshot()); } catch (e) { console.error(e); } });
  }

  function findProduct(slug) {
    return (window.AU_DATA?.products || []).find(p => p.slug === slug) || null;
  }

  function lineId(slug, finish) { return `${slug}::${finish || 'default'}`; }

  /* --------------------------------------------------------- api -- */
  function add(slug, qty, finish) {
    const p = findProduct(slug);
    if (!p) return null;
    const id = lineId(slug, finish);
    const existing = lines.find(l => l.id === id);
    if (existing) existing.qty += (qty || 1);
    else lines.push({ id, slug, finish: finish || (p.swatches[0] && p.swatches[0].label) || 'Gold', qty: qty || 1 });
    emit();
    return p;
  }

  function setQty(id, qty) {
    const l = lines.find(x => x.id === id);
    if (!l) return;
    l.qty = Math.max(0, qty);
    if (l.qty === 0) lines = lines.filter(x => x.id !== id);
    emit();
  }

  function remove(id) { lines = lines.filter(l => l.id !== id); emit(); }
  function clear() { lines = []; emit(); }

  function toggleWish(slug) {
    const i = wishlist.indexOf(slug);
    if (i > -1) wishlist.splice(i, 1); else wishlist.push(slug);
    emit();
    return wishlist.indexOf(slug) > -1;
  }
  function inWish(slug) { return wishlist.indexOf(slug) > -1; }

  /* ----------------------------------------------------- derived -- */
  function detailed() {
    return lines.map(l => {
      const p = findProduct(l.slug);
      if (!p) return null;
      return Object.assign({}, l, {
        product: p,
        lineTotal: p.price * l.qty,
        lineMrp: p.mrp * l.qty,
      });
    }).filter(Boolean);
  }

  function totals() {
    const d = detailed();
    const subtotal = d.reduce((s, l) => s + l.lineTotal, 0);
    const mrpTotal = d.reduce((s, l) => s + l.lineMrp, 0);
    const shipping = subtotal === 0 || subtotal >= FREE_SHIP_AT ? 0 : SHIP_FEE;
    return {
      count: d.reduce((s, l) => s + l.qty, 0),
      subtotal,
      saved: mrpTotal - subtotal,
      shipping,
      total: subtotal + shipping,
      freeShipAt: FREE_SHIP_AT,
      toFreeShip: Math.max(0, FREE_SHIP_AT - subtotal),
    };
  }

  function snapshot() { return { lines: detailed(), totals: totals(), wishlist: wishlist.slice() }; }
  function subscribe(fn) { listeners.push(fn); fn(snapshot()); return () => {
    const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1);
  }; }

  return { add, setQty, remove, clear, toggleWish, inWish, detailed, totals, snapshot, subscribe, FREE_SHIP_AT };
})();
