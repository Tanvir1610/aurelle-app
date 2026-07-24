/**
 * Aurelle — API end-to-end test.
 * Boots the real server in-process and exercises every endpoint.
 * Run: node tools/api-test.mjs
 */
const PORT = process.env.TEST_PORT || 3901;
process.env.PORT = String(PORT);
process.env.ADMIN_EMAIL = 'admin@aurelle.local';
process.env.ADMIN_PASSWORD = 'aurelle-admin';

await import('../server/server.js');
await new Promise(r => setTimeout(r, 600));

const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;

function t(name, cond, extra = '') {
  if (cond) { pass++; console.log(`ok    ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  → ' + extra : ''}`); }
}

async function call(method, path, { body, token } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* non-JSON */ }
  return { status: r.status, data };
}

console.log('\n── public API ──────────────────────────────────');

{
  const r = await call('GET', '/api/health');
  t('health returns up', r.status === 200 && r.data.status === 'up');
}
{
  const r = await call('GET', '/api/catalogue');
  t('catalogue serves products', r.status === 200 && r.data.products.length > 0);
  t('catalogue keeps AU_DATA shape',
     !!(r.data.hero && r.data.categories && r.data.reviews && r.data.megamenu));
}
{
  const r = await call('GET', '/api/products?cat=Earrings');
  t('products filter by category',
     r.data.products.length > 0 && r.data.products.every(p => p.cat === 'Earrings'));
}
{
  const r = await call('GET', '/api/products?max=999');
  t('products filter by price cap', r.data.products.every(p => p.price <= 999));
}
{
  const r = await call('GET', '/api/products/rosevine-necklace-set');
  t('single product by slug', r.status === 200 && r.data.name === 'Rosevine Necklace Set');
  const miss = await call('GET', '/api/products/does-not-exist');
  t('unknown product is 404', miss.status === 404);
}

console.log('\n── orders ──────────────────────────────────────');

const validOrder = {
  firstName: 'Ananya', lastName: 'Kulkarni', email: 'ananya@example.com',
  phone: '9876543210', address: '12 Sunrise Arcade, CG Road', city: 'Ahmedabad',
  pincode: '380009', payment: 'UPI',
  items: [{ slug: 'rosevine-necklace-set', qty: 2, finish: 'Gold' },
          { slug: 'ila-floral-studs', qty: 1, finish: 'Rose Gold' }],
};

let orderRef = null;
{
  const r = await call('POST', '/api/orders', { body: validOrder });
  t('order is created', r.status === 201 && /^AUR\d{6}$/.test(r.data.ref || ''), JSON.stringify(r.data));
  orderRef = r.data.ref;
  // 2×2400 + 1×499 = 5299, over the free-shipping threshold
  t('server prices the order itself', r.data.total === 5299, `got ${r.data.total}`);
}
{
  const r = await call('POST', '/api/orders', { body: { ...validOrder, phone: '12345' } });
  t('rejects a bad phone number', r.status === 400);
}
{
  const r = await call('POST', '/api/orders', { body: { ...validOrder, email: 'nope' } });
  t('rejects a bad email', r.status === 400);
}
{
  const r = await call('POST', '/api/orders', { body: { ...validOrder, pincode: '99' } });
  t('rejects a bad pincode', r.status === 400);
}
{
  const r = await call('POST', '/api/orders', { body: { ...validOrder, items: [] } });
  t('rejects an empty basket', r.status === 400);
}
{
  const r = await call('POST', '/api/orders',
    { body: { ...validOrder, items: [{ slug: 'ghost-item', qty: 1 }] } });
  t('rejects an unknown product', r.status === 400);
}
{
  const r = await call('GET', `/api/orders/${orderRef}`);
  t('order tracking works', r.status === 200 && r.data.ref === orderRef);
  t('tracking returns a timeline', Array.isArray(r.data.timeline) && r.data.timeline.length === 4);
  t('newly placed order shows step one done', r.data.timeline[0].done === true);
}
{
  // Stock must have moved: Rosevine started at seed level, 2 were bought.
  const before = await call('GET', '/api/products/rosevine-necklace-set');
  const r = await call('POST', '/api/orders',
    { body: { ...validOrder, items: [{ slug: 'rosevine-necklace-set', qty: 1 }] } });
  const after = await call('GET', '/api/products/rosevine-necklace-set');
  t('stock decrements on purchase',
     after.data.stock === before.data.stock - 1,
     `${before.data.stock} → ${after.data.stock}`);
}

console.log('\n── newsletter & contact ────────────────────────');
{
  const r = await call('POST', '/api/newsletter', { body: { email: 'reader@example.com' } });
  t('newsletter accepts a valid email', r.status === 200);
  const b = await call('POST', '/api/newsletter', { body: { email: 'bad' } });
  t('newsletter rejects a bad email', b.status === 400);
}
{
  const r = await call('POST', '/api/contact',
    { body: { name: 'Priya', email: 'p@example.com', body: 'Do you ship to Nashik?' } });
  t('contact message is stored', r.status === 201);
  const b = await call('POST', '/api/contact', { body: { name: '', email: 'x', body: '' } });
  t('contact rejects an empty form', b.status === 400);
}

