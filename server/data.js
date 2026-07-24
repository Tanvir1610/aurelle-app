/**
 * Aurelle — data driver selector.
 *
 * DB_DRIVER=sqlite    (default) local file, zero setup, great for development
 * DB_DRIVER=supabase  hosted Postgres, survives restarts, needed in production
 *
 * Both drivers export the same function names. The SQLite ones are
 * synchronous and the Supabase ones return promises — callers simply
 * `await` everything, which is harmless on a plain value.
 */
const DRIVER = (process.env.DB_DRIVER || 'sqlite').toLowerCase();

let impl;

if (DRIVER === 'supabase') {
  impl = await import('./db-supabase.js');
} else if (DRIVER === 'sqlite') {
  impl = await import('./db.js');
} else {
  throw new Error(`Unknown DB_DRIVER "${DRIVER}". Use "sqlite" or "supabase".`);
}

/* Not every driver implements every extra. Provide safe stand-ins so
   server.js never has to branch on which driver is loaded. */
const notSupported = name => async () => {
  throw new Error(`${name} requires DB_DRIVER=supabase`);
};

export const DB_DRIVER = DRIVER;
export const DB_PATH = impl.DB_PATH;

export const catalogue        = impl.catalogue;
export const listProducts     = impl.listProducts;
export const getProduct       = impl.getProduct;
export const upsertProduct    = impl.upsertProduct;
export const deleteProduct    = impl.deleteProduct;
export const createOrder      = impl.createOrder;
export const getOrder         = impl.getOrder;
export const listOrders       = impl.listOrders;
export const setOrderStatus   = impl.setOrderStatus;
export const ORDER_STATUSES   = impl.ORDER_STATUSES;
export const createMessage    = impl.createMessage;
export const listMessages     = impl.listMessages;
export const setMessageHandled = impl.setMessageHandled;
export const addSubscriber    = impl.addSubscriber;
export const listSubscribers  = impl.listSubscribers;
export const stats            = impl.stats;
export const seedIfEmpty      = impl.seedIfEmpty;

/* Customer accounts — Supabase only (SQLite build predates Clerk). */
export const upsertCustomer    = impl.upsertCustomer    || notSupported('Customer accounts');
export const getCustomerOrders = impl.getCustomerOrders || notSupported('Order history');

/* Admin allow-list. On SQLite this is the local password table instead. */
export const isAdmin   = impl.isAdmin   || null;
export const listAdmins = impl.listAdmins || (() => []);
export const addAdmin  = impl.addAdmin  || notSupported('Admin management');

/* SQLite-only helpers, exported when present so existing tools keep working. */
export const db               = impl.db;
export const hashPassword     = impl.hashPassword;
export const verifyPassword   = impl.verifyPassword;
export const ensureAdmin      = impl.ensureAdmin;
export const setAdminPassword = impl.setAdminPassword;
export const ping             = impl.ping || (async () => true);
