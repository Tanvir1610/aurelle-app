/**
 * Aurelle — Supabase data layer.
 *
 * Speaks to PostgREST over plain fetch, so there is still no npm
 * dependency. Exposes exactly the same functions as db.js (the SQLite
 * driver), which is what lets server.js swap between them.
 *
 * Requires:
 *   SUPABASE_URL              https://<ref>.supabase.co
 *   SUPABASE_SERVICE_KEY      service_role key — SERVER ONLY, never shipped
 *                             to a browser. It bypasses row-level security.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const REST = `${URL_BASE}/rest/v1`;

if (!URL_BASE || !KEY) {
  throw new Error(
    'Supabase driver needs SUPABASE_URL and SUPABASE_SERVICE_KEY.\n' +
    'Find both at: Supabase dashboard → Project Settings → API');
}

const T = {
  products: 'aurelle_products',
  orders: 'aurelle_orders',
  items: 'aurelle_order_items',
  messages: 'aurelle_messages',
  subs: 'aurelle_subscribers',
  customers: 'aurelle_customers',
  admins: 'aurelle_admins',
};

/* ------------------------------------------------------------- http -- */
async function rest(path, { method = 'GET', body, prefer, timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${REST}${path}`, {
      method,
      headers: {
        apikey: KEY,
        authorization: `Bearer ${KEY}`,
        'content-type': 'application/json',
        ...(prefer ? { prefer } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });

    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }

    if (!res.ok) {
      const msg = (data && (data.message || data.hint || data.error)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('Supabase timed out. If the project is paused, resume it in the dashboard.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const rpc = (fn, args) => rest(`/rpc/${fn}`, { method: 'POST', body: args || {} });

/* ------------------------------------------------------- catalogue -- */
function readFrontendCatalogue() {
  const src = readFileSync(resolve(ROOT, 'assets/js/data.js'), 'utf8');
  const sandbox = { window: {} };
  new Function('window', src)(sandbox.window);
  return sandbox.window.AU_DATA;
}

function rowToProduct(r) {
  return {
    slug: r.slug, name: r.name, cat: r.cat,
    price: Number(r.price), mrp: Number(r.mrp),
    metal: r.metal, badge: r.badge,
    rating: Number(r.rating), reviews: r.reviews, stock: r.stock,
    blurb: r.blurb, img: r.img, imgAlt: r.img_alt,
    occasion: r.occasion || [], swatches: r.swatches || [],
  };
}

export async function listProducts(includeInactive = false) {
  const filter = includeInactive ? '' : '&active=eq.true';
  const rows = await rest(`/${T.products}?select=*${filter}&order=created_at.asc`);
  return rows.map(rowToProduct);
}

export async function getProduct(slug, includeInactive = false) {
  const filter = includeInactive ? '' : '&active=eq.true';
  const rows = await rest(`/${T.products}?select=*&slug=eq.${encodeURIComponent(slug)}${filter}&limit=1`);
  return rows.length ? rowToProduct(rows[0]) : null;
}

export async function catalogue() {
  const base = readFrontendCatalogue();
  base.products = await listProducts();
  return base;
}

export async function upsertProduct(p) {
  const row = {
    slug: p.slug, name: p.name, cat: p.cat,
    price: Number(p.price), mrp: Number(p.mrp), metal: p.metal,
    badge: p.badge || null, stock: p.stock ?? 25, blurb: p.blurb || '',
    occasion: p.occasion || ['Everyday'],
    swatches: p.swatches || [{ key: 'gold', color: '#b8935a', label: 'Gold' }],
    active: p.active === false ? false : true,
    img: p.img || 'assets/img/cat-necklace-sets.svg',
    img_alt: p.imgAlt || 'assets/img/cat-earrings.svg',
  };
  const existing = await getProduct(p.slug, true);
  if (existing) {
    // Keep existing artwork unless the editor sent a replacement.
    if (!p.img) { delete row.img; delete row.img_alt; }
    await rest(`/${T.products}?slug=eq.${encodeURIComponent(p.slug)}`,
               { method: 'PATCH', body: row, prefer: 'return=minimal' });
  } else {
    await rest(`/${T.products}`, { method: 'POST', body: row, prefer: 'return=minimal' });
  }
  return getProduct(p.slug, true);
}

export async function deleteProduct(slug) {
  await rest(`/${T.products}?slug=eq.${encodeURIComponent(slug)}`,
             { method: 'PATCH', body: { active: false }, prefer: 'return=minimal' });
  return true;
}

/* ----------------------------------------------------------- orders -- */
export async function createOrder(payload) {
  // All pricing, stock checks and inserts happen inside one Postgres
  // transaction — see aurelle_create_order in server/schema.sql.
  const result = await rpc('aurelle_create_order', { payload });
  return getOrder(result.ref);
}

export async function getOrder(ref) {
  const rows = await rest(`/${T.orders}?select=*&ref=eq.${encodeURIComponent(ref)}&limit=1`);
  if (!rows.length) return null;
  const o = rows[0];
  o.items = await rest(`/${T.items}?select=*&order_id=eq.${o.id}`);
  return o;
}

export async function listOrders({ status, q, clerkUserId, limit = 100 } = {}) {
  let path = `/${T.orders}?select=*,${T.items}(*)&order=created_at.desc&limit=${limit}`;
  if (status && status !== 'all') path += `&status=eq.${encodeURIComponent(status)}`;
  if (clerkUserId) path += `&clerk_user_id=eq.${encodeURIComponent(clerkUserId)}`;
  if (q) {
    const like = `*${q}*`;
    path += `&or=(ref.ilike.${like},email.ilike.${like},first_name.ilike.${like},last_name.ilike.${like})`;
  }
  const rows = await rest(path);
  return rows.map(r => {
    const { [T.items]: items, ...rest_ } = r;
    return { ...rest_, items: items || [] };
  });
}

export const ORDER_STATUSES = ['placed', 'packed', 'shipped', 'delivered', 'cancelled'];

export async function setOrderStatus(ref, status) {
  if (!ORDER_STATUSES.includes(status)) throw new Error('Invalid status');
  await rest(`/${T.orders}?ref=eq.${encodeURIComponent(ref)}`,
             { method: 'PATCH', body: { status }, prefer: 'return=minimal' });
  return getOrder(ref);
}

/* --------------------------------------------------------- messages -- */
export async function createMessage(m) {
  const rows = await rest(`/${T.messages}`, {
    method: 'POST',
    body: { name: m.name, email: m.email, order_ref: m.orderRef || null,
            subject: m.subject || 'General', body: m.body },
    prefer: 'return=representation',
  });
  return rows[0];
}

export async function listMessages() {
  return rest(`/${T.messages}?select=*&order=created_at.desc&limit=200`);
}

export async function setMessageHandled(id, handled) {
  const rows = await rest(`/${T.messages}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', body: { handled: !!handled }, prefer: 'return=representation',
  });
  return rows[0];
}

