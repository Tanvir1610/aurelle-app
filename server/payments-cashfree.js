/**
 * Aurelle — Cashfree payment gateway.
 *
 * Credentials come from the environment and are never written into source:
 *
 *   CASHFREE_APP_ID       the App ID  (x-client-id)
 *   CASHFREE_SECRET_KEY   the Secret Key (x-client-secret)  — SERVER ONLY
 *   CASHFREE_ENV          'sandbox' (default) or 'production'
 *   PUBLIC_URL            where the shopper returns to, e.g.
 *                         https://aurelle-app.onrender.com
 *
 * The secret key can create charges against your merchant account. It must
 * never reach a browser, a repository, or a log line.
 *
 * Production is opt-in: without CASHFREE_ENV=production this talks to the
 * sandbox, so a misconfigured deploy cannot take real money by accident.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const APP_ID = process.env.CASHFREE_APP_ID || '';
const SECRET = process.env.CASHFREE_SECRET_KEY || '';
const ENV = (process.env.CASHFREE_ENV || 'sandbox').toLowerCase();
const API_VERSION = process.env.CASHFREE_API_VERSION || '2023-08-01';

const BASE = ENV === 'production'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

export const isConfigured = () => !!(APP_ID && SECRET);
export const isLive = () => ENV === 'production';

/**
 * A production secret is recognisable by its prefix. Refuse to run one
 * against the sandbox or vice versa — a mismatch silently fails at checkout
 * and is miserable to diagnose.
 */
export function configWarning() {
  if (!isConfigured()) return null;

  /* Cashfree marks environment in the secret key: cfsk_ma_prod_… versus
     cfsk_ma_test_… . Sending production credentials to the sandbox host (or
     the reverse) fails only at the moment a customer tries to pay, with an
     error that does not say why — so catch it at boot instead. */
  const looksLive = /_prod_/.test(SECRET);
  const looksTest = /_test_/.test(SECRET);

  if (looksLive && ENV !== 'production') {
    return 'Your Cashfree key is a PRODUCTION key but CASHFREE_ENV is "' + ENV + '". ' +
           'Production credentials are rejected by the sandbox host. Either set ' +
           'CASHFREE_ENV=production, or use your sandbox credentials for testing.';
  }
  if (looksTest && ENV === 'production') {
    return 'CASHFREE_ENV is "production" but your Cashfree key is a TEST key. ' +
           'Test credentials are rejected by the live host.';
  }
  if (!looksLive && !looksTest) {
    return 'The Cashfree secret key does not look like either a test or a ' +
           'production key. Copy it again from Developers → API Keys.';
  }
  return null;
}

/* ------------------------------------------------------------- http -- */
async function call(path, { method = 'GET', body, timeout = 15000 } = {}) {
  if (!isConfigured()) throw new Error('Cashfree is not configured on this server');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'x-api-version': API_VERSION,
        'x-client-id': APP_ID,
        'x-client-secret': SECRET,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });

    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = { raw: text }; } }

    if (!res.ok) {
      // Cashfree returns a readable message; never echo the credentials back.
      const msg = (data && (data.message || data.error_description)) || `Cashfree ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.code = data && data.code;
      throw err;
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Cashfree timed out. Try again.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------- create order -- */
/**
 * Open a payment session for an order that already exists in our database.
 * The amount is taken from our own record, never from the browser.
 */
export async function createPaymentSession(order, { returnUrl, notifyUrl } = {}) {
  if (!order || !order.ref) throw new Error('An order is required');
  const amount = Number(order.total);
  if (!(amount > 0)) throw new Error('Order total must be above zero');

  const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const payload = {
    order_id: order.ref,
    order_amount: Number(amount.toFixed(2)),
    order_currency: 'INR',
    customer_details: {
      // Cashfree requires an id; ours is stable per shopper or per order.
      customer_id: order.clerk_user_id || `guest_${order.ref}`,
      customer_name: `${order.first_name} ${order.last_name}`.trim(),
      customer_email: order.email,
      customer_phone: String(order.phone || '').replace(/\D/g, '').slice(-10),
    },
    order_meta: {
      return_url: returnUrl ||
        `${publicUrl}/confirmation.html?ref=${encodeURIComponent(order.ref)}`,
      notify_url: notifyUrl || (publicUrl ? `${publicUrl}/api/payments/webhook` : undefined),
    },
    order_note: `Aurelle order ${order.ref}`,
  };

  const data = await call('/orders', { method: 'POST', body: payload });
  return {
    paymentSessionId: data.payment_session_id,
    cfOrderId: data.cf_order_id,
    orderId: data.order_id,
    amount: data.order_amount,
    expiresAt: data.order_expiry_time || null,
  };
}

/* ---------------------------------------------------------- verify -- */
/**
 * Ask Cashfree what actually happened. Never trust a redirect or a browser
 * claim that payment succeeded — this is the only source of truth.
 */
export async function fetchOrderStatus(ref) {
  const data = await call(`/orders/${encodeURIComponent(ref)}`);
  return {
    ref: data.order_id,
    status: data.order_status,           // PAID | ACTIVE | EXPIRED | TERMINATED
    amount: data.order_amount,
    paid: data.order_status === 'PAID',
  };
}

export async function fetchPayments(ref) {
  const data = await call(`/orders/${encodeURIComponent(ref)}/payments`);
  return Array.isArray(data) ? data : [];
}

/* --------------------------------------------------------- webhook -- */
/**
 * Cashfree signs webhooks as base64(HMAC-SHA256(timestamp + rawBody, secret)).
 * Compare in constant time so the check cannot be probed byte by byte.
 */
export function verifyWebhook({ signature, timestamp, rawBody }) {
  if (!SECRET) return false;
  if (!signature || !timestamp || !rawBody) return false;

  const expected = createHmac('sha256', SECRET)
    .update(String(timestamp) + rawBody)
    .digest('base64');

  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * What the browser is allowed to know: whether payments work, and which
 * environment to point the SDK at.
 *
 * The App ID is deliberately NOT here. Unlike a Stripe publishable key,
 * Cashfree's x-client-id is a server credential used to authenticate order
 * creation. The browser only ever needs the payment_session_id our server
 * hands back, so publishing the App ID gives away half a credential pair
 * for nothing.
 */
export function publicConfig() {
  return {
    enabled: isConfigured(),
    mode: ENV === 'production' ? 'production' : 'sandbox',
  };
}
