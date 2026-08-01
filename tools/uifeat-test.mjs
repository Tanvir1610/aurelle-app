/**
 * Aurelle — bottom nav, sticky buy bar and help chat.
 *
 * These are the three mobile patterns from the annotated reference. Built in
 * Aurelle's own visual language — the patterns are standard, the styling is
 * not borrowed.
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const PORT = process.env.TEST_PORT || 3911;
process.env.PORT = String(PORT);
await import('../server/server.js');
await new Promise(r => setTimeout(r, 700));

const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; console.log(`ok    ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${e ? '  → ' + e : ''}`); } };
const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

async function page(path, settle = 1600) {
  const vc = new VirtualConsole();
  const errs = [];
  vc.on('jsdomError', e => { if (!/Could not load link|css/i.test(e.message)) errs.push(e.message); });
  const dom = await JSDOM.fromURL(BASE + path, {
    runScripts: 'dangerously', resources: 'usable',
    virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = (i, o) => fetch(typeof i === 'string' ? new URL(i, BASE + path).href : i, o);
      w.AbortController = AbortController; w.Headers = Headers;
      w.Request = Request; w.Response = Response;
      w.alert = () => {}; w.__navigate = () => {};
    },
  });
  await new Promise(r => setTimeout(r, settle));
  return { dom, doc: dom.window.document, win: dom.window, errs };
}

console.log('\n── bottom navigation ───────────────────────────');
{
  const { doc } = await page('/');
  const nav = doc.querySelector('.botnav');
  t('the bar exists', !!nav);
  const items = Array.from(doc.querySelectorAll('.botnav__item'));
  t('five destinations', items.length === 5, String(items.length));
  t('the labels are Home, Category, Trending, Stores, Account',
     items.map(a => txt(a)).join(',') === 'Home,Category,Trending,Stores,Account',
     items.map(a => txt(a)).join(','));
  t('each one is a real link', items.every(a => (a.getAttribute('href') || '').length > 3));
  t('each carries an icon', items.every(a => !!a.querySelector('svg')));
  t('the current page is marked', !!doc.querySelector('.botnav__item.is-current'));
  t('and marked for assistive tech too',
     doc.querySelector('.botnav__item.is-current')?.getAttribute('aria-current') === 'page');
}

console.log('\n── it follows the page you are on ──────────────');
{
  const { doc } = await page('/stores.html');
  t('Stores is highlighted there',
     txt(doc.querySelector('.botnav__item.is-current')) === 'Stores',
     txt(doc.querySelector('.botnav__item.is-current')));
}

console.log('\n── sticky add to cart ──────────────────────────');
{
  const { doc, win } = await page('/product.html?p=ad-solitaire-radiance', 2000);
  const bar = doc.querySelector('.buybar');
  t('the bar is added on a product page', !!bar);
  t('the page reserves room for it', doc.body.classList.contains('has-buybar'));
  t('it shows the price', txt(doc.querySelector('.buybar__price')).includes('1,299'),
     txt(doc.querySelector('.buybar__price')));
  t('it has its own quantity stepper', !!doc.querySelector('#barQty'));
  t('and an add button', !!doc.querySelector('#barAdd'));

  // The two steppers must not drift apart.
  doc.querySelector('#barUp').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  t('bumping the bar updates the main stepper',
     doc.querySelector('#qtyVal').textContent === '2',
     doc.querySelector('#qtyVal').textContent);
  t('and the bar agrees with itself', doc.querySelector('#barQty').textContent === '2');

  doc.querySelector('#barAdd').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  t('it adds the chosen quantity', win.AU_CART.totals().count === 2,
     String(win.AU_CART.totals().count));

  const other = await page('/');
  t('no buy bar on pages without a product', !other.doc.querySelector('.buybar'));
}

console.log('\n── help chat ───────────────────────────────────');
{
  const { doc, win, errs } = await page('/');
  t('the launcher is present', !!doc.querySelector('#chatLaunch'));
  t('the panel starts closed', !doc.querySelector('#chatPanel').classList.contains('is-open'));

  doc.querySelector('#chatLaunch').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 120));

  t('clicking opens it', doc.querySelector('#chatPanel').classList.contains('is-open'));
  t('it greets you', txt(doc.querySelector('.chat-msg--bot')).length > 20);

  const asks = Array.from(doc.querySelectorAll('.chat-ask'));
  t('built-in questions are offered', asks.length >= 10, String(asks.length));
  t('they come from the FAQ content',
     asks.some(b => /tarnish/i.test(txt(b))), asks.slice(0, 3).map(txt).join(' | '));
  t('shop-specific ones are there too',
     asks.some(b => /where is my order/i.test(txt(b))));

  asks[0].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  t('asking one echoes the question', !!doc.querySelector('.chat-msg--me'));
  t('and answers it', doc.querySelectorAll('.chat-msg--bot').length >= 2,
     String(doc.querySelectorAll('.chat-msg--bot').length));

  doc.querySelector('#chatClose').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  t('it closes again', !doc.querySelector('#chatPanel').classList.contains('is-open'));
  t('no script errors', errs.length === 0, errs.slice(0, 2).join(' | '));
}

console.log('\n── these are mobile-only where they should be ──');
{
  const css = readFileSync(new URL('../assets/css/site.css', import.meta.url), 'utf8');
  const at = css.indexOf('@media (max-width: 768px)');
  // The bar and buybar are hidden by default and only shown on phones.
  t('the bottom bar is hidden by default', /\.botnav\s*\{\s*display:\s*none/.test(css));
  t('the buy bar is hidden by default', /\.buybar\s*\{\s*display:\s*none/.test(css));
  t('both appear on phones',
     /\.botnav\s*\{[^}]*display:\s*grid/.test(css.slice(at)) &&
     /\.buybar\s*\{[^}]*display:\s*flex/.test(css.slice(at)));
  t('the bar clears the home indicator', /env\(safe-area-inset-bottom/.test(css));
  t('toasts sit above the bar', /\.toasts\s*\{\s*bottom:\s*calc\(58px/.test(css.slice(at)));
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
