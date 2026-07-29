/**
 * Aurelle — mobile layout guards.
 *
 * jsdom performs no layout, so these assert the stylesheet rules that keep a
 * 320px screen from scrolling sideways, and that touch targets are large
 * enough to hit. Each one corresponds to a defect found by audit.
 */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; console.log(`ok    ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${e ? '  → ' + e : ''}`); } };

const site = readFileSync(new URL('../assets/css/site.css', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../admin/admin.css', import.meta.url), 'utf8');

/** Isolate a media block so matches cannot drift across unrelated rules. */
function block(css, query) {
  const at = css.indexOf(query);
  if (at === -1) return '';
  const next = css.indexOf('@media', at + 10);
  return css.slice(at, next === -1 ? undefined : next);
}

const phone = block(site, '@media (max-width: 768px)');
const adminPhone = block(admin, '@media (max-width: 640px)');
const adminTablet = block(admin, '@media (max-width: 1024px)');

console.log('\n── nothing forces the page wider than the screen ─');
{
  t('the toast has no width floor',
     /\.toast\s*\{[^}]*min-width:\s*0/.test(phone));
  t('the newsletter field is fluid',
     /\.newsletter__form input\s*\{[^}]*flex:\s*1 1 100%/.test(phone));
  t('the two buy buttons stack rather than sit side by side',
     /\.pdp__buy \.btn\s*\{[^}]*flex:\s*1 1 100%/.test(phone));
  t('the account name block has no width floor',
     /\.dash-hero__who\s*\{[^}]*min-width:\s*0/.test(phone));
}

console.log('\n── touch targets are big enough to hit ─────────');
{
  const size = (re) => { const m = phone.match(re); return m ? Number(m[1]) : 0; };
  t('finish swatches are at least 40px',
     size(/\.pdp__swatches \.swatch\s*\{[^}]*width:\s*(\d+)px/) >= 40);
  t('the wishlist heart is at least 40px',
     size(/\.wishlist\s*\{[^}]*width:\s*(\d+)px/) >= 40);
  t('header icons are at least 44px',
     size(/\.icon-btn\s*\{[^}]*width:\s*(\d+)px/) >= 44);
  t('filter rows have a comfortable hit area',
     /\.filter-opt\s*\{[^}]*padding-block:\s*10px/.test(phone));
}

console.log('\n── the promises sit four across ────────────────');
{
  t('four columns, not a stack',
     /\.usp__grid\s*\{\s*grid-template-columns:\s*repeat\(4/.test(phone));
  t('icon above label in each cell',
     /\.usp__item\s*\{[^}]*flex-direction:\s*column/.test(phone));
}

console.log('\n── the dashboard survives a phone ──────────────');
{
  // Eight nav items cannot fit across a phone; they must scroll.
  t('the admin nav scrolls instead of overflowing',
     /\.side nav\s*\{[^}]*overflow-x:\s*auto/.test(adminTablet), 'nav would run off-screen');
  t('nav labels do not wrap mid-word',
     /\.side nav button\s*\{[^}]*white-space:\s*nowrap/.test(adminTablet));
  t('the search toolbar has no width floor',
     /\.toolbar input[^{]*\{[^}]*min-width:\s*0/.test(adminPhone));
  t('the order funnel fits a narrow panel',
     /\.funnel__row\s*\{[^}]*grid-template-columns:\s*74px/.test(adminPhone));
  t('dialog buttons stack on a phone',
     /\.modal__actions\s*\{[^}]*flex-direction:\s*column-reverse/.test(adminPhone));
}

console.log('\n── layouts collapse at the right points ────────');
{
  const tablet = block(site, '@media (max-width: 1024px)');
  for (const [cls, where, css] of [
    ['product-grid', 'tablet', tablet], ['plp', 'tablet', tablet],
    ['pdp', 'tablet', tablet], ['cart-page', 'tablet', tablet],
    ['story', 'tablet', tablet], ['footer__grid', 'tablet', tablet],
  ]) {
    t(`.${cls} collapses on ${where}`, css.includes('.' + cls));
  }
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
