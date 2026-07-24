/**
 * Aurelle — database layer.
 * Uses node:sqlite (built into Node 22+). No npm dependencies.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Where the SQLite file lives. Override with DATA_DIR when the host
   mounts a persistent volume somewhere else (Render, Fly, Railway). */
const DATA_DIR = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : resolve(ROOT, 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = resolve(DATA_DIR, 'aurelle.db');
export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/* ------------------------------------------------------------- schema -- */
db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  cat         TEXT NOT NULL,
  price       INTEGER NOT NULL,
  mrp         INTEGER NOT NULL,
  metal       TEXT NOT NULL,
  badge       TEXT,
  rating      REAL DEFAULT 4.5,
  reviews     INTEGER DEFAULT 0,
  stock       INTEGER DEFAULT 25,
  blurb       TEXT,
  img         TEXT,
  img_alt     TEXT,
  occasion    TEXT,            -- JSON array
  swatches    TEXT,            -- JSON array
  active      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  ref          TEXT UNIQUE NOT NULL,
  clerk_user_id TEXT,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT NOT NULL,
  address      TEXT NOT NULL,
  city         TEXT NOT NULL,
  pincode      TEXT NOT NULL,
  payment      TEXT NOT NULL,
  subtotal     INTEGER NOT NULL,
  shipping     INTEGER NOT NULL,
  total        INTEGER NOT NULL,
  status       TEXT DEFAULT 'placed',
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,
  name       TEXT NOT NULL,
  finish     TEXT,
  qty        INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  line_total INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  order_ref  TEXT,
  subject    TEXT,
  body       TEXT NOT NULL,
  handled    INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscribers (
  email      TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY,
  clerk_user_id TEXT UNIQUE NOT NULL,
  email         TEXT NOT NULL,
  first_name    TEXT,
  last_name     TEXT,
  phone         TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  last_seen_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admins (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  pass_hash  TEXT NOT NULL,
  pass_salt  TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_clerk   ON orders(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_items_order    ON order_items(order_id);
`);

/* Older databases predate clerk_user_id — add it in place. */
try {
  const cols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
  if (!cols.includes('clerk_user_id')) {
    db.exec('ALTER TABLE orders ADD COLUMN clerk_user_id TEXT');
  }
} catch (e) { /* fresh database, nothing to migrate */ }

/* -------------------------------------------------------- passwords -- */
export function hashPassword(plain, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(plain, salt, 64).toString('hex') };
}
export function verifyPassword(plain, salt, expected) {
  const got = scryptSync(plain, salt, 64);
  const want = Buffer.from(expected, 'hex');
  return got.length === want.length && timingSafeEqual(got, want);
}

/* ------------------------------------------------------------- seed -- */
/** Reads the frontend catalogue file and evaluates it in a fake window. */
function readFrontendCatalogue() {
  const src = readFileSync(resolve(ROOT, 'assets/js/data.js'), 'utf8');
  const sandbox = { window: {} };
  new Function('window', src)(sandbox.window);
  return sandbox.window.AU_DATA;
}

const DEFAULT_ADMIN_EMAIL = 'admin@aurelle.local';
const DEFAULT_ADMIN_PASS = 'aurelle-admin';

/**
 * Reconciles the admin account with the environment on EVERY boot.
 *
 * Env vars are authoritative: whatever ADMIN_EMAIL / ADMIN_PASSWORD say is
 * what works. Change them, restart, and the new credentials apply — you are
 * never locked out by an account created on an earlier boot.
 *
 * Emails are normalised to lowercase on write and on login, so a capital
 * letter in ADMIN_EMAIL cannot lock you out either.
 */
export function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const pass = process.env.ADMIN_PASSWORD || '';
  const count = db.prepare('SELECT COUNT(*) AS a FROM admins').get().a;

  // Only one half supplied — tell them rather than half-applying it.
  if ((email && !pass) || (!email && pass)) {
    return { mode: 'incomplete',
             missing: email ? 'ADMIN_PASSWORD' : 'ADMIN_EMAIL',
             usingDefaults: count === 0 };
  }

  if (email && pass) {
    const { salt, hash } = hashPassword(pass);
    const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);

    if (existing) {
      db.prepare('UPDATE admins SET pass_hash = ?, pass_salt = ? WHERE id = ?')
        .run(hash, salt, existing.id);
    } else {
      db.prepare('INSERT INTO admins (id,email,name,pass_hash,pass_salt) VALUES (?,?,?,?,?)')
        .run(randomUUID(), email, 'Store manager', hash, salt);
    }

    // A configured account must not sit alongside the seeded default, or the
    // published password would keep working on a public deployment.
    const removed = db.prepare('DELETE FROM admins WHERE email = ? AND email != ?')
      .run(DEFAULT_ADMIN_EMAIL, email).changes;

    return { mode: existing ? 'updated' : 'created', email, removedDefault: removed > 0 };
  }

  if (count === 0) {
    const { salt, hash } = hashPassword(DEFAULT_ADMIN_PASS);
    db.prepare('INSERT INTO admins (id,email,name,pass_hash,pass_salt) VALUES (?,?,?,?,?)')
      .run(randomUUID(), DEFAULT_ADMIN_EMAIL, 'Store manager', hash, salt);
    return { mode: 'default', email: DEFAULT_ADMIN_EMAIL, pass: DEFAULT_ADMIN_PASS };
  }

  return { mode: 'existing' };
}

/** Set an admin password directly — used by tools/set-password.mjs. */
export function setAdminPassword(rawEmail, plain) {
  const email = String(rawEmail || '').toLowerCase().trim();
  const { salt, hash } = hashPassword(plain);
  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);
  if (existing) {
    db.prepare('UPDATE admins SET pass_hash = ?, pass_salt = ? WHERE id = ?')
      .run(hash, salt, existing.id);
    return { updated: true, email };
  }
  db.prepare('INSERT INTO admins (id,email,name,pass_hash,pass_salt) VALUES (?,?,?,?,?)')
    .run(randomUUID(), email, 'Store manager', hash, salt);
  return { created: true, email };
}

export function listAdmins() {
  return db.prepare('SELECT email, name, created_at FROM admins ORDER BY created_at').all();
}

export function seedIfEmpty() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM products').get();
  const seeded = { products: 0, admin: false };

  if (c === 0) {
    const cat = readFrontendCatalogue();
    const ins = db.prepare(`INSERT INTO products
      (id, slug, name, cat, price, mrp, metal, badge, rating, reviews, stock, blurb, img, img_alt, occasion, swatches)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const p of cat.products) {
      ins.run(randomUUID(), p.slug, p.name, p.cat, p.price, p.mrp, p.metal,
              p.badge || null, p.rating, p.reviews, 20 + Math.floor(Math.random() * 60),
              p.blurb, p.img, p.imgAlt,
              JSON.stringify(p.occasion), JSON.stringify(p.swatches));
    }
    seeded.products = cat.products.length;
  }

  seeded.admin = ensureAdmin();
  return seeded;
}

/* ------------------------------------------------------- catalogue -- */
/** Static content (hero, categories, reviews…) still comes from the file;
 *  products come from the database so the dashboard can edit them. */
export function catalogue() {
  const base = readFrontendCatalogue();
  base.products = listProducts();
  return base;
}

function rowToProduct(r) {
  return {
    slug: r.slug, name: r.name, cat: r.cat, price: r.price, mrp: r.mrp,
    metal: r.metal, badge: r.badge, rating: r.rating, reviews: r.reviews,
    stock: r.stock, blurb: r.blurb, img: r.img, imgAlt: r.img_alt,
    occasion: JSON.parse(r.occasion || '[]'),
    swatches: JSON.parse(r.swatches || '[]'),
  };
}

export function listProducts(includeInactive = false) {
  const sql = includeInactive
    ? 'SELECT * FROM products ORDER BY created_at'
    : 'SELECT * FROM products WHERE active = 1 ORDER BY created_at';
  return db.prepare(sql).all().map(rowToProduct);
}

export function getProduct(slug, includeInactive = false) {
  const r = includeInactive
    ? db.prepare('SELECT * FROM products WHERE slug = ?').get(slug)
    : db.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(slug);
  return r ? rowToProduct(r) : null;
}

export function upsertProduct(p) {
  const existing = db.prepare('SELECT id FROM products WHERE slug = ?').get(p.slug);
  const occ = JSON.stringify(p.occasion || ['Everyday']);
  const sw  = JSON.stringify(p.swatches || [{ key: 'gold', color: '#b8935a', label: 'Gold' }]);
  if (existing) {
    db.prepare(`UPDATE products SET name=?, cat=?, price=?, mrp=?, metal=?, badge=?,
                stock=?, blurb=?, occasion=?, swatches=?, active=? WHERE slug=?`)
      .run(p.name, p.cat, p.price, p.mrp, p.metal, p.badge || null,
           p.stock ?? 25, p.blurb || '', occ, sw, p.active === false ? 0 : 1, p.slug);
  } else {
    db.prepare(`INSERT INTO products
      (id,slug,name,cat,price,mrp,metal,badge,rating,reviews,stock,blurb,img,img_alt,occasion,swatches)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(randomUUID(), p.slug, p.name, p.cat, p.price, p.mrp, p.metal,
           p.badge || null, p.rating ?? 4.5, p.reviews ?? 0, p.stock ?? 25,
           p.blurb || '', p.img || 'assets/img/cat-necklace-sets.svg',
           p.imgAlt || 'assets/img/cat-earrings.svg', occ, sw);
  }
  return getProduct(p.slug, true);
}

export function deleteProduct(slug) {
  return db.prepare('UPDATE products SET active = 0 WHERE slug = ?').run(slug).changes > 0;
}

/* ----------------------------------------------------------- orders -- */
export function createOrder(payload) {
  const items = payload.items || [];
  if (!items.length) throw new Error('Order has no items');

  let subtotal = 0;
  const priced = items.map(i => {
    const p = getProduct(i.slug);
    if (!p) throw new Error(`Unknown product: ${i.slug}`);
    if (p.stock < i.qty) throw new Error(`${p.name} is out of stock`);
    const qty = Math.max(1, Number(i.qty) || 1);
    const line = p.price * qty;
    subtotal += line;
    return { product: p, finish: i.finish || 'Gold', qty, line };
  });

  const shipping = subtotal >= 999 ? 0 : 79;
  const total = subtotal + shipping;
  const ref = 'AUR' + String(Math.floor(100000 + Math.random() * 899999));
  const id = randomUUID();

  db.exec('BEGIN');
  try {
    db.prepare(`INSERT INTO orders
      (id,ref,clerk_user_id,first_name,last_name,email,phone,address,city,pincode,payment,subtotal,shipping,total)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, ref, payload.clerkUserId || null,
           payload.firstName, payload.lastName, payload.email, payload.phone,
           payload.address, payload.city, payload.pincode, payload.payment || 'UPI',
           subtotal, shipping, total);

    const insItem = db.prepare(`INSERT INTO order_items
      (id,order_id,slug,name,finish,qty,unit_price,line_total) VALUES (?,?,?,?,?,?,?,?)`);
    const dec = db.prepare('UPDATE products SET stock = stock - ? WHERE slug = ?');
    for (const it of priced) {
      insItem.run(randomUUID(), id, it.product.slug, it.product.name, it.finish,
                  it.qty, it.product.price, it.line);
      dec.run(it.qty, it.product.slug);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return getOrder(ref);
}

export function getOrder(ref) {
  const o = db.prepare('SELECT * FROM orders WHERE ref = ?').get(ref);
  if (!o) return null;
  o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  return o;
}

export function listOrders({ status, q, clerkUserId, limit = 100 } = {}) {
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const args = [];
  if (status && status !== 'all') { sql += ' AND status = ?'; args.push(status); }
  if (clerkUserId) { sql += ' AND clerk_user_id = ?'; args.push(clerkUserId); }
  if (q) { sql += ' AND (ref LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
           const like = `%${q}%`; args.push(like, like, like, like); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  args.push(limit);
  const rows = db.prepare(sql).all(...args);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  return rows.map(r => ({ ...r, items: items.all(r.id) }));
}

export const ORDER_STATUSES = ['placed', 'packed', 'shipped', 'delivered', 'cancelled'];

export function setOrderStatus(ref, status) {
  if (!ORDER_STATUSES.includes(status)) throw new Error('Invalid status');
  const r = db.prepare('UPDATE orders SET status = ? WHERE ref = ?').run(status, ref);
  return r.changes > 0 ? getOrder(ref) : null;
}

/* --------------------------------------------------------- messages -- */
export function createMessage(m) {
  const id = randomUUID();
  db.prepare('INSERT INTO messages (id,name,email,order_ref,subject,body) VALUES (?,?,?,?,?,?)')
    .run(id, m.name, m.email, m.orderRef || null, m.subject || 'General', m.body);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}
export function listMessages() {
  return db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 200').all();
}
export function setMessageHandled(id, handled) {
  db.prepare('UPDATE messages SET handled = ? WHERE id = ?').run(handled ? 1 : 0, id);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}

/* ------------------------------------------------------ subscribers -- */
export function addSubscriber(email) {
  db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').run(email.toLowerCase());
  return true;
}
export function listSubscribers() {
  return db.prepare('SELECT * FROM subscribers ORDER BY created_at DESC').all();
}

/* -------------------------------------------------------- customers -- */
export function upsertCustomer({ clerkUserId, email, firstName, lastName, phone }) {
  const row = db.prepare('SELECT * FROM customers WHERE clerk_user_id = ?').get(clerkUserId);
  if (row) {
    db.prepare(`UPDATE customers SET email = ?, last_seen_at = datetime('now'),
                first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
                phone = COALESCE(?, phone) WHERE clerk_user_id = ?`)
      .run(email, firstName || null, lastName || null, phone || null, clerkUserId);
  } else {
    db.prepare(`INSERT INTO customers (id,clerk_user_id,email,first_name,last_name,phone)
                VALUES (?,?,?,?,?,?)`)
      .run(randomUUID(), clerkUserId, email, firstName || null, lastName || null, phone || null);
  }
  return db.prepare('SELECT * FROM customers WHERE clerk_user_id = ?').get(clerkUserId);
}

export function getCustomerOrders(clerkUserId) {
  return listOrders({ clerkUserId, limit: 50 });
}

/* ------------------------------------------------------------ stats -- */
export function stats() {
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const revenue = one(`SELECT COALESCE(SUM(total),0) AS v FROM orders WHERE status != 'cancelled'`).v;
  const orders  = one('SELECT COUNT(*) AS v FROM orders').v;
  const pending = one(`SELECT COUNT(*) AS v FROM orders WHERE status IN ('placed','packed')`).v;
  const unread  = one('SELECT COUNT(*) AS v FROM messages WHERE handled = 0').v;
  const subs    = one('SELECT COUNT(*) AS v FROM subscribers').v;
  const lowStock = db.prepare('SELECT slug,name,stock FROM products WHERE active=1 AND stock <= 10 ORDER BY stock').all();

  const byStatus = db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all();
  const topProducts = db.prepare(`
    SELECT slug, name, SUM(qty) AS units, SUM(line_total) AS revenue
    FROM order_items GROUP BY slug ORDER BY units DESC LIMIT 5`).all();
  const daily = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
    FROM orders GROUP BY day ORDER BY day DESC LIMIT 14`).all().reverse();

  return {
    revenue, orders, pending, unread, subscribers: subs,
    aov: orders ? Math.round(revenue / orders) : 0,
    products: one('SELECT COUNT(*) AS v FROM products WHERE active = 1').v,
    lowStock, byStatus, topProducts, daily,
  };
}
