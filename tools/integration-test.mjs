/**
 * Aurelle — full-stack integration test.
 *
 * Boots the real server, drives the real storefront pages in a browser
 * environment, and checks the resulting data through the admin API.
 * Nothing is stubbed: the order below travels UI → HTTP → SQLite → dashboard.
 *
 * Run: node tools/integration-test.mjs
 */
import { JSDOM, VirtualConsole } from 'jsdom';

const PORT = process.env.TEST_PORT || 3902;
process.env.PORT = String(PORT);
process.env.ADMIN_EMAIL = 'admin@aurelle.local';
process.env.ADMIN_PASSWORD = 'aurelle-admin';

await import('../server/server.js');
await new Promise(r => setTimeout(r, 600));

const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`ok    ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  → ' + extra : ''}`); }
};

const noise = m => /Could not load|stylesheet|css/i.test(String(m));

/** Load a page from the running server, with scripts executing. */
async function page(path, seedStorage) {
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', e => { if (!noise(e.message)) errors.push(e.message); });

  const dom = await JSDOM.fromURL(BASE + path, {
    runScripts: 'dangerously',
    resources: 'usable',
    virtualConsole: vc,
    pretendToBeVisual: true,
    // jsdom ships no fetch, so page scripts would fall back to offline
    // mode. Hand them Node's fetch, resolving relative URLs against the
    // document like a browser does.
    beforeParse(win) {
      // Each jsdom instance gets its own localStorage; a real browser
      // shares it across navigations. Seed it so the bag survives.
      if (seedStorage) {
        try { win.localStorage.setItem('aurelle.cart.v1', seedStorage); } catch (e) {}
      }
      win.fetch = (input, init) => {
        const url = typeof input === 'string' ? new URL(input, BASE + path).href : input;
        return fetch(url, init);
      };
      win.AbortController = AbortController;
      win.Headers = Headers;
      win.Request = Request;
      win.Response = Response;
    },
  });
  // Let the API bridge resolve and controllers paint.
  await new Promise(r => setTimeout(r, 1200));
  return { dom, doc: dom.window.document, win: dom.window, errors };
}

console.log('\n── storefront reads from the API ───────────────');

let liveSlug = null;
{
  // Add a product through the admin API, then confirm it reaches the shop.
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@aurelle.local', password: 'aurelle-admin' }),
  })).json();
  const token = login.token;

  liveSlug = 'integration-test-piece';
  await fetch(BASE + '/api/admin/products', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      slug: liveSlug, name: 'Integration Test Piece', cat: 'Rings',
      price: 1111, mrp: 2222, metal: 'Gold', stock: 50,
      blurb: 'Created by the integration test.',
    }),
  });

  const { doc, win } = await page('/collection.html');
  const names = Array.from(doc.querySelectorAll('.card__name')).map(n => n.textContent);
  const total = doc.querySelector('#plpCount').textContent;

  t('storefront detects the backend', win.AU_API.isOnline() === true);
  t('admin-created product reaches the shop',
     total.startsWith('29'), `count was "${total}"`);

  const { doc: pdp } = await page(`/product.html?p=${liveSlug}`);
  t('product page renders live data', pdp.querySelector('#pdpInfo h1').textContent === 'Integration Test Piece');
  t('live price comes from the database', pdp.querySelector('.price__now').textContent.includes('1,111'));
}

console.log('\n── a customer places an order ──────────────────');

let placedRef = null;
{
  const { doc, win } = await page(`/product.html?p=${liveSlug}`);

  // Add two of this piece to the bag, exactly as a shopper would.
  doc.querySelector('#qtyUp').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  doc.querySelector('#pdpAdd').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  t('add to bag registers', win.AU_CART.totals().count === 2, String(win.AU_CART.totals().count));

  const stored = win.localStorage.getItem('aurelle.cart.v1');
  t('bag persists for the next page', !!stored && stored.includes(liveSlug));

  // Carry that bag into checkout, the way the browser would.
  const co2 = await page('/checkout.html', stored);

  t('checkout shows the bag', co2.doc.querySelector('#coSummary .line') !== null);

  const set = (id, v) => { co2.doc.querySelector(id).value = v; };
  set('#fn', 'Meera');   set('#ln', 'Raghavan');
  set('#em', 'meera@example.com'); set('#ph', '9812345678');
  set('#ad', '44 Linking Road, Bandra West');
  set('#ct', 'Mumbai');  set('#pc', '400050');

  co2.doc.querySelector('#coForm').dispatchEvent(
    new co2.win.Event('submit', { bubbles: true, cancelable: true }));

  // Wait for the POST and the redirect that follows it.
  await new Promise(r => setTimeout(r, 1400));

  const ref = co2.win.sessionStorage.getItem('aurelle.lastOrder');
  placedRef = ref;
  t('checkout produced an order reference', /^AUR\d{6}$/.test(ref || ''), String(ref));
}

console.log('\n── the order reaches the database ──────────────');
{
  const track = await (await fetch(`${BASE}/api/orders/${placedRef}`)).json();
  t('order is retrievable by reference', track.ref === placedRef);
  t('order captured the right quantity', track.items[0].qty === 2, JSON.stringify(track.items));
  t('server priced it, not the browser', track.total === 2222, `got ${track.total}`);
  t('order starts at placed', track.status === 'placed');
}

console.log('\n── the dashboard sees it ───────────────────────');
{
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@aurelle.local', password: 'aurelle-admin' }),
  })).json();
  const token = login.token;
  const auth = { authorization: `Bearer ${token}` };

  const orders = await (await fetch(BASE + '/api/admin/orders', { headers: auth })).json();
  const mine = orders.orders.find(o => o.ref === placedRef);
  t('order appears in the dashboard list', !!mine);
  t('dashboard shows the customer', mine && mine.first_name === 'Meera' && mine.city === 'Mumbai');

  const stats = await (await fetch(BASE + '/api/admin/stats', { headers: auth })).json();
  t('revenue reflects the sale', stats.revenue >= 2222, `revenue ${stats.revenue}`);
  t('order counted as needing action', stats.pending >= 1);

  // Stock must have moved by two.
  const prod = await (await fetch(`${BASE}/api/products/${liveSlug}`)).json();
  t('stock decremented by the order', prod.stock === 48, `stock ${prod.stock}`);

  // Fulfil it from the dashboard, then confirm the customer sees the change.
  await fetch(`${BASE}/api/admin/orders/${placedRef}`, {
    method: 'PATCH', headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'shipped' }),
  });

  const { doc, win } = await page('/track-order.html');
  doc.querySelector('#trackRef').value = placedRef;
  doc.querySelector('#trackForm').dispatchEvent(
    new win.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 900));

  const text = doc.querySelector('#trackResult').textContent;
  t('customer tracking reflects the dashboard change',
     /In transit/i.test(text), text.replace(/\s+/g, ' ').slice(0, 90));
}

console.log('\n── contact form reaches the inbox ──────────────');
{
  const { doc, win } = await page('/contact.html');
  doc.querySelector('#cn').value = 'Rhea Nair';
  doc.querySelector('#ce').value = 'rhea@example.com';
  doc.querySelector('#cm').value = 'Do you size rings in store?';
  doc.querySelector('#contactForm').dispatchEvent(
    new win.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 900));

  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@aurelle.local', password: 'aurelle-admin' }),
  })).json();
  const msgs = await (await fetch(BASE + '/api/admin/messages', {
    headers: { authorization: `Bearer ${login.token}` } })).json();

  t('message from the storefront lands in the dashboard',
     msgs.messages.some(m => m.email === 'rhea@example.com'));
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
