/**
 * Aurelle — demo data seeder.
 *
 * Fills the database with realistic orders, enquiries and subscribers so the
 * dashboard has something to show. Safe to run repeatedly: it skips if orders
 * already exist unless you pass --force.
 *
 *   node tools/seed-demo.mjs
 *   node tools/seed-demo.mjs --force     wipe demo data and rebuild
 *
 * Set SEED_DEMO=1 to have the server do this automatically on boot — useful
 * on hosts with an ephemeral filesystem, where the database resets on restart.
 */
import * as DB from '../server/db.js';

const force = process.argv.includes('--force');

/* Deterministic pseudo-random so repeat runs look consistent. */
let seed = 20260724;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const CUSTOMERS = [
  ['Ananya', 'Kulkarni', 'ananya.k@example.com', '9822014576', '14 Sunrise Arcade, CG Road', 'Ahmedabad', '380009'],
  ['Priya', 'Sharma', 'priya.sharma@example.com', '9845123390', '302 Palm Grove, Indiranagar', 'Bengaluru', '560038'],
  ['Meher', 'Rastogi', 'meher.r@example.com', '9811276543', 'B-12 Aurobindo Place, Hauz Khas', 'New Delhi', '110016'],
  ['Sneha', 'Desai', 'sneha.desai@example.com', '9879654312', '7 Riverside Colony, Vastrapur', 'Ahmedabad', '380015'],
  ['Nikita', 'Verma', 'nikita.v@example.com', '9820145678', '21 Linking Road, Bandra West', 'Mumbai', '400050'],
  ['Tanya', 'Joshi', 'tanya.joshi@example.com', '9866234511', 'Road 36, Jubilee Hills', 'Hyderabad', '500033'],
  ['Rhea', 'Nair', 'rhea.nair@example.com', '9895412300', '9 Lane 7, Koregaon Park', 'Pune', '411001'],
  ['Ishita', 'Bose', 'ishita.b@example.com', '9830112244', '58 Southern Avenue', 'Kolkata', '700029'],
  ['Kavya', 'Reddy', 'kavya.reddy@example.com', '9849001122', '12 Banjara Hills Road 2', 'Hyderabad', '500034'],
  ['Aditi', 'Menon', 'aditi.menon@example.com', '9847556677', '33 Marine Drive', 'Kochi', '682031'],
  ['Simran', 'Kaur', 'simran.k@example.com', '9814332211', '76 Model Town', 'Ludhiana', '141002'],
  ['Divya', 'Iyer', 'divya.iyer@example.com', '9884556677', '5 Boat Club Road', 'Chennai', '600028'],
];

const PAYMENTS = ['UPI', 'Credit or debit card', 'Net banking', 'Cash on delivery (+₹49)'];
const FINISHES = ['Gold', 'Rose Gold', 'Silver', 'Pearl'];

const ENQUIRIES = [
  ['A return or exchange', 'The choker arrived a size small on me. Can I exchange it for the adjustable version instead of a refund?'],
  ['Product question', 'Do the Aisha jhumkas work with unpierced ears, or is there a clip-on option coming?'],
  ['An order', 'My order shows shipped but the tracking has not moved in two days. Could you check with the courier?'],
  ['Bulk or bridal order', 'I need 22 matching sets for my sister\'s wedding party in October. What lead time should I plan for?'],
  ['Product question', 'Is the Meera pearl set safe to wear daily in Chennai humidity? I react to most plated jewellery.'],
  ['An order', 'Could you add a gift note to order AUR queued yesterday? It is a birthday present.'],
  ['Something else', 'Do you have a store in Jaipur, or plans for one? I would rather try the bridal sets on first.'],
  ['A return or exchange', 'One stone came loose on the Sitara choker after a fortnight. Warranty covers this, correct?'],
];

const SUBSCRIBERS = [
  'ananya.k@example.com', 'priya.sharma@example.com', 'meher.r@example.com',
  'sneha.desai@example.com', 'nikita.v@example.com', 'rhea.nair@example.com',
  'ishita.b@example.com', 'kavya.reddy@example.com', 'aditi.menon@example.com',
  'lakshmi.p@example.com', 'farah.q@example.com', 'juhi.mehta@example.com',
  'anita.rao@example.com', 'pooja.singh@example.com', 'neha.gupta@example.com',
];

