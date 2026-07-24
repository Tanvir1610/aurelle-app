/* ============================================================
   AURELLE — MEDIA REGISTRY
   ------------------------------------------------------------
   Every image and video on the site resolves through here, so
   swapping the generated artwork for real photography is a
   one-file change.

   Two sources:
     'local'  (default) — the generated SVG artwork in assets/img.
                          Ships working, offline, zero licences.
     'remote' — whatever you put in REMOTE below: your own CDN,
                or licensed stock pulled by tools/fetch-media.mjs.

   Any image that fails to load silently falls back to local art,
   so a dead CDN never leaves a broken tile on the page.
   ============================================================ */
window.AU_MEDIA = (function () {

  // Flip to 'remote' once REMOTE below is populated.
  const SOURCE = 'local';

  /* Fill these with your own hosted URLs, or let
     `node tools/fetch-media.mjs` populate assets/img/stock and
     rewrite this block for you. Keys match the local filenames. */
  const REMOTE = {
    // 'b-hero-01.svg': 'https://cdn.example.com/aurelle/hero-01.jpg',
    // 'p-rosevine-necklace-set.svg': 'https://cdn.example.com/aurelle/rosevine.jpg',
  };

  /* Hero video slot. Leave null to run the still-image hero.
     Point it at your own MP4 (self-hosted or CDN) to enable
     the motion hero — the poster stays as the fallback frame. */
  const VIDEO = {
    hero: null, // e.g. 'assets/video/hero.mp4'
    poster: 'assets/img/b-hero-01.svg',
  };

  function keyOf(path) {
    return String(path || '').split('/').pop();
  }

  /** Resolve a logical asset path to the URL that should be requested. */
  function src(path) {
    if (!path) return '';
    if (SOURCE === 'remote') {
      const hit = REMOTE[keyOf(path)];
      if (hit) return hit;
    }
    return path;
  }

  /** Local fallback for a given path — always the generated art. */
  function fallback(path) {
    return path;
  }

  /**
   * Build an <img> markup string with lazy loading and an inline
   * onerror that reverts to the local generated artwork.
   */
  function img(path, alt, opts) {
    const o = opts || {};
    const cls = o.class ? ` class="${o.class}"` : '';
    const eager = o.eager ? 'eager' : 'lazy';
    const fb = fallback(path);
    const onerr = `this.onerror=null;this.src='${fb}'`;
    const size = o.width ? ` width="${o.width}" height="${o.height || o.width}"` : '';
    return `<img src="${src(path)}"${cls} alt="${String(alt || '').replace(/"/g, '&quot;')}"` +
           ` loading="${eager}" decoding="async"${size} onerror="${onerr}">`;
  }

  /** Hero media block — video when configured, still image otherwise. */
  function heroMedia(slide) {
    if (VIDEO.hero && slide.video !== false) {
      return `<video autoplay muted loop playsinline poster="${VIDEO.poster}">` +
             `<source src="${VIDEO.hero}" type="video/mp4"></video>`;
    }
    return img(slide.img, '', { eager: true });
  }

  return { SOURCE, REMOTE, VIDEO, src, img, heroMedia };
})();
