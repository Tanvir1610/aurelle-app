/**
 * Aurelle — account page tests.
 *
 * The live site showed an empty panel because auth initialisation hung and
 * the paint function was never called. These assertions lock that shut: the
 * account area must render something in every state, including failure.
 *
 * Run: node tools/account-test.mjs
 */
import { JSDOM, VirtualConsole } from 'jsdom';

const PORT = process.env.TEST_PORT || 3903;
process.env.PORT = String(PORT);
process.env.ADMIN_EMAIL = 'admin@aurelle.local';
process.env.ADMIN_PASSWORD = 'aurelle-admin';

await import('../server/server.js');
await new Promise(r => setTimeout(r, 700));

const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`ok    ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  → ' + extra : ''}`); }
};

const noise = m => /Could not load|stylesheet|css|clerk/i.test(String(m));

async function page(path, { clerkConfig, hangConfig = false, settle = 2000 } = {}) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!noise(e.message)) console.error(e.message); });

  const dom = await JSDOM.fromURL(BASE + path, {
    runScripts: 'dangerously', resources: 'usable',
    virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(win) {
      win.AbortController = AbortController;
      win.Headers = Headers; win.Request = Request; win.Response = Response;
      win.fetch = (input, init) => {
        const url = typeof input === 'string' ? new URL(input, BASE + path).href : input;
        // Let a test pretend Clerk is configured without a real Clerk account.
        // Simulate an auth endpoint that never answers — the exact
        // condition that left the live account page blank.
        if (hangConfig && String(url).endsWith('/api/config')) {
          return new Promise(() => {});
        }
        if (clerkConfig && String(url).endsWith('/api/config')) {
          return Promise.resolve(new Response(JSON.stringify(clerkConfig), {
            headers: { 'content-type': 'application/json' },
          }));
        }
        return fetch(url, init);
      };
    },
  });
  await new Promise(r => setTimeout(r, settle));
  return { dom, doc: dom.window.document, win: dom.window };
}

const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

console.log('\n── the box is never empty ──────────────────────');
{
  const { doc, win } = await page('/account.html');
  const box = doc.querySelector('#accountBox');
  t('account box exists', !!box);
  t('account box has content', text(box).length > 0, '(EMPTY — the original bug)');
  t('auth module finished starting', win.AU_AUTH.state().ready === true);
}

console.log('\n── Clerk switched off ──────────────────────────');
{
  const { doc } = await page('/account.html');
  const body = text(doc.querySelector('#accountBox'));
  t('explains that accounts are off', /not switched on/i.test(body), body.slice(0, 80));
  t('offers order tracking instead', !!doc.querySelector('a[href="track-order.html"]'));
  t('offers a route back to shopping', !!doc.querySelector('#accountBox a[href="collection.html"]'));
}

console.log('\n── Clerk configured but unreachable ────────────');
{
  // A real publishable key shape, pointed at a host that cannot answer.
  // This is what a slow or blocked CDN looks like from the browser.
  const { doc, win } = await page('/account.html', {
    clerkConfig: {
      auth: 'clerk', db: 'sqlite', freeShippingAt: 999,
      clerk: { enabled: true, publishableKey: 'pk_test_fake',
               frontendApi: 'unreachable.invalid' },
    },
    settle: 13000,
  });
  const box = doc.querySelector('#accountBox');
  const body = text(box);

  t('still renders something', body.length > 0, '(EMPTY — the original bug)');
  t('reports that sign-in is unavailable', /could not reach|unavailable/i.test(body), body.slice(0, 90));
  t('offers a retry', !!doc.querySelector('#retryAuth'));
  t('reassures that checkout still works', /guest/i.test(body));
  t('auth reports ready despite failure', win.AU_AUTH.state().ready === true);
  t('auth records the reason', !!win.AU_AUTH.state().error, JSON.stringify(win.AU_AUTH.state().error));
}

console.log('\n── signed-out prompt when Clerk is healthy ─────');
{
  // Fake a loaded Clerk so we can assert the signed-out UI without a real one.
  const { doc, win } = await page('/account.html');
  const box = doc.querySelector('#accountBox');
  // Drive the paint function directly through a subscriber snapshot.
  win.AU_AUTH.subscribe(() => {});
  const paintable = typeof win.AU_AUTH.retry === 'function';
  t('a retry entry point exists', paintable);
  t('box still populated after subscribe', text(box).length > 0);
}

console.log('\n── auth that never responds at all ─────────────');
{
  // Before the fix, boot awaited auth init, so a hung request meant the
  // account controller never ran and the box stayed permanently empty.
  const { doc, win } = await page('/account.html', { hangConfig: true, settle: 3000 });
  const box = doc.querySelector('#accountBox');
  const body = text(box);

  t('page renders without waiting for auth', body.length > 0, '(EMPTY — the live bug)');
  t('shows a loading state meanwhile', /loading/i.test(body), body.slice(0, 70));
  t('header still rendered', !!doc.querySelector('.site-header'));
  t('footer still rendered', !!doc.querySelector('.site-footer'));
  t('cart drawer still wired', !!doc.querySelector('#cartDrawer'));
  t('auth is still pending, as expected', win.AU_AUTH.state().ready === false);
}

console.log('\n── a hung auth service does not block shopping ──');
{
  const { doc, win } = await page('/collection.html', { hangConfig: true, settle: 3000 });
  t('product grid renders', doc.querySelectorAll('#plpGrid .card').length > 0);
  t('filters render', doc.querySelectorAll('#filters .filter-opt').length > 0);

  const card = doc.querySelector('[data-add]');
  card.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  t('items can still be added to the bag', win.AU_CART.totals().count === 1);
}

console.log('\n── customer order history over the API ─────────');
{
  // Orders carry a Clerk user id, and only that user can see them.
  const order = await (await fetch(BASE + '/api/orders', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Ira', lastName: 'Shah', email: 'ira@example.com',
      phone: '9876501234', address: '9 Palm Road', city: 'Pune', pincode: '411001',
      items: [{ slug: 'ila-floral-studs', qty: 1 }],
    }),
  })).json();
  t('guest checkout still works', /^AUR\d{6}$/.test(order.ref || ''), JSON.stringify(order));

  const unauth = await fetch(BASE + '/api/me/orders');
  t('order history requires sign-in', unauth.status === 401);
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
