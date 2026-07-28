/**
 * Aurelle — payment integration test.
 *
 * Cashfree cannot be reached from this environment, so these assertions
 * cover the parts that must be right regardless of the gateway: that the
 * secret never leaks, that amounts come from our own records, that a
 * forged webhook is refused, and that nothing takes real money by accident.
 */
const PORT = process.env.TEST_PORT || 3910;
process.env.PORT = String(PORT);
process.env.ADMIN_EMAIL = 'a@b.com';
process.env.ADMIN_PASSWORD = 'x';
process.env.CASHFREE_APP_ID = 'TEST_APP_ID_123';
process.env.CASHFREE_SECRET_KEY = 'cfsk_ma_test_fake_secret_for_testing';
delete process.env.CASHFREE_ENV;   // must default to sandbox

await import('../server/server.js');
await new Promise(r => setTimeout(r, 800));
const Pay = await import('../server/payments-cashfree.js');
const { createHmac } = await import('node:crypto');

const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; console.log(`ok    ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${e ? '  → ' + e : ''}`); } };

console.log('\n── the secret never leaves the server ──────────');
{
  const cfg = await (await fetch(BASE + '/api/config')).json();
  t('payments are advertised', cfg.payments.enabled === true);
  t('the App ID is public, as intended', cfg.payments.appId === 'TEST_APP_ID_123');
  t('the secret is NOT in the config', !JSON.stringify(cfg).includes('cfsk_'),
     JSON.stringify(cfg).slice(0, 120));
  t('production is opt-in, sandbox by default', cfg.payments.mode === 'sandbox');
}

console.log('\n── a key/environment mismatch is caught ────────');
{
  t('a sandbox key with sandbox env is fine', Pay.configWarning() === null);
}

console.log('\n── amounts come from our records ───────────────');
{
  const bad = await fetch(BASE + '/api/payments/session', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ref: 'AUR999999', amount: 1 }),
  });
  t('an unknown reference is refused', bad.status === 404, String(bad.status));

  const malformed = await fetch(BASE + '/api/payments/session', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ref: 'not-a-ref' }),
  });
  t('a malformed reference is refused', malformed.status === 400);

  // The endpoint accepts no amount field at all — prove it by reading the source.
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf("/api\\/payments\\/session"), src.indexOf('/api\\/payments\\/verify'));
  t('the session route never reads an amount from the browser',
     !/body\.amount|\bamount\b\s*=/.test(block));
}

console.log('\n── webhooks must be signed ─────────────────────');
{
  const body = JSON.stringify({ data: { order: { order_id: 'AUR123456' },
                                        payment: { payment_status: 'SUCCESS' } } });

  const none = await fetch(BASE + '/api/payments/webhook', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body });
  t('an unsigned webhook is rejected', none.status === 401, String(none.status));

  const forged = await fetch(BASE + '/api/payments/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json',
               'x-webhook-signature': 'ZmFrZQ==', 'x-webhook-timestamp': '123' },
    body });
  t('a forged signature is rejected', forged.status === 401);

  const ts = String(Date.now());
  const good = createHmac('sha256', process.env.CASHFREE_SECRET_KEY)
    .update(ts + body).digest('base64');
  const real = await fetch(BASE + '/api/payments/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json',
               'x-webhook-signature': good, 'x-webhook-timestamp': ts },
    body });
  t('a correctly signed webhook is accepted', real.status === 200, String(real.status));
}

console.log('\n── signature checking itself ───────────────────');
{
  const raw = '{"hello":"world"}';
  const ts = '1700000000';
  const sig = createHmac('sha256', process.env.CASHFREE_SECRET_KEY)
    .update(ts + raw).digest('base64');

  t('a valid signature verifies',
     Pay.verifyWebhook({ signature: sig, timestamp: ts, rawBody: raw }) === true);
  t('a tampered body fails',
     Pay.verifyWebhook({ signature: sig, timestamp: ts, rawBody: raw + ' ' }) === false);
  t('a replayed signature with a new timestamp fails',
     Pay.verifyWebhook({ signature: sig, timestamp: '1700000001', rawBody: raw }) === false);
  t('missing pieces fail closed',
     Pay.verifyWebhook({ signature: null, timestamp: ts, rawBody: raw }) === false);
}

console.log('\n── an order paid in full is required ───────────');
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
  t('the verify route compares the gateway amount with ours',
     /amount mismatch/.test(src));
  t('an order only advances once the gateway says PAID',
     /result\.paid && order && order\.status === 'placed'/.test(src));
}

console.log('\n── cash on delivery is priced by the server ────');
{
  const base = { firstName: 'A', lastName: 'B', email: 'a@b.com', phone: '9876543210',
                 address: '1 Rd', city: 'Pune', pincode: '411001',
                 items: [{ slug: 'ad-heart-amara', qty: 1 }] };
  const post = body => fetch(BASE + '/api/orders', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    .then(r => r.json());

  const online = await post({ ...base, payment: 'Online' });
  const cod = await post({ ...base, payment: 'Cash on delivery' });

  t('an online order carries no handling fee', online.total === 878, String(online.total));
  t('cash on delivery adds exactly the fee', cod.total - online.total === 49,
     `${online.total} -> ${cod.total}`);

  // The browser must not be able to talk its way out of the fee.
  const spoofed = await post({ ...base, payment: 'Cash on delivery', total: 1 });
  t('a browser-supplied total is ignored', spoofed.total === 927, String(spoofed.total));
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
