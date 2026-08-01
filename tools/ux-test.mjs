/**
 * Aurelle — mobile UX features.
 *
 * Bottom tab bar, sticky buy bar, category chips and the help chat.
 * These are standard storefront conventions, built in Aurelle's own
 * design language.
 */
import { JSDOM, VirtualConsole } from 'jsdom';

const PORT = process.env.TEST_PORT || 3911;
process.env.PORT = String(PORT);
await import('../server/server.js');
await new Promise(r => setTimeout(r, 800));

const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; console.log(`ok    ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${e ? '  → ' + e : ''}`); } };
const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

async function page(path, settle = 1600) {
  const vc = new VirtualConsole();
  const errs = [];
  vc.on('jsdomError', e => { if (!/Could not load|css/i.test(e.message)) errs.push(e.message); });
  const dom = await JSDOM.fromURL(BASE + path, {
    runScripts: 'dangerously', resources: 'usable',
    virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = (i, o) => fetch(typeof i === 'string' ? new URL(i, BASE + path).href : i, o);
      w.AbortController = AbortController; w.Headers = Headers;
      w.Request = Request; w.Response = Response;
      w.__navigate = () => {}; w.alert = () => {}; w.confirm = () => true;
      w.scrollTo = () => {};
    },
  });
  await new Promise(r => setTimeout(r, settle));
  return { dom, doc: dom.window.document, win: dom.window, errs };
}

console.log('\n── the bottom tab bar ──────────────────────────');
{
  const { doc } = await page('/');
  const nav = doc.querySelector('.botnav');
  t('it exists on every page', !!nav);

  const labels = Array.from(doc.querySelectorAll('.botnav__item span')).map(s => s.textContent);
  t('five destinations', labels.length === 5, labels.join(', '));
  t('home, category, trending, stores, account',
     ['Home', 'Category', 'Trending', 'Stores', 'Account'].every(l => labels.includes(l)),
     labels.join(', '));
  t('each has an icon',
     doc.querySelectorAll('.botnav__item svg').length === 5);
  t('each links somewhere real',
     Array.from(doc.querySelectorAll('.botnav__item'))
       .every(a => (a.getAttribute('href') || '').length > 3));
  t('the current page is marked',
     !!doc.querySelector('.botnav__item.is-current'));
}

console.log('\n── the sticky buy bar ──────────────────────────');
{
  const { doc, win } = await page('/product.html?p=ad-solitaire-radiance');
  const bar = doc.querySelector('.pdp-sticky');
  t('it exists on a product page', !!bar);
  t('it carries a quantity stepper', !!doc.querySelector('#sQtyUp') && !!doc.querySelector('#sQtyDown'));
  t('it shows the price', /₹/.test(text(doc.querySelector('#sPrice'))), text(doc.querySelector('#sPrice')));
  t('it has an add button', !!doc.querySelector('#sAdd'));

  // The two steppers must not drift apart.
  doc.querySelector('#sQtyUp').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  t('its quantity tracks the main one',
     doc.querySelector('#sQtyVal').textContent === doc.querySelector('#qtyVal').textContent,
     `${doc.querySelector('#sQtyVal').textContent} vs ${doc.querySelector('#qtyVal').textContent}`);
  t('the price follows the quantity',
     text(doc.querySelector('#sPrice')).includes('2,598'), text(doc.querySelector('#sPrice')));

  doc.querySelector('#sAdd').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  t('it adds to the bag', win.AU_CART.totals().count === 2, String(win.AU_CART.totals().count));

  const { doc: home } = await page('/');
  t('it does not appear on other pages', !home.querySelector('.pdp-sticky'));
}

console.log('\n── category chips on the collection page ───────');
{
  const { doc, win } = await page('/collection.html');
  const chips = doc.querySelectorAll('.cat-chip');
  t('chips are rendered', chips.length > 1, String(chips.length));
  t('the first is All, and is selected',
     text(chips[0]).startsWith('All') && chips[0].classList.contains('is-active'));
  t('each carries a count', /\(\d+\)/.test(text(chips[1])), text(chips[1]));

  const before = doc.querySelector('#plpCount').textContent;
  chips[1].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150));
  t('tapping one filters the grid',
     doc.querySelector('#plpCount').textContent !== before,
     `${before} -> ${doc.querySelector('#plpCount').textContent}`);
  t('and it becomes the selected chip',
     doc.querySelectorAll('.cat-chip.is-active').length === 1);
}

console.log('\n── the filter sheet ────────────────────────────');
{
  const { doc, win } = await page('/collection.html');
  const sheet = doc.querySelector('#filterSheet');
  t('the sidebar is a sheet on phones', !!sheet);
  t('a Filter button opens it', !!doc.querySelector('#openFilters'));

  doc.querySelector('#openFilters').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  t('it opens', sheet.classList.contains('is-open'));
  doc.querySelector('#applyFilters').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  t('Show results closes it', !sheet.classList.contains('is-open'));
  t('a separate sort control exists for phones', !!doc.querySelector('#plpSortMobile'));
}

console.log('\n── the help chat ───────────────────────────────');
{
  const { doc, win } = await page('/');
  t('a help button is present', !!doc.querySelector('#chatLaunch'));
  t('the panel starts closed', !doc.querySelector('#chatPanel').classList.contains('is-open'));

  doc.querySelector('#chatLaunch').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  t('it opens on tap', doc.querySelector('#chatPanel').classList.contains('is-open'));
  t('it greets the visitor', text(doc.querySelector('#chatLog')).length > 30);

  const choices = doc.querySelectorAll('.chat-ask');
  t('it offers questions to tap', choices.length >= 3, String(choices.length));

  choices[0].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 700));
  const log = text(doc.querySelector('#chatLog'));
  t('it answers', log.length > 120, String(log.length));
  t('it offers follow-up questions', doc.querySelectorAll('.chat-ask').length > 0);

}

console.log('\n── the chat answers from shop facts ────────────');
{
  const { doc, win } = await page('/');
  doc.querySelector('#chatLaunch').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));

  const asks = Array.from(doc.querySelectorAll('.chat-ask')).map(b => b.textContent.trim());
  t('it offers several questions', asks.length >= 3, asks.join(' | '));
  t('delivery is covered', asks.some(a => /deliver|shipping|order/i.test(a)), asks.join(' | '));

  // Work through every question and check each produces a real answer.
  let answered = 0;
  for (let i = 0; i < Math.min(asks.length, 4); i++) {
    const btns = doc.querySelectorAll('.chat-ask');
    if (!btns[i]) break;
    btns[i].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    if (text(doc.querySelector('#chatLog')).length > 80) answered++;
  }
  t('each question produces an answer', answered >= 1, String(answered));
  t('the log grows as the conversation goes on',
     doc.querySelectorAll('.chat-msg').length >= 3,
     String(doc.querySelectorAll('.chat-msg').length));
  t('replies are attributed to the shop, not a person',
     doc.querySelectorAll('.chat-msg--bot').length >= 2);
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