console.log('\n── auth ────────────────────────────────────────');
let token = null;
{
  const bad = await call('POST', '/api/auth/login',
    { body: { email: 'admin@aurelle.local', password: 'wrong' } });
  t('login rejects a wrong password', bad.status === 401);

  const r = await call('POST', '/api/auth/login',
    { body: { email: 'admin@aurelle.local', password: 'aurelle-admin' } });
  t('login succeeds with correct credentials', r.status === 200 && !!r.data.token);
  token = r.data.token;

  const me = await call('GET', '/api/auth/me', { token });
  t('token identifies the user', me.status === 200 && me.data.user.email === 'admin@aurelle.local');

  const forged = await call('GET', '/api/auth/me', { token: token.split('.')[0] + '.tampered' });
  t('forged token is rejected', forged.status === 401);
}

console.log('\n── admin API ───────────────────────────────────');
{
  const r = await call('GET', '/api/admin/stats');
  t('admin route requires auth', r.status === 401);
}
{
  const r = await call('GET', '/api/admin/stats', { token });
  t('stats returns revenue and counts',
     r.status === 200 && r.data.orders >= 2 && r.data.revenue > 0);
  t('stats includes top products', Array.isArray(r.data.topProducts) && r.data.topProducts.length > 0);
  t('stats includes a daily series', Array.isArray(r.data.daily));
}
{
  const r = await call('GET', '/api/admin/orders', { token });
  t('admin lists orders', r.status === 200 && r.data.orders.length >= 2);
  t('orders include line items', r.data.orders[0].items.length > 0);

  const filtered = await call('GET', '/api/admin/orders?status=placed', { token });
  t('orders filter by status', filtered.data.orders.every(o => o.status === 'placed'));

  const searched = await call('GET', `/api/admin/orders?q=${orderRef}`, { token });
  t('orders search by reference', searched.data.orders.length === 1);
}
{
  const r = await call('PATCH', `/api/admin/orders/${orderRef}`, { token, body: { status: 'shipped' } });
  t('order status can be updated', r.status === 200 && r.data.status === 'shipped');

  const track = await call('GET', `/api/orders/${orderRef}`);
  t('status change shows in tracking',
     track.data.timeline.filter(s => s.done).length === 3);

  const bad = await call('PATCH', `/api/admin/orders/${orderRef}`, { token, body: { status: 'teleported' } });
  t('invalid status is rejected', bad.status === 400);
}
{
  const created = await call('POST', '/api/admin/products', {
    token,
    body: { slug: 'test-piece', name: 'Test Piece', cat: 'Rings', price: 1200,
            mrp: 2400, metal: 'Gold', stock: 5, blurb: 'A test.' },
  });
  t('admin creates a product', created.status === 200 && created.data.slug === 'test-piece');

  const live = await call('GET', '/api/products/test-piece');
  t('new product is live on the storefront', live.status === 200 && live.data.price === 1200);

  const updated = await call('POST', '/api/admin/products', {
    token, body: { slug: 'test-piece', name: 'Test Piece', cat: 'Rings',
                   price: 1400, mrp: 2400, metal: 'Gold', stock: 9 },
  });
  t('admin updates an existing product', updated.data.price === 1400);

  const badPrice = await call('POST', '/api/admin/products', {
    token, body: { slug: 'x', name: 'X', cat: 'Rings', price: 5000, mrp: 100, metal: 'Gold' },
  });
  t('rejects MRP below selling price', badPrice.status === 400);

  const del = await call('DELETE', '/api/admin/products/test-piece', { token });
  t('admin archives a product', del.status === 200);

  const gone = await call('GET', '/api/products/test-piece');
  t('archived product leaves the storefront', gone.status === 404);
}
{
  const r = await call('GET', '/api/admin/messages', { token });
  t('admin reads messages', r.status === 200 && r.data.messages.length > 0);

  const id = r.data.messages[0].id;
  const h = await call('PATCH', `/api/admin/messages/${id}`, { token, body: { handled: true } });
  t('message can be marked handled', h.data.handled === 1);
}
{
  const r = await call('GET', '/api/admin/subscribers', { token });
  t('admin reads subscribers', r.status === 200 && r.data.subscribers.length > 0);
}

console.log('\n── static hosting & safety ─────────────────────');
{
  const r = await fetch(BASE + '/');
  t('storefront is served', r.status === 200 && (await r.text()).includes('Aurelle'));
}
{
  const r = await fetch(BASE + '/assets/js/data.js');
  t('static assets are served', r.status === 200);
}
{
  const r = await fetch(BASE + '/api/nonsense');
  t('unknown API path is 404', r.status === 404);
}
{
  const r = await fetch(BASE + '/../../../etc/passwd');
  t('path traversal is blocked', r.status === 403 || r.status === 404, `got ${r.status}`);
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
