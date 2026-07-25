/**
 * Aurelle — API server + static host.
 * Pure node:http. Zero npm dependencies. Node 22+.
 *
 *   node server/server.js
 *   PORT=4000 ADMIN_PASSWORD=secret node server/server.js
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import * as DB from './data.js';
import * as Clerk from './auth-clerk.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const AUTH_DRIVER = (process.env.AUTH_DRIVER || (Clerk.isConfigured() ? 'clerk' : 'local')).toLowerCase();

/* ============================================================ tokens == */
/* Signed, expiring tokens. Stateless, so restarts do not log you out
   mid-session unless SESSION_SECRET is left to rotate. */
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expect = createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac || ''), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

/* =========================================================== helpers == */
const json = (res, code, data) => {
  const buf = Buffer.from(JSON.stringify(data));
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': buf.length,
    'cache-control': 'no-store',
  });
  res.end(buf);
};
const ok = (res, data) => json(res, 200, data);
const bad = (res, msg, code = 400) => json(res, code, { error: msg });

async function readBody(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error('Payload too large');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new Error('Invalid JSON body'); }
}

/**
 * Who is calling?
 *   { user }            a signed-in shopper
 *   { user, admin }     a shopper who is also on the admin allow-list
 *   null                nobody
 *
 * Under AUTH_DRIVER=clerk the token is a Clerk session JWT. Under
 * 'local' it is the HMAC token issued by /api/auth/login.
 */
async function resolveAuth(req) {
  if (AUTH_DRIVER === 'clerk') {
    const who = await Clerk.identify(req);
    if (!who || who.error) return null;

    let admin = null;
    if (DB.isAdmin) {
      try {
        admin = await DB.isAdmin({ clerkUserId: who.userId, email: who.email });
      } catch (e) {
        console.error('[auth] admin lookup failed:', e.message);
      }
    }
    return { user: who, admin };
  }

  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const payload = token ? verify(token) : null;
  return payload ? { user: payload, admin: payload } : null;
}

/* Validation shared with the frontend rules. */
const isEmail = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || '').trim());
const isPhone = v => /^[6-9]\d{9}$/.test(String(v || '').replace(/\D/g, ''));
const isPin   = v => /^\d{6}$/.test(String(v || '').trim());

/* ============================================================ routes == */
const routes = [];
const route = (method, pattern, handler, opts = {}) =>
  routes.push({ method, pattern, handler,
                auth: !!opts.auth, customer: !!opts.customer });

/* ---------------------------------------------------------- public --- */
route('GET', /^\/api\/health$/, async (req, res) =>
  ok(res, { status: 'up', time: new Date().toISOString() }));

/* Drop-in replacement for the bundled AU_DATA object. */
route('GET', /^\/api\/catalogue$/, async (req, res) => ok(res, await DB.catalogue()));

route('GET', /^\/api\/products$/, async (req, res, m, url) => {
  let list = await DB.listProducts();
  const cat = url.searchParams.get('cat');
  const metal = url.searchParams.get('metal');
  const max = url.searchParams.get('max');
  const q = url.searchParams.get('q');
  if (cat)   list = list.filter(p => p.cat === cat);
  if (metal) list = list.filter(p => p.metal === metal);
  if (max)   list = list.filter(p => p.price <= Number(max));
  if (q)     list = list.filter(p => (p.name + p.cat + p.blurb).toLowerCase().includes(q.toLowerCase()));
  ok(res, { count: list.length, products: list });
});

route('GET', /^\/api\/products\/([\w-]+)$/, async (req, res, m) => {
  const p = await DB.getProduct(m[1]);
  return p ? ok(res, p) : bad(res, 'Product not found', 404);
});

