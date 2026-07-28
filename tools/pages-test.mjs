/**
 * Aurelle — admin page separation test.
 *
 * /admin/          is the sign-in page and nothing else
 * /admin/dashboard.html  is the dashboard, and bounces to the login page
 *                        when there is no session
 *
 * Also guards the two bugs that shipped in the previous build:
 *   - a wrong password showed the alarming "session rejected" screen
 *     instead of an inline message on the form
 *   - the dashboard rendered its shell but every panel stayed empty,
 *     because a bad edit had deleted the data-loading functions
 */
import { JSDOM, VirtualConsole } from 'jsdom';

const PORT = process.env.TEST_PORT || 3908;
process.env.PORT = String(PORT);
process.env.ADMIN_EMAIL = 'vhoratanvir1610@gmail.com';
process.env.ADMIN_PASSWORD = 'Aurelle@2026';
delete process.env.AUTH_DRIVER;
delete process.env.CLERK_PUBLISHABLE_KEY;
delete process.env.CLERK_SECRET_KEY;

await import('../server/server.js');
await new Promise(r => setTimeout(r, 800));

const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`ok    ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  → ' + extra : ''}`); }
};
const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

async function page(path, { seedToken, settle = 1800 } = {}) {
  const vc = new VirtualConsole();
  const errs = [];
  const noise = m => /Could not load link|stylesheet|css/i.test(String(m));
  vc.on('jsdomError', e => { if (!noise(e.message)) errs.push(e.message); });
  vc.on('error', (...a) => { const m = a.join(' '); if (!noise(m)) errs.push(m); });

  const dom = await JSDOM.fromURL(BASE + path, {
    runScripts: 'dangerously', resources: 'usable',
    virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = (i, o) => fetch(typeof i === 'string' ? new URL(i, BASE + path).href : i, o);
      w.AbortController = AbortController; w.Headers = Headers;
      w.Request = Request; w.Response = Response;
      w.alert = m => errs.push('ALERT: ' + m);
      w.confirm = () => true;
      if (seedToken) {
        try { w.sessionStorage.setItem('aurelle.admin.token', seedToken); } catch (e) {}
      }
      // Record navigation instead of performing it.
      w.__nav = [];
      w.__navigate = (url) => { w.__nav.push(url); };
    },
  });
  await new Promise(r => setTimeout(r, settle));
  return { dom, doc: dom.window.document, win: dom.window, errs };
}

const login = (email, password) => fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then(async r => ({ status: r.status, data: await r.json() }));

console.log('\n── the login page is only a login page ─────────');
{
  const { doc, errs } = await page('/admin/');
  t('the sign-in card renders', !!doc.querySelector('#loginPanel'));
  t('a password form is offered', !!doc.querySelector('#pwSignIn'));
  t('no dashboard panels are present', doc.querySelectorAll('[data-panel]').length === 0);
  t('no product editor is present', !doc.querySelector('#productScrim'));
  t('no script errors', errs.length === 0, errs.slice(0, 2).join(' | '));
}

console.log('\n── a wrong password is shown on the form ───────');
{
  const { doc, win } = await page('/admin/');
  doc.querySelector('#email').value = 'vhoratanvir1610@gmail.com';
  doc.querySelector('#password').value = 'definitely-wrong';
  doc.querySelector('#pwSignIn').click();
  await new Promise(r => setTimeout(r, 1200));

  const err = doc.querySelector('#loginError');
  t('an inline error appears', err && err.style.display !== 'none', String(err?.style.display));
  t('it says the credentials are wrong', /incorrect/i.test(text(err)), text(err));
  t('the alarming "session rejected" screen is NOT shown',
     !/session was rejected/i.test(text(doc.querySelector('#loginPanel'))));
  t('the sign-in button is usable again',
     doc.querySelector('#pwSignIn') && !doc.querySelector('#pwSignIn').disabled);
  t('and it did not navigate anywhere', (win.__nav || []).length === 0);
}

console.log('\n── the right password goes to the dashboard ────');
{
  const { doc, win } = await page('/admin/');
  doc.querySelector('#email').value = 'vhoratanvir1610@gmail.com';
  doc.querySelector('#password').value = 'Aurelle@2026';
  doc.querySelector('#pwSignIn').click();
  await new Promise(r => setTimeout(r, 1500));

  t('it navigates to the dashboard page',
     (win.__nav || []).some(u => String(u).includes('dashboard.html')),
     JSON.stringify(win.__nav));
}

console.log('\n── the dashboard needs a session ───────────────');
{
  const { win } = await page('/admin/dashboard.html');
  t('no session bounces back to the login page',
     (win.__nav || []).some(u => String(u) === './'), JSON.stringify(win.__nav));
}

console.log('\n── the dashboard actually fills with data ──────');
{
  const r = await login('vhoratanvir1610@gmail.com', 'Aurelle@2026');
  const { doc, errs } = await page('/admin/dashboard.html',
    { seedToken: r.data.token, settle: 3000 });

  t('the shell is visible', doc.querySelector('#appView') &&
     doc.querySelector('#appView').hidden === false);
  t('the KPI cards rendered',
     (doc.querySelector('#kpis')?.innerHTML || '').length > 100,
     String(doc.querySelector('#kpis')?.innerHTML.length));
  t('the order funnel rendered',
     (doc.querySelector('#funnel')?.innerHTML || '').length > 100);
  t('the revenue chart rendered something',
     (doc.querySelector('#chart')?.innerHTML || '').length > 0);
  t('the products table filled',
     doc.querySelectorAll('#productsBody tr').length > 0,
     String(doc.querySelectorAll('#productsBody tr').length));
  t('the signed-in admin is named',
     text(doc.querySelector('#whoEmail')).includes('vhoratanvir1610'),
     text(doc.querySelector('#whoEmail')));
  t('every panel is present', doc.querySelectorAll('[data-panel]').length === 8,
     String(doc.querySelectorAll('[data-panel]').length));
  t('the jewellery editor is present', !!doc.querySelector('#imgGrid'));
  t('no script errors at all', errs.length === 0, errs.slice(0, 3).join(' | '));
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