/* ------------------------------------------------------ subscribers -- */
export async function addSubscriber(email) {
  await rest(`/${T.subs}`, {
    method: 'POST',
    body: { email: String(email).toLowerCase() },
    prefer: 'resolution=ignore-duplicates,return=minimal',
  });
  return true;
}

export async function listSubscribers() {
  return rest(`/${T.subs}?select=*&order=created_at.desc`);
}

/* -------------------------------------------------------- customers -- */
/** Called after Clerk verifies a session, so the shop has its own record. */
export async function upsertCustomer({ clerkUserId, email, firstName, lastName, phone }) {
  const rows = await rest(`/${T.customers}?select=*&clerk_user_id=eq.${encodeURIComponent(clerkUserId)}&limit=1`);
  if (rows.length) {
    await rest(`/${T.customers}?clerk_user_id=eq.${encodeURIComponent(clerkUserId)}`, {
      method: 'PATCH',
      body: { email, last_seen_at: new Date().toISOString(),
              ...(firstName ? { first_name: firstName } : {}),
              ...(lastName ? { last_name: lastName } : {}),
              ...(phone ? { phone } : {}) },
      prefer: 'return=minimal',
    });
    return { ...rows[0], email };
  }
  const created = await rest(`/${T.customers}`, {
    method: 'POST',
    body: { clerk_user_id: clerkUserId, email,
            first_name: firstName || null, last_name: lastName || null,
            phone: phone || null },
    prefer: 'return=representation',
  });
  return created[0];
}

export async function getCustomerOrders(clerkUserId) {
  return listOrders({ clerkUserId, limit: 50 });
}

/* ------------------------------------------------------------ admins -- */
export async function isAdmin({ clerkUserId, email }) {
  const parts = [];
  if (clerkUserId) parts.push(`clerk_user_id.eq.${clerkUserId}`);
  if (email) parts.push(`email.eq.${String(email).toLowerCase()}`);
  if (!parts.length) return null;
  const rows = await rest(`/${T.admins}?select=*&or=(${parts.join(',')})&limit=1`);
  if (!rows.length) return null;

  // Bind the Clerk id the first time this admin signs in.
  if (clerkUserId && !rows[0].clerk_user_id) {
    await rest(`/${T.admins}?id=eq.${rows[0].id}`, {
      method: 'PATCH', body: { clerk_user_id: clerkUserId }, prefer: 'return=minimal',
    });
  }
  return rows[0];
}

export async function listAdmins() {
  return rest(`/${T.admins}?select=email,name,role,clerk_user_id,created_at&order=created_at.asc`);
}