route('POST', /^\/api\/orders$/, async (req, res) => {
  const b = await readBody(req);

  // Attach the shopper's identity when signed in, so the order shows up
  // in their history. Guest checkout stays available.
  const who = await resolveAuth(req);
  if (who && who.user && who.user.userId) {
    b.clerkUserId = who.user.userId;
    if (DB.upsertCustomer) {
      try {
        await DB.upsertCustomer({
          clerkUserId: who.user.userId, email: who.user.email,
          firstName: b.firstName, lastName: b.lastName, phone: b.phone,
        });
      } catch (e) { console.error('[orders] customer sync:', e.message); }
    }
  }
  const missing = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'pincode']
    .filter(f => !String(b[f] || '').trim());
  if (missing.length) return bad(res, `Missing: ${missing.join(', ')}`);
  if (!isEmail(b.email)) return bad(res, 'Invalid email address');
  if (!isPhone(b.phone)) return bad(res, 'Invalid phone number');
  if (!isPin(b.pincode)) return bad(res, 'Invalid pincode');
  try {
    const order = await DB.createOrder(b);
    json(res, 201, { ref: order.ref, total: order.total, status: order.status });
  } catch (e) { bad(res, e.message); }
});

route('GET', /^\/api\/orders\/(AUR\d{6})$/i, async (req, res, m) => {
  const o = await DB.getOrder(m[1].toUpperCase());
  if (!o) return bad(res, 'Order not found', 404);
  const steps = ['placed', 'packed', 'shipped', 'delivered'];
  ok(res, {
    ref: o.ref, status: o.status, total: o.total, placedAt: o.created_at,
    city: o.city,
    items: o.items.map(i => ({ name: i.name, qty: i.qty, finish: i.finish })),
    timeline: steps.map((s, i) => ({
      step: s,
      done: o.status === 'cancelled' ? false : i <= steps.indexOf(o.status),
    })),
  });
});

route('POST', /^\/api\/newsletter$/, async (req, res) => {
  const { email } = await readBody(req);
  if (!isEmail(email)) return bad(res, 'Invalid email address');
  await DB.addSubscriber(email);
  ok(res, { subscribed: true });
});

route('POST', /^\/api\/contact$/, async (req, res) => {
  const b = await readBody(req);
  if (!String(b.name || '').trim()) return bad(res, 'Name is required');
  if (!isEmail(b.email)) return bad(res, 'Invalid email address');
  if (!String(b.body || '').trim()) return bad(res, 'Message is required');
  await DB.createMessage(b);
  json(res, 201, { received: true });
});

/* ------------------------------------------------------------ auth --- */
route('POST', /^\/api\/auth\/login$/, async (req, res) => {
  const { email, password } = await readBody(req);
  const admin = DB.db.prepare('SELECT * FROM admins WHERE email = ?')
    .get(String(email || '').toLowerCase().trim());
  if (!admin || !DB.verifyPassword(String(password || ''), admin.pass_salt, admin.pass_hash)) {
    return bad(res, 'Email or password is incorrect', 401);
  }
  const token = sign({ sub: admin.id, email: admin.email, name: admin.name,
                       exp: Date.now() + 12 * 3600 * 1000 });
  ok(res, { token, user: { email: admin.email, name: admin.name } });
});

route('GET', /^\/api\/auth\/me$/, async (req, res, m, url, user) =>
  ok(res, { user: { email: user.email,
                    name: user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
                    role: user.admin?.role || 'owner' } }), { auth: true });

/* -------------------------------------------------- customer area --- */
/* What the browser needs to boot Clerk. Publishable key only. */
route('GET', /^\/api\/config$/, async (req, res) => {
  /* adminCount lets the dashboard say "no administrators are configured"
     instead of a bare 403. It is a count only — never the addresses. */
  let adminCount = null;
  try { adminCount = (await DB.listAdmins()).length; } catch (e) { /* driver may be down */ }

  ok(res, {
    auth: AUTH_DRIVER,
    clerk: Clerk.publicConfig(),
    db: DB.DB_DRIVER,
    adminCount,
    freeShippingAt: 999,
  });
});

/* Called once after Clerk sign-in so the shop keeps its own customer row. */
route('POST', /^\/api\/me\/sync$/, async (req, res, m, url, user) => {
  if (!DB.upsertCustomer) return bad(res, 'Customer accounts are unavailable', 501);
  const customer = await DB.upsertCustomer({
    clerkUserId: user.userId, email: user.email,
    firstName: user.firstName, lastName: user.lastName, phone: user.phone,
  });
  ok(res, { customer: { email: customer.email, firstName: customer.first_name,
                        lastName: customer.last_name, phone: customer.phone } });
}, { customer: true });

