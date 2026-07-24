#!/usr/bin/env node
/**
 * Aurelle — stock media fetcher.
 * ---------------------------------------------------------------------------
 * Downloads licence-free jewellery photography (and optionally a hero video)
 * into assets/img/stock + assets/video, then rewrites the REMOTE map in
 * assets/js/media.js so the site starts using them.
 *
 * Both providers below are free and permit commercial use. You supply your
 * own key — we do not ship one, and we do not scrape anyone's storefront.
 *
 *   Pexels    https://www.pexels.com/api/           (recommended: photos + video)
 *   Unsplash  https://unsplash.com/developers        (photos only)
 *
 * Usage:
 *   PEXELS_API_KEY=xxx node tools/fetch-media.mjs
 *   PEXELS_API_KEY=xxx node tools/fetch-media.mjs --video
 *   UNSPLASH_ACCESS_KEY=xxx node tools/fetch-media.mjs --provider unsplash
 *
 * Attribution: Pexels and Unsplash do not require it, but both ask for it.
 * Every credit is written to assets/img/stock/CREDITS.json — keep that file.
 * ---------------------------------------------------------------------------
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT     = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR  = resolve(ROOT, 'assets/img/stock');
const VID_DIR  = resolve(ROOT, 'assets/video');
const MEDIA_JS = resolve(ROOT, 'assets/js/media.js');

const args     = process.argv.slice(2);
const wantVideo = args.includes('--video');
const provider = (args[args.indexOf('--provider') + 1] || 'pexels').toLowerCase();

const PEXELS   = process.env.PEXELS_API_KEY;
const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY;

/* Which local asset gets which search term. Keys are the filenames used
   throughout the site — the REMOTE map is keyed by exactly these. */
const WANTED = [
  ['b-hero-01.svg',            'gold necklace model editorial'],
  ['b-hero-02.svg',            'gold earrings jewellery flatlay'],
  ['b-hero-03.svg',            'bridal jewellery indian'],
  ['b-editorial-bridal.svg',   'indian bridal jewellery'],
  ['b-editorial-everyday.svg', 'minimal gold jewellery'],
  ['b-editorial-journal.svg',  'jewellery styling flatlay'],
  ['b-story-atelier.svg',      'jewellery workshop craft hands'],
  ['b-store-front.svg',        'jewellery store interior'],
  ['cat-necklace-sets.svg',    'gold necklace'],
  ['cat-earrings.svg',         'gold earrings'],
  ['cat-rings.svg',            'gold ring jewellery'],
  ['cat-bracelets.svg',        'gold bracelet'],
  ['cat-chokers.svg',          'choker necklace'],
  ['cat-pendants.svg',         'pendant necklace'],
  ['cat-maang-tikka.svg',      'indian head jewellery'],
  ['cat-bangles.svg',          'gold bangles'],
];

const log = (...a) => console.log('[media]', ...a);

/* ------------------------------------------------------------ providers -- */
async function searchPexels(query) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`;
  const r = await fetch(url, { headers: { Authorization: PEXELS } });
  if (!r.ok) throw new Error(`Pexels ${r.status} ${r.statusText}`);
  const j = await r.json();
  const p = j.photos?.[0];
  if (!p) return null;
  return { url: p.src.large2x || p.src.large, credit: `${p.photographer} / Pexels`, link: p.url };
}

async function searchUnsplash(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`;
  const r = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH}` } });
  if (!r.ok) throw new Error(`Unsplash ${r.status} ${r.statusText}`);
  const j = await r.json();
  const p = j.results?.[0];
  if (!p) return null;
  return { url: p.urls.regular, credit: `${p.user.name} / Unsplash`, link: p.links.html };
}

async function searchPexelsVideo(query) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&size=medium`;
  const r = await fetch(url, { headers: { Authorization: PEXELS } });
  if (!r.ok) throw new Error(`Pexels video ${r.status}`);
  const j = await r.json();
  const v = j.videos?.[0];
  if (!v) return null;
  const file = v.video_files
    .filter(f => f.file_type === 'video/mp4' && f.width <= 1920)
    .sort((a, b) => b.width - a.width)[0];
  return file ? { url: file.link, credit: `${v.user.name} / Pexels`, link: v.url } : null;
}

/* ---------------------------------------------------------------- utils -- */
async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ----------------------------------------------------------------- main -- */
async function main() {
  const search = provider === 'unsplash' ? searchUnsplash : searchPexels;
  const key    = provider === 'unsplash' ? UNSPLASH : PEXELS;

  if (!key) {
    console.error(
      `\nNo API key found.\n\n` +
      `  Pexels:   PEXELS_API_KEY=xxx node tools/fetch-media.mjs\n` +
      `  Unsplash: UNSPLASH_ACCESS_KEY=xxx node tools/fetch-media.mjs --provider unsplash\n\n` +
      `Both are free. Until then the site runs on its own generated artwork,\n` +
      `which is already complete — this step is purely an upgrade.\n`);
    process.exit(1);
  }

  await mkdir(IMG_DIR, { recursive: true });
  await mkdir(VID_DIR, { recursive: true });

  const remote  = {};
  const credits = [];

  for (const [localName, query] of WANTED) {
    try {
      const hit = await search(query);
      if (!hit) { log(`no result for "${query}" — keeping generated art`); continue; }
      const outName = localName.replace(/\.svg$/, '.jpg');
      await download(hit.url, resolve(IMG_DIR, outName));
      remote[localName] = `assets/img/stock/${outName}`;
      credits.push({ file: outName, query, credit: hit.credit, source: hit.link });
      log(`✓ ${outName}  (${hit.credit})`);
      await sleep(350); // stay polite with the rate limit
    } catch (e) {
      log(`× ${localName}: ${e.message} — keeping generated art`);
    }
  }

  let videoLine = 'null';
  if (wantVideo) {
    if (provider !== 'pexels') log('video requires --provider pexels; skipping');
    else {
      try {
        const v = await searchPexelsVideo('jewellery model slow motion');
        if (v) {
          await download(v.url, resolve(VID_DIR, 'hero.mp4'));
          videoLine = `'assets/video/hero.mp4'`;
          credits.push({ file: 'hero.mp4', query: 'hero video', credit: v.credit, source: v.link });
          log(`✓ hero.mp4  (${v.credit})`);
        }
      } catch (e) { log(`× hero video: ${e.message}`); }
    }
  }

  await writeFile(resolve(IMG_DIR, 'CREDITS.json'), JSON.stringify(credits, null, 2));

  /* Rewrite media.js: flip SOURCE, fill REMOTE, set the video slot. */
  let js = await readFile(MEDIA_JS, 'utf8');
  js = js.replace(/const SOURCE = '[^']*';/, `const SOURCE = 'remote';`);
  js = js.replace(
    /const REMOTE = \{[\s\S]*?\n  \};/,
    'const REMOTE = ' + JSON.stringify(remote, null, 4).replace(/\n/g, '\n  ') + ';'
  );
  if (videoLine !== 'null') {
    js = js.replace(/hero: [^,]*,/, `hero: ${videoLine},`);
  }
  await writeFile(MEDIA_JS, js);

  log(`\ndone — ${Object.keys(remote).length} images wired into media.js`);
  log(`credits written to assets/img/stock/CREDITS.json`);
  log(`revert any time by setting SOURCE back to 'local' in assets/js/media.js`);
}

main().catch(e => { console.error(e); process.exit(1); });