export async function addAdmin({ email, name, role = 'manager' }) {
  const rows = await rest(`/${T.admins}`, {
    method: 'POST',
    body: { email: String(email).toLowerCase().trim(), name: name || 'Store manager', role },
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return rows[0];
}

/** Customers with lifetime order stats. PostgREST cannot aggregate across
 *  a join, so pull both sides and combine here — the volumes are small. */
export async function listCustomers() {
  const [people, orders] = await Promise.all([
    rest(`/${T.customers}?select=*&order=created_at.desc`),
    rest(`/${T.orders}?select=clerk_user_id,total,status,created_at&clerk_user_id=not.is.null`),
  ]);
  const agg = {};
  for (const o of orders) {
    const k = o.clerk_user_id;
    if (!agg[k]) agg[k] = { orders: 0, spent: 0, last_order: null };
    agg[k].orders += 1;
    if (o.status !== 'cancelled') agg[k].spent += Number(o.total);
    if (!agg[k].last_order || o.created_at > agg[k].last_order) agg[k].last_order = o.created_at;
  }
  return people.map(c => ({
    clerk_user_id: c.clerk_user_id, email: c.email,
    first_name: c.first_name, last_name: c.last_name, phone: c.phone,
    created_at: c.created_at, last_seen_at: c.last_seen_at,
    ...(agg[c.clerk_user_id] || { orders: 0, spent: 0, last_order: null }),
  })).sort((a, b) => b.spent - a.spent);
}

export async function listGuestBuyers() {
  const rows = await rest(`/${T.orders}?select=email,first_name,last_name,phone,city,total,status,created_at&clerk_user_id=is.null`);
  const by = {};
  for (const o of rows) {
    if (!by[o.email]) by[o.email] = {
      email: o.email, first_name: o.first_name, last_name: o.last_name,
      phone: o.phone, city: o.city, orders: 0, spent: 0, last_order: null,
    };
    const g = by[o.email];
    g.orders += 1;
    if (o.status !== 'cancelled') g.spent += Number(o.total);
    if (!g.last_order || o.created_at > g.last_order) g.last_order = o.created_at;
  }
  return Object.values(by).sort((a, b) => b.spent - a.spent);
}

export async function removeAdmin(email) {
  const all = await listAdmins();
  if (all.length <= 1) throw new Error('Cannot remove the last administrator');
  await rest(`/${T.admins}?email=eq.${encodeURIComponent(String(email).toLowerCase())}`,
             { method: 'DELETE', prefer: 'return=minimal' });
  return true;
}

/* ------------------------------------------------------------ stats -- */
export async function stats() {
  const s = await rpc('aurelle_stats');
  return {
    revenue: Number(s.revenue) || 0,
    orders: Number(s.orders) || 0,
    pending: Number(s.pending) || 0,
    unread: Number(s.unread) || 0,
    subscribers: Number(s.subscribers) || 0,
    customers: Number(s.customers) || 0,
    products: Number(s.products) || 0,
    aov: Number(s.aov) || 0,
    lowStock: s.lowStock || [],
    byStatus: s.byStatus || [],
    topProducts: s.topProducts || [],
    daily: (s.daily || []).map(d => ({
      day: d.day, orders: Number(d.orders), revenue: Number(d.revenue),
    })),
  };
}

/* ------------------------------------------------------------- seed -- */
export async function seedIfEmpty() {
  const existing = await rest(`/${T.products}?select=slug&limit=1`);
  const seeded = { products: 0, admin: false };

  if (!existing.length) {
    const cat = readFrontendCatalogue();
    const rows = cat.products.map(p => ({
      slug: p.slug, name: p.name, cat: p.cat, price: p.price, mrp: p.mrp,
      metal: p.metal, badge: p.badge || null, rating: p.rating, reviews: p.reviews,
      stock: 20 + Math.floor(Math.random() * 60), blurb: p.blurb,
      img: p.img, img_alt: p.imgAlt, occasion: p.occasion, swatches: p.swatches,
    }));
    // Chunked so a large catalogue does not exceed the request limit.
    for (let i = 0; i < rows.length; i += 25) {
      await rest(`/${T.products}`, {
        method: 'POST', body: rows.slice(i, i + 25), prefer: 'return=minimal',
      });
    }
    seeded.products = rows.length;
  }

  // Bootstrap the first dashboard user from the environment.
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  if (email) {
    const admins = await listAdmins();
    if (!admins.some(a => a.email === email)) {
      await addAdmin({ email, name: 'Store owner', role: 'owner' });
      seeded.admin = { mode: 'created', email };
    } else {
      seeded.admin = { mode: 'existing', email };
    }
  } else {
    const admins = await listAdmins();
    seeded.admin = admins.length
      ? { mode: 'existing', email: admins[0].email }
      : { mode: 'none' };
  }

  return seeded;
}

export const DB_PATH = `${URL_BASE} (Supabase)`;
export const DRIVER = 'supabase';

/** Quick reachability probe used at boot. */
export async function ping() {
  await rest(`/${T.products}?select=slug&limit=1`, { timeout: 8000 });
  return true;
}
