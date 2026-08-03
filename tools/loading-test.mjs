/**
 * Aurelle — loading feedback and payment-outcome honesty.
 *
 * Two separate concerns, both about not misleading the customer: a tap must
 * visibly register, and a thank-you page must never appear for an order that
 * was not paid for.
 */
import { JSDOM, VirtualConsole } from 'jsdom';

const PORT = process.env.TEST_PORT || 3913;
process.env.PORT = String(PORT);
await import('../server/server.js');
await new Promise(r => setTimeout(r, 800));

const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; console.log(`ok    ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${e ? '  → ' + e : ''}`); } };
const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

async function page(path, settle = 1500) {
  const vc = new VirtualConsole();
  const dom = await JSDOM.fromURL(BASE + path, {
    runScripts: 'dangerously', resources: 'usable',
    virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = (i, o) => fetch(typeof i === 'string' ? new URL(i, BASE + path).href : i, o);
      w.AbortController = AbortController; w.Headers = Headers;
      w.Request = Request; w.Response = Response;
      w.__navigate = () => {}; w.alert = () => {}; w.scrollTo = () => {};
    },
  });
  await new Promise(r => setTimeout(r, settle));
  return { dom, doc: dom.window.document, win: dom.window };
}

console.log('\n── a tap gives immediate feedback ──────────────');
{
  const { doc, win } = await page('/collection.html');
  t('the loading helper is present', !!win.AU_LOADING);

  const link = doc.querySelector('.card a[href^="product.html"]');
  link.dispatchEvent(new win.MouseEvent('click', { bubbles: true, button: 0 }));
  await new Promise(r => setTimeout(r, 60));

  t('a progress bar appears', !!doc.querySelector('.au-progress'));
  const bar = doc.querySelector('.au-progress');
  t('and it is actually advancing', parseFloat(bar.style.width) > 0, bar.style.width);
  // The card is marked immediately. Note the grid may re-render and replace
  // the element, so assert the marking rather than its survival — the
  // progress bar above is the feedback that persists.
  t('the tapped card is marked as loading',
     link.closest('.card').classList.contains('is-loading'),
     link.closest('.card').className);
}

console.log('\n── feedback is not given where it should not be ─');
{
  const { doc, win } = await page('/collection.html');
  const bar0 = doc.querySelector('.au-progress');
  const before = bar0 ? bar0.style.width : '0';

  // An in-page anchor is not a navigation.
  const a = doc.createElement('a');
  a.href = '#somewhere';
  doc.body.appendChild(a);
  a.dispatchEvent(new win.MouseEvent('click', { bubbles: true, button: 0 }));
  await new Promise(r => setTimeout(r, 50));
  t('an anchor link does not trigger it',
     (doc.querySelector('.au-progress').style.width || '0') === before);
}

console.log('\n── add to bag shows it is working ──────────────');
{
  const { doc, win } = await page('/collection.html');
  const add = doc.querySelector('[data-add]');
  add.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  t('the button marks itself busy', add.classList.contains('is-busy'));
  t('and is announced as busy', add.getAttribute('aria-busy') === 'true');

  await new Promise(r => setTimeout(r, 350));
  t('it recovers once done', !add.classList.contains('is-busy'));
  t('and the item did reach the bag', win.AU_CART.totals().count === 1);
}

console.log('\n── skeletons instead of an empty grid ──────────');
{
  const { win } = await page('/');
  const html = win.AU_LOADING.skeletonGrid(4);
  t('placeholder cards are produced',
     (html.match(/class="skeleton-card"/g) || []).length === 4,
     String((html.match(/class="skeleton-card"/g) || []).length));
  t('they shimmer rather than sit blank', html.includes('skeleton-line'));
}

console.log('\n── an unpaid order never says thank you ────────');
{
  // No gateway configured here, so an order cannot have been paid online.
  const { doc } = await page('/confirmation.html?ref=AUR123456', 2200);
  const body = text(doc.querySelector('#confBox'));
  t('the page renders something', body.length > 20, body.slice(0, 60));

  const { doc: bad } = await page('/confirmation.html?ref=nonsense', 1800);
  const badBody = text(bad.querySelector('#confBox'));
  t('a bogus reference is not congratulated',
     !/thank you/i.test(badBody), badBody.slice(0, 90));
  t('it says the payment is not complete',
     /not completed|not confirmed|could not find/i.test(badBody), badBody.slice(0, 90));
  t('nothing has been charged is made clear',
     /nothing has been charged|not received/i.test(badBody), badBody.slice(0, 120));
  t('there is a way to pay again', !!bad.querySelector('#retryPay'));
  t('and a way back to the bag', /back to my bag/i.test(bad.querySelector('#confBox').innerHTML));
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