route('GET', /^\/api\/me$/, async (req, res, m, url, user) => ok(res, {
  user: { id: user.userId, email: user.email,
          firstName: user.firstName, lastName: user.lastName, phone: user.phone },
}), { customer: true });

/* A shopper sees only their own orders. */
route('GET', /^\/api\/me\/orders$/, async (req, res, m, url, user) => {
  if (!DB.getCustomerOrders) return bad(res, 'Order history is unavailable', 501);
  const orders = await DB.getCustomerOrders(user.userId);
  ok(res, { orders: orders.map(o => ({
    ref: o.ref, status: o.status, total: o.total,
    placedAt: o.created_at, city: o.city,
    items: (o.items || []).map(i => ({ name: i.name, qty: i.qty, finish: i.finish,
                                       slug: i.slug, lineTotal: i.line_total })),
  })) });
}, { customer: true });

route('GET', /^\/api\/admin\/admins$/, async (req, res) =>
  ok(res, { admins: await DB.listAdmins() }), { auth: true });

route('POST', /^\/api\/admin\/admins$/, async (req, res) => {
  const { email, name, role } = await readBody(req);
  if (!isEmail(email)) return bad(res, 'Invalid email address');
  if (!DB.addAdmin) return bad(res, 'Admin management needs DB_DRIVER=supabase', 501);
  ok(res, await DB.addAdmin({ email, name, role }));
}, { auth: true });

/* ----------------------------------------------------------- admin --- */
route('GET', /^\/api\/admin\/stats$/, async (req, res) => ok(res, await DB.stats()), { auth: true });

route('GET', /^\/api\/admin\/products$/, async (req, res) =>
  ok(res, { products: await DB.listProducts(true) }), { auth: true });

route('POST', /^\/api\/admin\/products$/, async (req, res) => {
  const b = await readBody(req);
  for (const f of ['slug', 'name', 'cat', 'price', 'mrp', 'metal']) {
    if (!String(b[f] ?? '').trim()) return bad(res, `Missing field: ${f}`);
  }
  if (Number(b.price) <= 0) return bad(res, 'Price must be above zero');
  if (Number(b.mrp) < Number(b.price)) return bad(res, 'MRP cannot be below the selling price');
  ok(res, await DB.upsertProduct({ ...b, price: Number(b.price), mrp: Number(b.mrp), stock: Number(b.stock ?? 25) }));
}, { auth: true });

route('DELETE', /^\/api\/admin\/products\/([\w-]+)$/, async (req, res, m) =>
  await DB.deleteProduct(m[1]) ? ok(res, { archived: true }) : bad(res, 'Not found', 404), { auth: true });

route('GET', /^\/api\/admin\/orders$/, async (req, res, m, url) =>
  ok(res, { orders: await DB.listOrders({ status: url.searchParams.get('status'),
                                    q: url.searchParams.get('q') }) }), { auth: true });

route('PATCH', /^\/api\/admin\/orders\/(AUR\d{6})$/i, async (req, res, m) => {
  const { status } = await readBody(req);
  try {
    const o = await DB.setOrderStatus(m[1].toUpperCase(), status);
    return o ? ok(res, { ref: o.ref, status: o.status }) : bad(res, 'Order not found', 404);
  } catch (e) { return bad(res, e.message); }
}, { auth: true });

/* Artwork the admin can assign to a product. */
route('GET', /^\/api\/admin\/images$/, async (req, res) => {
  const { readdir } = await import('node:fs/promises');
  const dir = resolve(ROOT, 'assets/img');
  let files = [];
  try { files = await readdir(dir); } catch (e) { /* no art folder */ }

  const products = files.filter(f => /^p-.*\.svg$/.test(f) && !f.includes('-alt'))
    .sort()
    .map(f => ({ file: `assets/img/${f}`,
                 alt: `assets/img/${f.replace('.svg', '-alt.svg')}`,
                 label: f.replace(/^p-|\.svg$/g, '').replace(/-/g, ' ') }));

  const categories = files.filter(f => /^cat-.*\.svg$/.test(f))
    .sort()
    .map(f => ({ file: `assets/img/${f}`, alt: `assets/img/${f}`,
                 label: f.replace(/^cat-|\.svg$/g, '').replace(/-/g, ' ') }));

  ok(res, { images: [...products, ...categories] });
}, { auth: true });

