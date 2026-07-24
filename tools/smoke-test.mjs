/**
 * Aurelle — smoke test.
 * Boots each page in jsdom, runs the real scripts, and asserts that the
 * dynamic regions actually filled in. Run: node tools/smoke-test.mjs
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CASES = [
  ['index.html', ['#heroSlides .hero__slide', '#catGrid .cat-tile', '#railNew .card',
                  '#railBest .card', '#collectionTiles .tile', '#budgetTiles .budget-tile',
                  '#reviewGrid .review', '#uspStrip .usp__item', '#storePreview .store',
                  '.site-header', '.site-footer', '#cartDrawer']],
  ['collection.html', ['#filters .filter-opt', '#plpGrid .card', '#plpPager button']],
  ['product.html?p=rosevine-necklace-set', ['#pdpGallery .gallery__thumb', '#pdpInfo h1',
                  '#pdpInfo .accordion__item', '#pdpAlso .card', '#pdpReviews .review']],
  ['cart.html', ['#cartWrap']],
  ['checkout.html', ['#coForm', '#coSummary']],
  ['confirmation.html?ref=AUR123456', ['#confPicks .card']],
  ['wishlist.html', ['#wishGrid']],
  ['about.html', ['.story', '.site-footer']],
  ['contact.html', ['#contactForm']],
  ['stores.html', ['#storeGrid .store']],
  ['faq.html', ['#faqList .accordion__item']],
  ['journal.html', ['#journalGrid .tile', '#journalList article']],
  ['track-order.html', ['#trackForm']],
  ['account.html', ['#authForm']],
];

let failures = 0;
let checks = 0;

for (const [target, selectors] of CASES) {
  const [file, query = ''] = target.split('?');
  const html = readFileSync(resolve(root, file), 'utf8');

  const vc = new VirtualConsole();
  const errors = [];
  // External assets (webfonts) cannot load in a sandboxed test runner.
  // That is environment noise, not a defect — only collect real errors.
  const isNoise = m => /Could not load link|Could not load img|net::|ENOTFOUND/i.test(String(m));
  vc.on('jsdomError', e => { if (!isNoise(e.message)) errors.push(e.message); });
  vc.on('error', (...a) => { const m = a.join(' '); if (!isNoise(m)) errors.push(m); });

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: pathToFileURL(resolve(root, file)).href + (query ? '?' + query : ''),
    virtualConsole: vc,
    pretendToBeVisual: true,
  });

  // Scripts are local + synchronous; give the load event a tick.
  await new Promise(r => {
    if (dom.window.document.readyState === 'complete') return r();
    dom.window.addEventListener('load', r);
    setTimeout(r, 900);
  });

  const doc = dom.window.document;
  const missing = selectors.filter(s => { checks++; return !doc.querySelector(s); });

  if (missing.length || errors.length) {
    failures++;
    console.log(`FAIL  ${target}`);
    missing.forEach(m => console.log(`        missing: ${m}`));
    errors.slice(0, 3).forEach(e => console.log(`        error:   ${String(e).split('\n')[0]}`));
  } else {
    console.log(`ok    ${target}  (${selectors.length} assertions)`);
  }

  // Interaction probe on the homepage: add to bag must update the badge.
  if (file === 'index.html') {
    const btn = doc.querySelector('[data-add]');
    btn?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    const count = doc.querySelector('#cartCount')?.textContent;
    checks++;
    if (count !== '1') { failures++; console.log(`FAIL  add-to-bag did not update badge (got "${count}")`); }
    else console.log('ok    add-to-bag updates the cart badge');

    const drawerOpen = doc.querySelector('#cartDrawer')?.classList.contains('is-open');
    checks++;
    if (!drawerOpen) { failures++; console.log('FAIL  cart drawer did not open'); }
    else console.log('ok    cart drawer opens on add');
  }

  dom.window.close();
}

console.log(`\n${checks} assertions, ${failures} failure${failures === 1 ? '' : 's'}`);
process.exit(failures ? 1 : 0);
