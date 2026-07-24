/**
 * Aurelle — sign-in button tests.
 *
 * The admin dashboard rendered a "Sign in with email" button that did
 * nothing when clicked, because the click handler was `if (clerk) ...` and
 * `clerk` was either still null or assigned before load() had finished.
 * A silent no-op is the worst failure mode, so these assertions require
 * visible feedback in every state.
 */
import { JSDOM, VirtualConsole } from 'jsdom';

const PORT = process.env.TEST_PORT || 3905;
process.env.PORT = String(PORT);
process.env.AUTH_DRIVER = 'clerk';
process.env.ADMIN_EMAIL = 'vhoratanvir1610@gmail.com';
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_Y3JlZGlibGUtYmxvd2Zpc2gtMzQuY2xlcmsuYWNjb3VudHMuZGV2JA';
process.env.CLERK_SECRET_KEY = 'sk_test_dummy';

await import('../server/server.js');
await new Promise(r => setTimeout(r, 700));

const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`ok    ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  → ' + extra : ''}`); }
};
const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

async function page(path, settle = 2500) {
  const vc = new VirtualConsole();
  const dom = await JSDOM.fromURL(BASE + path, {
    runScripts: 'dangerously', resources: 'usable',
    virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(win) {
      win.AbortController = AbortController;
      win.Headers = Headers; win.Request = Request; win.Response = Response;
      win.fetch = (i, init) => fetch(typeof i === 'string' ? new URL(i, BASE + path).href : i, init);
      win.alert = () => {};
    },
  });
  await new Promise(r => setTimeout(r, settle));
  return { dom, doc: dom.window.document, win: dom.window };
}

console.log('\n── admin: Clerk cannot load in this environment ─');
{
  // jsdom cannot reach Clerk's CDN, which is exactly what a blocked script
  // or unregistered origin looks like in a real browser.
  const { doc } = await page('/admin/', 16000);
  const panel = doc.querySelector('#loginPanel');
  const body = text(panel);

  t('login panel renders', body.length > 0);
  t('the failure is reported, not silent',
     /unavailable|could not|timed out|blocked/i.test(body), body.slice(0, 100));
  t('a retry is offered', !!doc.querySelector('#clerkRetry'));
  t('the likely causes are explained', /Domains|blocking|different Clerk/i.test(body));

  const dead = doc.querySelector('#clerkSignIn');
  t('no dead sign-in button is left behind', !dead || dead.disabled);
}

console.log('\n── admin: the button is never a silent no-op ────');
{
  const { doc } = await page('/admin/', 1200);
  const btn = doc.querySelector('#clerkSignIn');
  if (btn) {
    t('button is disabled while starting up', btn.disabled === true);
    t('and it says so', /preparing/i.test(text(btn)), text(btn));
  } else {
    // Already moved to the error state, which is also acceptable feedback.
    t('button is disabled while starting up', true);
    t('and it says so', /unavailable|could not/i.test(text(doc.querySelector('#loginPanel'))));
  }
}

console.log('\n── storefront: sign-in reports rather than dies ─');
{
  const { doc, win } = await page('/account.html', 15000);
  const box = doc.querySelector('#accountBox');
  t('account area rendered', text(box).length > 0);

  const result = win.AU_AUTH.signIn();
  t('signIn returns a definite outcome', result === false || result === true, String(result));
  t('a reason is recorded when it fails',
     result === true || !!win.AU_AUTH.state().error,
     JSON.stringify(win.AU_AUTH.state().error));
}

console.log('\n── the admin gate itself still holds ───────────');
{
  const noTok = await fetch(BASE + '/api/admin/stats');
  t('dashboard API rejects anonymous callers', noTok.status === 401);
  const bad = await fetch(BASE + '/api/admin/stats',
    { headers: { authorization: 'Bearer forged.token.here' } });
  t('and forged tokens', bad.status === 401);

  const DB = await import('../server/data.js');
  const admins = (await DB.listAdmins()).map(a => a.email);
  t('the configured owner is on the list',
     admins.includes('vhoratanvir1610@gmail.com'), admins.join(', '));
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