route('GET', /^\/api\/admin\/customers$/, async (req, res) => {
  const [signedIn, guests] = await Promise.all([
    DB.listCustomers(), DB.listGuestBuyers(),
  ]);
  ok(res, { customers: signedIn, guests });
}, { auth: true });

/* Full detail for one order, for the drawer in the dashboard. */
route('GET', /^\/api\/admin\/orders\/(AUR\d{6})$/i, async (req, res, m) => {
  const o = await DB.getOrder(m[1].toUpperCase());
  return o ? ok(res, o) : bad(res, 'Order not found', 404);
}, { auth: true });

route('DELETE', /^\/api\/admin\/admins\/(.+)$/, async (req, res, m, url, user) => {
  const email = decodeURIComponent(m[1]).toLowerCase().trim();
  if (user.email && user.email.toLowerCase() === email) {
    return bad(res, 'You cannot remove your own access');
  }
  try {
    return await DB.removeAdmin(email)
      ? ok(res, { removed: true })
      : bad(res, 'Not found', 404);
  } catch (e) { return bad(res, e.message); }
}, { auth: true });

route('GET', /^\/api\/admin\/messages$/, async (req, res) =>
  ok(res, { messages: await DB.listMessages() }), { auth: true });

route('PATCH', /^\/api\/admin\/messages\/([\w-]+)$/, async (req, res, m) => {
  const { handled } = await readBody(req);
  ok(res, await DB.setMessageHandled(m[1], handled));
}, { auth: true });

route('GET', /^\/api\/admin\/subscribers$/, async (req, res) =>
  ok(res, { subscribers: await DB.listSubscribers() }), { auth: true });

/* ====================================================== static host == */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4',
  '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

