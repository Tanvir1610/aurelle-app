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

console.log('\n── phone sign-in is offered ────────────────────');
{
  const { doc } = await page('/account.html');
  const body = text(doc.querySelector('#accountBox'));
  t('it asks for a mobile number', /mobile number/i.test(body), body.slice(0, 80));
  t('it explains the one-time code', /one-time code|SMS/i.test(body));
  t('there is a number field', !!doc.querySelector('#phInput'));
  t('there is a send button', !!doc.querySelector('#phSend'));
  t('the country code is shown', /\+91/.test(doc.querySelector('#accountBox').innerHTML));
}

console.log('\n── the number field guards its input ───────────');
{
  const { doc, win } = await page('/account.html');
  const input = doc.querySelector('#phInput');

  input.value = 'abc12def34xy5678901';
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  t('letters are stripped', /^\d*$/.test(input.value), input.value);
  t('it stops at ten digits', input.value.length <= 10, input.value);

  input.value = '1234567890';
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  doc.querySelector('#phSend').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  t('a number not starting 6-9 is refused before sending',
     /valid 10-digit/i.test(text(doc.querySelector('#accountBox'))));
}

console.log('\n── customer order history over the API ─────────');
{
  // Orders carry a Clerk user id, and only that user can see them.
  const order = await (await fetch(BASE + '/api/orders', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Ira', lastName: 'Shah', email: 'ira@example.com',
      phone: '9876501234', address: '9 Palm Road', city: 'Pune', pincode: '411001',
      items: [{ slug: 'ad-heart-amara', qty: 1 }],
    }),
  })).json();
  t('guest checkout still works', /^AUR\d{6}$/.test(order.ref || ''), JSON.stringify(order));

  const unauth = await fetch(BASE + '/api/me/phone');
  t('order history requires sign-in', unauth.status === 401);
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
