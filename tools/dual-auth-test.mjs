/**
 * Aurelle — dual admin sign-in test.
 *
 * The dashboard must be reachable by password even when Clerk is the
 * configured driver. Clerk owns customer identity; the password is a
 * dependency-free way into the back office when Clerk is misconfigured,
 * unreachable, or the operator simply prefers it.
 */
const PORT = process.env.TEST_PORT || 3907;
process.env.PORT = String(PORT);
process.env.AUTH_DRIVER = 'clerk';
process.env.ADMIN_EMAIL = 'vhoratanvir1610@gmail.com';
process.env.ADMIN_PASSWORD = 'Aurelle@2026';
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_Y3JlZGlibGUtYmxvd2Zpc2gtMzQuY2xlcmsuYWNjb3VudHMuZGV2JA';
process.env.CLERK_SECRET_KEY = 'sk_test_dummy_wrong_on_purpose';

await import('../server/server.js');
await new Promise(r => setTimeout(r, 800));

const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`ok    ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  → ' + extra : ''}`); }
};

const login = (email, password) => fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then(async r => ({ status: r.status, data: await r.json() }));

console.log('\n── both routes are advertised ──────────────────');
{
  const cfg = await (await fetch(BASE + '/api/config')).json();
  t('Clerk is the configured driver', cfg.auth === 'clerk');
  t('password sign-in is also offered', cfg.passwordLogin === true);
  t('an administrator exists', cfg.adminCount === 1, String(cfg.adminCount));
}

console.log('\n── password sign-in works under Clerk ──────────');
let token = null;
{
  const r = await login('vhoratanvir1610@gmail.com', 'Aurelle@2026');
  t('the configured password is accepted', r.status === 200 && !!r.data.token,
     JSON.stringify(r.data));
  token = r.data.token;

  const wrong = await login('vhoratanvir1610@gmail.com', 'not-the-password');
  t('a wrong password is rejected', wrong.status === 401);

  const stranger = await login('someone@else.com', 'Aurelle@2026');
  t('an unknown address is rejected', stranger.status === 401);

  const caps = await login('VhoraTanvir1610@Gmail.com', 'Aurelle@2026');
  t('capitalisation does not matter', caps.status === 200 && !!caps.data.token);
}

console.log('\n── that token opens the whole dashboard ────────');
{
  const H = { authorization: `Bearer ${token}` };
  const paths = ['auth/me', 'admin/stats', 'admin/orders', 'admin/products',
                 'admin/customers', 'admin/images', 'admin/messages',
                 'admin/subscribers', 'admin/admins'];
  for (const p of paths) {
    const r = await fetch(`${BASE}/api/${p}`, { headers: H });
    t(`/api/${p} accepts it`, r.status === 200, String(r.status));
  }
}

console.log('\n── it can actually manage the store ────────────');
{
  const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const made = await fetch(BASE + '/api/admin/products', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      slug: 'dual-auth-piece', name: 'Dual Auth Piece', cat: 'Rings',
      metal: 'Gold', price: 1500, mrp: 3000, stock: 8,
      img: 'assets/img/p-zara-sapphire-ring.svg',
      imgAlt: 'assets/img/p-zara-sapphire-ring-alt.svg',
      occasion: ['Everyday'], swatches: [{ key: 'gold', color: '#b8935a', label: 'Gold' }],
    }),
  });
  t('a product can be added with a password session', made.status === 200);

  const live = await (await fetch(BASE + '/api/products/dual-auth-piece')).json();
  t('and it reaches the storefront', live.price === 1500, JSON.stringify(live.price));

  await fetch(BASE + '/api/admin/products/dual-auth-piece', { method: 'DELETE',
    headers: { authorization: `Bearer ${token}` } });
}

console.log('\n── forged tokens still get nowhere ─────────────');
{
  const parts = token.split('.');
  const forged = parts[0] + '.tampered-signature';
  const r = await fetch(BASE + '/api/admin/stats', { headers: { authorization: `Bearer ${forged}` } });
  t('a tampered token is refused', r.status === 401, String(r.status));

  const none = await fetch(BASE + '/api/admin/stats');
  t('no token is refused', none.status === 401);
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