async function serveStatic(req, res, pathname, search = '') {
  let rel = decodeURIComponent(pathname);

  const contained = p => p === ROOT || p.startsWith(ROOT + sep);

  /* A directory requested without a trailing slash, e.g. /admin.
     Redirect to /admin/ rather than serving the index directly: the page
     references admin.css and admin.js relatively, and without the slash the
     browser resolves those against the parent and they 404.

     Clerk sends people back here after sign-in without the slash, which is
     how this surfaced. The query string carries Clerk's handshake token, so
     it must survive the redirect. */
  if (!rel.endsWith('/') && !extname(rel)) {
    const asDir = resolve(ROOT, '.' + normalize(rel));
    if (contained(asDir)) {
      try {
        const st = await stat(asDir);
        if (st.isDirectory()) {
          res.writeHead(301, { location: `${pathname}/${search}` });
          return res.end();
        }
      } catch { /* not a directory — fall through to the .html lookup */ }
    }
  }

  if (rel.endsWith('/')) rel += 'index.html';
  if (!extname(rel)) rel += '.html';

  // Contain everything under ROOT — no path traversal.
  const target = resolve(ROOT, '.' + normalize(rel));
  if (!contained(target)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const s = await stat(target);
    if (!s.isFile()) throw new Error('not a file');
    const buf = await readFile(target);
    const type = MIME[extname(target).toLowerCase()] || 'application/octet-stream';
    const cache = /\/assets\/(img|video)\//.test(rel)
      ? 'public, max-age=86400'
      : 'no-cache';
    res.writeHead(200, { 'content-type': type, 'content-length': buf.length, 'cache-control': cache });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8">
<title>Not found — Aurelle</title>
<style>body{font-family:system-ui,sans-serif;max-width:34rem;margin:18vh auto;padding:0 1.5rem;
color:#1a1512;line-height:1.6}h1{font-size:2rem;margin:0 0 .5rem}a{color:#9c7a44}</style>
<h1>Page not found</h1>
<p>Nothing lives at <code>${pathname.replace(/[<>&"]/g, '')}</code>.</p>
<p><a href="/">Storefront</a> &middot; <a href="/admin/">Dashboard</a></p>`);
  }
}

/* ============================================================ server == */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'same-origin');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization',
    });
    return res.end();
  }
  if (pathname.startsWith('/api/')) res.setHeader('access-control-allow-origin', '*');

  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.pattern.exec(pathname);
    if (!m) continue;

    let user = null;
    if (r.auth || r.customer) {
      const who = await resolveAuth(req);
      if (!who) return bad(res, 'Sign in required', 401);
      if (r.auth && !who.admin) {
        return bad(res, 'This account is not an administrator', 403);
      }
      user = r.auth ? { ...who.user, admin: who.admin } : who.user;
    }
    try {
      return await r.handler(req, res, m, url, user);
    } catch (e) {
      console.error(`[api] ${req.method} ${pathname}:`, e.message);
      return bad(res, e.message || 'Server error', 500);
    }
  }

  if (pathname.startsWith('/api/')) return bad(res, 'No such endpoint', 404);
  return serveStatic(req, res, pathname, url.search);
});

/* ============================================================== boot == */
const seeded = await DB.seedIfEmpty();

/* Hosts with an ephemeral filesystem lose the database on every restart.
   SEED_DEMO=1 refills it on boot so the dashboard is never empty. */
let demoSeeded = null;
if (process.env.SEED_DEMO === '1') {
  try {
    const { seedDemo } = await import('../tools/seed-demo.mjs');
    demoSeeded = seedDemo({ silent: true });
  } catch (e) {
    console.error('[seed] demo data failed:', e.message);
  }
}

server.listen(PORT, async () => {
  const line = '─'.repeat(56);
  console.log(`\n${line}`);
  console.log('  AURELLE — server running');
  console.log(line);
  console.log(`  Storefront   http://localhost:${PORT}/`);
  console.log(`  Dashboard    http://localhost:${PORT}/admin/`);
  console.log(`  API health   http://localhost:${PORT}/api/health`);
  console.log(`\n  Data store   ${DB.DB_DRIVER}  ${DB.DB_PATH}`);
  console.log(`  Auth         ${AUTH_DRIVER}${AUTH_DRIVER === 'clerk' ? '  ' + (Clerk.frontendApi() || '') : ''}`);
  if (seeded.products) console.log(`  Seeded       ${seeded.products} products`);
  if (demoSeeded && demoSeeded.orders) console.log(`  Demo data    ${demoSeeded.orders} orders`);
  const a = seeded.admin;
  if (a) {
    console.log('');
    if (a.mode === 'default') {
      console.log(`  Dashboard login`);
      console.log(`    email     ${a.email}`);
      console.log(`    password  ${a.pass}`);
      console.log(`\n  !! These defaults are published. Before deploying anywhere public:`);
      console.log(`     ADMIN_EMAIL=you@company.com ADMIN_PASSWORD=... node server/server.js`);
    } else if (a.mode === 'created') {
      console.log(`  Admin account created for ${a.email}`);
      if (a.removedDefault) console.log(`  Default admin@aurelle.local removed.`);
    } else if (a.mode === 'updated') {
      console.log(`  Admin password updated for ${a.email}`);
      if (a.removedDefault) console.log(`  Default admin@aurelle.local removed.`);
    } else if (a.mode === 'none') {
      console.log(`  !! No administrators configured.`);
      console.log(`     Set ADMIN_EMAIL to the address you sign into Clerk with,`);
      console.log(`     then restart. Nobody can open /admin/ until you do.`);
    } else if (a.mode === 'incomplete') {
      console.log(`  !! ${a.missing} is not set, so the admin account was NOT changed.`);
      console.log(`     Set both ADMIN_EMAIL and ADMIN_PASSWORD together.`);
      if (a.usingDefaults) console.log(`     Currently running with no admin account at all.`);
    } else {
      console.log(`  Admin accounts: ${await DB.listAdmins().map(x => x.email).join(', ')}`);
      console.log(`  Set ADMIN_EMAIL and ADMIN_PASSWORD to change the password.`);
    }
  }
  console.log(`${line}\n`);
});

process.on('SIGINT', () => { console.log('\nShutting down.'); server.close(() => process.exit(0)); });
