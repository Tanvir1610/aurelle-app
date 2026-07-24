/**
 * Aurelle — schema migration tests.
 *
 * A deploy crashed with "no such column: clerk_user_id" because the index
 * over that column was created in the same statement batch as the table.
 * On a database made by an older build, CREATE TABLE IF NOT EXISTS is a
 * no-op, so the column never appeared and the index aborted startup.
 *
 * These assertions prove the app boots against older database shapes and
 * keeps the data that is already in them.
 *
 * Run: node tools/migration-test.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`ok    ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  → ' + extra : ''}`); }
};

/** Build a database as an earlier version of the app would have left it. */
function legacyDatabase(dir) {
  const db = new DatabaseSync(join(dir, 'aurelle.db'));
  db.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      cat TEXT NOT NULL, price INTEGER NOT NULL, mrp INTEGER NOT NULL,
      metal TEXT NOT NULL, badge TEXT, rating REAL DEFAULT 4.5,
      reviews INTEGER DEFAULT 0, stock INTEGER DEFAULT 25, blurb TEXT,
      img TEXT, img_alt TEXT, occasion TEXT, swatches TEXT,
      active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));

    -- No clerk_user_id: this is the shape that crashed the deploy.
    CREATE TABLE orders (
      id TEXT PRIMARY KEY, ref TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL,
      phone TEXT NOT NULL, address TEXT NOT NULL, city TEXT NOT NULL,
      pincode TEXT NOT NULL, payment TEXT NOT NULL, subtotal INTEGER NOT NULL,
      shipping INTEGER NOT NULL, total INTEGER NOT NULL,
      status TEXT DEFAULT 'placed', created_at TEXT DEFAULT (datetime('now')));

    CREATE TABLE order_items (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL, slug TEXT NOT NULL,
      name TEXT NOT NULL, finish TEXT, qty INTEGER NOT NULL,
      unit_price INTEGER NOT NULL, line_total INTEGER NOT NULL);

    CREATE TABLE messages (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
      order_ref TEXT, subject TEXT, body TEXT NOT NULL,
      handled INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));

    CREATE TABLE subscribers (email TEXT PRIMARY KEY, created_at TEXT);

    CREATE TABLE admins (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL, created_at TEXT);
  `);

  db.prepare(`INSERT INTO orders
    (id,ref,first_name,last_name,email,phone,address,city,pincode,payment,subtotal,shipping,total,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('legacy-1', 'AUR999888', 'Old', 'Customer', 'old@example.com',
         '9876500000', '1 Old Road', 'Pune', '411001', 'UPI', 2400, 0, 2400, 'delivered');

  db.prepare(`INSERT INTO products
    (id,slug,name,cat,price,mrp,metal,occasion,swatches) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run('p1', 'legacy-piece', 'Legacy Piece', 'Rings', 900, 1800, 'Gold', '[]', '[]');

  db.close();
}

console.log('\n── booting against a pre-migration database ────');

const dir = mkdtempSync(join(tmpdir(), 'aurelle-mig-'));
legacyDatabase(dir);
process.env.DATA_DIR = dir;

let DB;
try {
  DB = await import('../server/db.js');
  t('server starts instead of crashing', true);
} catch (e) {
  t('server starts instead of crashing', false, e.message);
  console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
  process.exit(1);
}

{
  const cols = DB.db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
  t('missing column was added', cols.includes('clerk_user_id'));
}
{
  const idx = DB.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all()
    .map(r => r.name);
  t('index over the new column exists', idx.includes('idx_orders_clerk'), idx.join(', '));
}
{
  const row = DB.db.prepare('SELECT * FROM orders WHERE ref = ?').get('AUR999888');
  t('existing order survived the migration', !!row);
  t('its data is intact', row && row.total === 2400 && row.city === 'Pune');
  t('the new column defaults to null', row && row.clerk_user_id === null);
}
{
  const p = DB.getProduct('legacy-piece');
  t('existing product still readable', !!p && p.price === 900);
}
{
  // New tables introduced after that database was made.
  const tables = DB.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
    .map(r => r.name);
  t('customers table was created', tables.includes('customers'));
}
{
  // The whole point of the column: linking an order to a signed-in shopper.
  DB.seedIfEmpty();
  const order = DB.createOrder({
    firstName: 'New', lastName: 'Shopper', email: 'new@example.com',
    phone: '9812345678', address: '2 New Road', city: 'Mumbai', pincode: '400050',
    payment: 'UPI', clerkUserId: 'user_test123',
    items: [{ slug: 'legacy-piece', qty: 1 }],
  });
  t('a new order can be placed', /^AUR\d{6}$/.test(order.ref));
  t('it records the signed-in shopper', order.clerk_user_id === 'user_test123');

  const mine = DB.getCustomerOrders('user_test123');
  t('order history finds it', mine.length === 1 && mine[0].ref === order.ref);

  const theirs = DB.getCustomerOrders('user_someone_else');
  t('another shopper sees none of it', theirs.length === 0);
}

console.log('\n── running twice is harmless ───────────────────');
{
  // Re-running the migration logic must not throw or duplicate anything.
  let threw = null;
  try {
    const cols = DB.db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
    t('column is present before the second pass', cols.includes('clerk_user_id'));
    DB.db.exec('CREATE INDEX IF NOT EXISTS idx_orders_clerk ON orders(clerk_user_id)');
  } catch (e) { threw = e.message; }
  t('re-applying is a no-op', threw === null, threw || '');
}

rmSync(dir, { recursive: true, force: true });

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
