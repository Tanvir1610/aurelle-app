/**
 * Aurelle — catalogue resync test.
 *
 * A database that already had products permanently masked the catalogue
 * shipped with the code: seeding only ran when the table was empty. A stale
 * database on the server — or one committed to the repository — meant new
 * products and new photography never appeared, however many times the code
 * was deployed.
 *
 * The bundled catalogue is now fingerprinted. When it changes, seeded rows
 * are brought into line. Anything the admin made or edited is left alone.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; console.log(`ok    ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${e ? '  → ' + e : ''}`); } };

const dir = mkdtempSync(join(tmpdir(), 'aurelle-cat-'));

/* A database from an older build: different products, illustrated art. */
{
  const db = new DatabaseSync(join(dir, 'aurelle.db'));
  db.exec(`CREATE TABLE products (
    id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    cat TEXT NOT NULL, price INTEGER NOT NULL, mrp INTEGER NOT NULL,
    metal TEXT NOT NULL, badge TEXT, rating REAL DEFAULT 4.5,
    reviews INTEGER DEFAULT 0, stock INTEGER DEFAULT 25, blurb TEXT,
    img TEXT, img_alt TEXT, occasion TEXT, swatches TEXT,
    active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));`);
  const ins = db.prepare(`INSERT INTO products
    (id,slug,name,cat,price,mrp,metal,img,img_alt,occasion,swatches)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const [slug, name] of [['rosevine-necklace-set', 'Rosevine Necklace Set'],
                              ['ila-floral-studs', 'Ila Floral Studs'],
                              ['anaya-rose-bracelet', 'Anaya Rose Bracelet']]) {
    ins.run(slug, slug, name, 'Necklace Sets', 2400, 4799, 'Gold',
            `assets/img/p-${slug}.svg`, `assets/img/p-${slug}-alt.svg`, '[]', '[]');
  }
  db.close();
}

process.env.DATA_DIR = dir;
const DB = await import('../server/db.js');

console.log('\n── a stale database no longer masks the catalogue ─');
{
  const before = DB.db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  t('the old catalogue was there to begin with', before === 3, String(before));

  const r = DB.seedIfEmpty();
  t('a resync was performed', !!r.resync, JSON.stringify(r.resync));

  const products = DB.listProducts();
  t('the old products no longer show on the storefront',
     !products.some(p => p.slug === 'rosevine-necklace-set'));
  t('but they are hidden rather than destroyed',
     DB.listProducts(true).some(p => p.slug === 'rosevine-necklace-set'),
     'a legacy shop must be able to get its catalogue back');
  t('the shipped catalogue is present', products.length === 13, String(products.length));
  t('no illustrated art remains',
     products.every(p => !p.img.endsWith('.svg')),
     products.filter(p => p.img.endsWith('.svg')).map(p => p.slug).join(', '));
  t('every product carries real photography',
     products.every(p => /\.(jpe?g|png|webp)$/i.test(p.img) || /^https?:/.test(p.img)));
}

console.log('\n── a second boot changes nothing ───────────────');
{
  const r = DB.seedIfEmpty();
  t('an unchanged catalogue is a no-op', !r.resync, JSON.stringify(r.resync));
  t('the catalogue is stable', DB.listProducts().length === 13);
}

console.log('\n── the admin\'s work is never clobbered ─────────');
{
  DB.upsertProduct({ slug: 'my-own-piece', name: 'My Own Piece', cat: 'Necklaces',
    metal: 'Gold', price: 1500, mrp: 3000, img: 'https://cdn.example.com/mine.jpg',
    occasion: ['Wedding'], swatches: [] });
  DB.upsertProduct({ slug: 'ad-heart-amara', name: 'Renamed By Admin', cat: 'Necklaces',
    metal: 'Gold', price: 888, mrp: 1600, occasion: ['Daily Wear'], swatches: [] });

  // Pretend the next deploy ships a different catalogue.
  DB.db.prepare("UPDATE meta SET value='changed' WHERE key='catalogue_fingerprint'").run();
  const r = DB.seedIfEmpty();
  t('the resync ran', !!r.resync, JSON.stringify(r.resync));

  const mine = DB.getProduct('my-own-piece');
  t('an admin-created product survives',
     !!mine && mine.img === 'https://cdn.example.com/mine.jpg');

  const edited = DB.getProduct('ad-heart-amara');
  t('an admin edit to a seeded product survives',
     !!edited && edited.name === 'Renamed By Admin' && edited.price === 888,
     edited ? `${edited.name} @ ${edited.price}` : 'missing');

  t('untouched seeded products still refresh', r.resync.refreshed > 0, String(r.resync.refreshed));
}

console.log('\n── stock is not reset by a resync ──────────────');
{
  DB.db.prepare("UPDATE products SET stock = 3 WHERE slug = 'ad-tennis-riviera'").run();
  DB.db.prepare("UPDATE meta SET value='changed-again' WHERE key='catalogue_fingerprint'").run();
  DB.seedIfEmpty();
  t('a low stock count is preserved',
     DB.getProduct('ad-tennis-riviera').stock === 3,
     String(DB.getProduct('ad-tennis-riviera').stock));
}

rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
