/**
 * Aurelle — hero banner test.
 *
 * The homepage banners carry their own headline, call to action and badges
 * inside the artwork. So they must render with no overlay text and no scrim,
 * or the two sets of words collide.
 */
import { JSDOM, VirtualConsole } from 'jsdom';

const PORT = process.env.TEST_PORT || 3909;
process.env.PORT = String(PORT);
await import('../server/server.js');
await new Promise(r => setTimeout(r, 700));

const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`ok    ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  → ' + extra : ''}`); }
};

const vc = new VirtualConsole();
const errs = [];
vc.on('jsdomError', e => { if (!/Could not load link|css/i.test(e.message)) errs.push(e.message); });

const dom = await JSDOM.fromURL(BASE + '/', {
  runScripts: 'dangerously', resources: 'usable',
  virtualConsole: vc, pretendToBeVisual: true,
  beforeParse(w) {
    w.fetch = (i, o) => fetch(typeof i === 'string' ? new URL(i, BASE).href : i, o);
    w.AbortController = AbortController; w.Headers = Headers;
    w.Request = Request; w.Response = Response;
  },
});
await new Promise(r => setTimeout(r, 1800));
const doc = dom.window.document;

console.log('\n── the banners render ──────────────────────────');
{
  const slides = doc.querySelectorAll('.hero__slide');
  t('all three banners are present', slides.length === 3, String(slides.length));
  t('each is marked as composed',
     doc.querySelectorAll('.hero__slide--composed').length === 3);
  t('the hero is flagged for banner layout',
     doc.querySelector('.hero').classList.contains('hero--composed'));
  t('one starts active', doc.querySelectorAll('.hero__slide.is-active').length === 1);
}

console.log('\n── no overlay collides with the artwork ────────');
{
  t('no scrim is drawn over them', doc.querySelectorAll('.hero__scrim').length === 0);
  t('no overlay headline is drawn', doc.querySelectorAll('.hero__copy').length === 0);
  t('no duplicate CTA pair is drawn', doc.querySelectorAll('.hero__cta').length === 0);
}

console.log('\n── each banner links somewhere useful ──────────');
{
  const links = Array.from(doc.querySelectorAll('.hero__banner'));
  t('every banner is a link', links.length === 3);
  t('each points at a collection',
     links.every(a => a.getAttribute('href').startsWith('collection.html')),
     links.map(a => a.getAttribute('href')).join(' | '));
  t('each has an accessible label',
     links.every(a => (a.getAttribute('aria-label') || '').length > 5));
  t('a real button exists for phones',
     doc.querySelectorAll('.hero__banner-cta').length === 3);
}

console.log('\n── images are served and sized for mobile ──────');
{
  const imgs = Array.from(doc.querySelectorAll('.hero__banner img'));
  t('each banner has an image', imgs.length === 3);
  t('each has descriptive alt text',
     imgs.every(i => (i.getAttribute('alt') || '').length > 15),
     imgs.map(i => (i.getAttribute('alt') || '').slice(0, 25)).join(' | '));
  t('the first is prioritised, the rest lazy',
     imgs[0].getAttribute('fetchpriority') === 'high' &&
     imgs[1].getAttribute('loading') === 'lazy');
  t('a smaller file is offered to phones',
     doc.querySelectorAll('.hero__banner source[media]').length === 3);

  for (const i of imgs) {
    const r = await fetch(BASE + '/' + i.getAttribute('src'));
    t(`${i.getAttribute('src').split('/').pop()} is served`, r.status === 200);
    const kb = Number(r.headers.get('content-length') || 0) / 1024;
    t(`  and is under 250KB (${Math.round(kb)}KB)`, kb > 0 && kb < 250);
  }
}

console.log('\n── the carousel still works ────────────────────');
{
  const dots = doc.querySelectorAll('.hero__dot');
  t('a dot per banner', dots.length === 3);
  dots[2].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));
  t('clicking a dot switches banner',
     doc.querySelectorAll('.hero__slide')[2].classList.contains('is-active'));
  t('and only one is active', doc.querySelectorAll('.hero__slide.is-active').length === 1);
}

t('no script errors', errs.length === 0, errs.slice(0, 2).join(' | '));

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