/** Backdate a row so the dashboard chart has a real 14-day shape. */
function backdate(table, id, daysAgo, hour) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, between(0, 59), between(0, 59), 0);
  const ts = d.toISOString().slice(0, 19).replace('T', ' ');
  DB.db.prepare(`UPDATE ${table} SET created_at = ? WHERE id = ?`).run(ts, id);
  return ts;
}

export function seedDemo({ silent = false } = {}) {
  const log = (...a) => { if (!silent) console.log(...a); };

  const existing = DB.db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
  if (existing > 0 && !force) {
    log(`Database already has ${existing} orders. Use --force to rebuild demo data.`);
    return { skipped: true };
  }

  if (force) {
    DB.db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM messages; DELETE FROM subscribers;');
    log('Cleared existing orders, messages and subscribers.');
  }

  const products = DB.listProducts();
  if (!products.length) {
    log('No products found — start the server once to seed the catalogue first.');
    return { skipped: true };
  }

  /* ------------------------------------------------------- orders -- */
  // Weighted so recent days are busier — a plausible growth curve.
  const perDay = [2, 1, 3, 2, 4, 3, 2, 5, 3, 4, 6, 4, 5, 7];
  const statusForAge = age =>
    age > 9 ? 'delivered' : age > 5 ? 'shipped' : age > 2 ? 'packed' : 'placed';

  let made = 0, revenue = 0;

  for (let i = 0; i < perDay.length; i++) {
    const daysAgo = perDay.length - 1 - i;
    for (let n = 0; n < perDay[i]; n++) {
      const [firstName, lastName, email, phone, address, city, pincode] = pick(CUSTOMERS);
      const itemCount = rnd() < 0.35 ? 2 : 1;
      const chosen = [];
      for (let k = 0; k < itemCount; k++) {
        const p = pick(products);
        if (!chosen.some(c => c.slug === p.slug)) {
          chosen.push({ slug: p.slug, qty: rnd() < 0.8 ? 1 : 2, finish: pick(FINISHES) });
        }
      }

      let order;
      try {
        order = DB.createOrder({
          firstName, lastName, email, phone, address, city, pincode,
          payment: pick(PAYMENTS), items: chosen,
        });
      } catch (e) {
        continue; // out of stock — skip and carry on
      }

      const status = rnd() < 0.05 ? 'cancelled' : statusForAge(daysAgo);
      DB.setOrderStatus(order.ref, status);
      backdate('orders', order.id, daysAgo, between(9, 21));

      made++;
      if (status !== 'cancelled') revenue += order.total;
    }
  }
  log(`Created ${made} orders worth ₹${revenue.toLocaleString('en-IN')}.`);

  /* ----------------------------------------------------- messages -- */
  ENQUIRIES.forEach(([subject, body], i) => {
    const [firstName, lastName, email] = pick(CUSTOMERS);
    const m = DB.createMessage({
      name: `${firstName} ${lastName}`, email, subject, body,
      orderRef: rnd() < 0.4 ? DB.listOrders({ limit: 1 })[0]?.ref : null,
    });
    backdate('messages', m.id, between(0, 11), between(8, 22));
    if (i < 3) DB.setMessageHandled(m.id, true);
  });
  log(`Created ${ENQUIRIES.length} enquiries (3 marked handled).`);

  /* -------------------------------------------------- subscribers -- */
  SUBSCRIBERS.forEach(e => DB.addSubscriber(e));
  log(`Added ${SUBSCRIBERS.length} newsletter subscribers.`);

  /* ------------------------------------------------- stock spread -- */
  // Push a few products low so the low-stock panel has something to say.
  const low = products.slice(0, 4);
  low.forEach((p, i) => {
    DB.db.prepare('UPDATE products SET stock = ? WHERE slug = ?').run([2, 5, 8, 9][i], p.slug);
  });
  log('Set four products to low stock.');

  const s = DB.stats();
  log(`\nDashboard now shows:`);
  log(`  revenue        ₹${s.revenue.toLocaleString('en-IN')}`);
  log(`  orders         ${s.orders} (${s.pending} need action)`);
  log(`  average order  ₹${s.aov.toLocaleString('en-IN')}`);
  log(`  enquiries      ${s.unread} unread`);
  log(`  subscribers    ${s.subscribers}`);

  return { orders: made, revenue };
}

/* Run directly, rather than imported by the server. */
if (import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1]?.endsWith('seed-demo.mjs')) {
  DB.seedIfEmpty();
  seedDemo();
}
