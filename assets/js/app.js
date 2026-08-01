/* ============================================================
   AURELLE — PAGE CONTROLLERS
   Each page sets <body data-page="..."> and this file paints it.
   Data comes from AU_DATA today; point these at fetch() calls
   when the API is live and nothing else has to change.
   ============================================================ */
(function () {
  const { $, $$, inr, pctOff, esc, param, mq, icon, stars, productCard, grid, toast } = window.AU;
  const D = window.AU_DATA;
  const M = window.AU_MEDIA;
  const C = window.AU_CART;

  /* ================================================== HOME ====== */
  function home() {
    /* hero carousel */
    const slides = $('#heroSlides');
    if (slides) {
      // Composed banners need a different frame from overlay-text heroes.
      if (D.hero.every(h => h.composed)) $('.hero')?.classList.add('hero--composed');
      slides.innerHTML = D.hero.map((s, i) => {
        /* Composed banners carry their own headline and call to action, so
           they render clean — a scrim or overlay would sit on top of the
           artwork's own text. The whole banner becomes the link, with a real
           button underneath on small screens where the baked-in one is tiny. */
        if (s.composed) {
          return `
            <div class="hero__slide hero__slide--composed${i === 0 ? ' is-active' : ''}">
              <a class="hero__banner" href="${s.href}" aria-label="${esc(s.label)}">
                <picture>
                  <source media="(max-width: 700px)" srcset="${esc(s.imgSmall || s.img)}">
                  <img src="${esc(s.img)}" alt="${esc(s.alt)}"
                       ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
                </picture>
              </a>
              <a class="btn btn--gold hero__banner-cta" href="${s.href}">${esc(s.label)}</a>
            </div>`;
        }

        return `
          <div class="hero__slide${i === 0 ? ' is-active' : ''}">
            <div class="hero__media">${M.heroMedia(s)}</div>
            <div class="hero__scrim"></div>
            <div class="hero__body"><div class="container">
              <div class="hero__copy">
                <p class="eyebrow">${esc(s.eyebrow)}</p>
                <h1>${esc(s.title)}</h1>
                <p>${esc(s.body)}</p>
                <div class="hero__cta">
                  <a class="btn btn--gold" href="${s.cta.href}">${esc(s.cta.label)}</a>
                  <a class="btn btn--light" href="${s.cta2.href}">${esc(s.cta2.label)}</a>
                </div>
              </div>
            </div></div>
          </div>`;
      }).join('');

      const dots = $('#heroDots');
      dots.innerHTML = D.hero.map((s, i) =>
        `<button class="hero__dot${i === 0 ? ' is-active' : ''}" type="button" data-slide="${i}"
                 aria-label="Slide ${i + 1}: ${esc(s.label || s.eyebrow || '')}"></button>`).join('');

      let idx = 0, timer;
      const go = (n) => {
        idx = (n + D.hero.length) % D.hero.length;
        $$('.hero__slide').forEach((el, i) => el.classList.toggle('is-active', i === idx));
        $$('.hero__dot').forEach((el, i) => el.classList.toggle('is-active', i === idx));
      };
      const start = () => { timer = setInterval(() => go(idx + 1), 6500); };
      const stop = () => clearInterval(timer);
      dots.addEventListener('click', e => {
        const b = e.target.closest('[data-slide]');
        if (b) { stop(); go(Number(b.dataset.slide)); start(); }
      });
      const heroEl = $('.hero');
      heroEl.addEventListener('mouseenter', stop);
      heroEl.addEventListener('mouseleave', start);
      if (!mq('(prefers-reduced-motion: reduce)')) start();
    }

    /* USP strip */
    const usp = $('#uspStrip');
    if (usp) usp.innerHTML = D.usps.map(u => `
      <div class="usp__item">${icon(u.icon, 26)}
        <div><strong>${esc(u.title)}</strong><span>${esc(u.sub)}</span></div>
      </div>`).join('');

    /* categories */
    const cats = $('#catGrid');
    if (cats) cats.innerHTML = D.categories.map(c => `
      <a class="cat-tile" href="collection.html?cat=${encodeURIComponent(c.label)}">
        <div class="cat-tile__img">${M.img(c.img, c.label)}</div>
        <h3>${esc(c.label)}</h3><span>${c.count} pieces</span>
      </a>`).join('');

    /* rails */
    const byNew = D.products.filter(p => p.badge === 'New').concat(D.products.slice(12)).slice(0, 4);
    const best  = D.products.filter(p => p.badge === 'Bestseller').slice(0, 4);
    const rose  = D.products.filter(p => p.metal === 'Rose Gold').slice(0, 4);
    $('#railNew')  && ($('#railNew').innerHTML  = byNew.map(productCard).join(''));
    $('#railBest') && ($('#railBest').innerHTML = best.map(productCard).join(''));
    $('#railRose') && ($('#railRose').innerHTML = rose.map(productCard).join(''));

    /* collections + budget tiles */
    const col = $('#collectionTiles');
    if (col) col.innerHTML = D.collections.map(c => `
      <a class="tile" href="${c.href}">
        ${M.img(c.img, c.label)}<div class="tile__scrim"></div>
        <div class="tile__body"><span>${esc(c.sub)}</span><h3>${esc(c.label)}</h3></div>
      </a>`).join('');

    const bud = $('#budgetTiles');
    if (bud) bud.innerHTML = D.budget.map(b => `
      <a class="budget-tile" href="${b.href}">
        ${M.img(b.img, b.label)}
        <span class="budget-tile__label"><span>${esc(b.sub)}</span><strong>${esc(b.label)}</strong></span>
      </a>`).join('');

    /* reviews */
    const rev = $('#reviewGrid');
    if (rev) rev.innerHTML = D.reviews.slice(0, 3).map(r => `
      <blockquote class="review">
        ${stars(r.stars)}
        <p class="review__quote">${esc(r.quote)}</p>
        <footer class="review__who">
          ${M.img(r.avatar, r.name, { width: 40 })}
          <span><strong>${esc(r.name)}</strong><span>${esc(r.place)} · ${esc(r.product)}</span></span>
        </footer>
      </blockquote>`).join('');

    /* store preview */
    const st = $('#storePreview');
    if (st) st.innerHTML = D.stores.slice(0, 3).map(s => `
      <article class="store">
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.addr)}</p>
        <dl><dt>Hours</dt><dd>${esc(s.hours)}</dd><dt>Call</dt><dd>${esc(s.phone)}</dd></dl>
      </article>`).join('');

    window.AU.reveal();
  }

  /* ============================================ COLLECTION (PLP) === */
  const PAGE_SIZE = 9;

  function collection() {
    const F = D.facets || {};
    const BANDS = D.priceBands || [];

    const state = {
      cat: param('cat') || null,
      style: param('style') ? [param('style')] : [],
      shape: [], occasion: param('occasion') ? [param('occasion')] : [],
      color: [], length: [], feature: [],
      band: null,
      max: param('max') ? Number(param('max')) : null,
      sale: param('sale') === '1',
      q: param('q') || '',
      sort: param('sort') || 'featured',
      page: 1,
    };

    const GROUPS = [
      ['style', 'Style', p => [p.style]],
      ['shape', 'Shape', p => [p.shape]],
      ['occasion', 'Occasion', p => p.occasion || []],
      ['color', 'Colour', p => [p.color]],
      ['length', 'Length', p => [p.length]],
      ['feature', 'Features', p => p.features || []],
    ];

    const valuesOf = (p, key) => (GROUPS.find(g => g[0] === key)[2](p) || []).filter(Boolean);

    function match(p) {
      if (state.cat && p.subcat !== state.cat && p.cat !== state.cat) return false;
      for (const [key] of GROUPS) {
        if (state[key].length && !valuesOf(p, key).some(v => state[key].includes(v))) return false;
      }
      if (state.band && !(p.price >= state.band.min && p.price < state.band.max)) return false;
      if (state.max && p.price > state.max) return false;
      if (state.sale && !(p.mrp > p.price)) return false;
      if (state.q) {
        const hay = [p.name, p.cat, p.subcat, p.style, p.shape, p.color,
                     p.blurb, ...(p.features || []), ...(p.occasion || [])]
                     .filter(Boolean).join(' ').toLowerCase();
        if (!state.q.toLowerCase().split(/\s+/).every(w => hay.includes(w))) return false;
      }
      return true;
    }

    function sorted(list) {
      const l = list.slice();
      if (state.sort === 'low') l.sort((a, b) => a.price - b.price);
      else if (state.sort === 'high') l.sort((a, b) => b.price - a.price);
      else if (state.sort === 'new') l.sort((a, b) => (b.badge === 'New') - (a.badge === 'New'));
      else if (state.sort === 'popular') l.sort((a, b) => b.reviews - a.reviews);
      else if (state.sort === 'rating') l.sort((a, b) => b.rating - a.rating);
      return l;
    }

    /* Counts reflect the other active filters, so a facet never leads to
       an empty result. */
    function countFor(key, value) {
      const saved = state[key];
      state[key] = [value];
      const n = D.products.filter(match).length;
      state[key] = saved;
      return n;
    }

    function renderFilters() {
      const cats = (D.categories || []).filter(c => c.active !== false);
      let html = `
        <div class="filter-group">
          <h4>Category</h4>
          <label class="filter-opt">
            <input type="radio" name="cat" data-cat="" ${!state.cat ? 'checked' : ''}>
            <span>All necklaces</span><em>${D.products.length}</em></label>
          ${cats.map(c => {
            const n = D.products.filter(p => p.subcat === c.label || p.cat === c.label).length;
            return `<label class="filter-opt">
              <input type="radio" name="cat" data-cat="${esc(c.label)}"
                     ${state.cat === c.label ? 'checked' : ''}>
              <span>${esc(c.label)}</span><em>${n}</em></label>`;
          }).join('')}
        </div>

        <div class="filter-group">
          <h4>Price</h4>
          <label class="filter-opt">
            <input type="radio" name="band" data-band="" ${!state.band ? 'checked' : ''}>
            <span>Any price</span><em>${D.products.length}</em></label>
          ${BANDS.map((b, i) => `<label class="filter-opt">
            <input type="radio" name="band" data-band="${i}"
                   ${state.band === b ? 'checked' : ''}>
            <span>${esc(b.label)}</span>
            <em>${D.products.filter(p => p.price >= b.min && p.price < b.max).length}</em>
          </label>`).join('')}
        </div>`;

      for (const [key, title] of GROUPS) {
        const opts = F[key] || [];
        if (!opts.length) continue;
        html += `<div class="filter-group"><h4>${esc(title)}</h4>
          ${opts.map(v => {
            const n = countFor(key, v);
            return `<label class="filter-opt${n ? '' : ' is-empty'}">
              <input type="checkbox" data-group="${key}" value="${esc(v)}"
                     ${state[key].includes(v) ? 'checked' : ''} ${n ? '' : 'disabled'}>
              <span>${esc(v)}</span><em>${n}</em></label>`;
          }).join('')}
        </div>`;
      }
      $('#filters').innerHTML = html;
    }

    function renderChips() {
      const chips = [];
      if (state.cat) chips.push(['cat', state.cat]);
      for (const [key] of GROUPS) state[key].forEach(v => chips.push([key, v]));
      if (state.band) chips.push(['band', state.band.label]);
      if (state.sale) chips.push(['sale', 'On sale']);
      if (state.q) chips.push(['q', `“${state.q}”`]);

      $('#activeChips').innerHTML = chips.length
        ? chips.map(([g, v]) =>
            `<button class="chip" type="button" data-clear="${g}" data-val="${esc(v)}">
               ${esc(v)} ${icon('x', 12)}</button>`).join('') +
          `<button class="chip" type="button" data-clear="all">Clear all</button>`
        : '';
    }

    function render() {
      const filtered = sorted(D.products.filter(match));
      const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      state.page = Math.min(state.page, pages);
      const slice = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

      $('#plpCount').textContent = filtered.length === 1 ? '1 piece' : `${filtered.length} pieces`;
      renderChips();

      $('#plpGrid').innerHTML = slice.length
        ? `<div class="product-grid product-grid--3">${slice.map(productCard).join('')}</div>`
        : `<div class="empty"><h3>Nothing matches those filters</h3>
             <p>Try removing one, or clear them and start again.</p>
             <button class="btn btn--ghost" type="button" data-clear="all">Clear all filters</button>
           </div>`;

      $('#plpPager').innerHTML = pages > 1 ? `
        <button type="button" data-page="${state.page - 1}"${state.page === 1 ? ' disabled' : ''}>Prev</button>
        ${Array.from({ length: pages }, (_, i) =>
          `<button type="button" data-page="${i + 1}" class="${state.page === i + 1 ? 'is-active' : ''}">${i + 1}</button>`).join('')}
        <button type="button" data-page="${state.page + 1}"${state.page === pages ? ' disabled' : ''}>Next</button>` : '';
    }

    const title = state.cat || (state.sale ? 'The Aurelle sale'
      : state.style[0] ? `${state.style[0]} necklaces`
      : state.occasion[0] ? `${state.occasion[0]} edit`
      : 'American diamond necklaces');
    $('#plpTitle').textContent = title;
    $('#plpCrumb').textContent = title;

    /* ------------------------------------ category chips (phones) -- */
    function renderCatChips() {
      const host = $('#catChips');
      if (!host) return;
      const cats = (D.categories || []).filter(c => c.active !== false);
      const total = D.products.length;
      host.innerHTML =
        `<button type="button" class="cat-chip${!state.cat ? ' is-active' : ''}" data-chip="">
           All <em>(${total})</em></button>` +
        cats.map(c => {
          const n = D.products.filter(p => p.subcat === c.label || p.cat === c.label).length;
          if (!n) return '';
          return `<button type="button" class="cat-chip${state.cat === c.label ? ' is-active' : ''}"
                    data-chip="${esc(c.label)}">${esc(c.label)} <em>(${n})</em></button>`;
        }).join('');
    }

    $('#catChips')?.addEventListener('click', e => {
      const b = e.target.closest('[data-chip]');
      if (!b) return;
      state.cat = b.dataset.chip || null;
      state.page = 1;
      renderCatChips(); renderFilters(); render();
      window.scrollTo({ top: $('#plpTop').offsetTop - 80, behavior: 'smooth' });
    });

    /* ---------------------------------------- filter sheet (phones) -- */
    const sheet = $('#filterSheet');
    const setSheet = (open) => {
      sheet?.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    $('#openFilters')?.addEventListener('click', () => setSheet(true));
    $('#closeFilters')?.addEventListener('click', () => setSheet(false));
    $('#applyFilters')?.addEventListener('click', () => setSheet(false));

    /** How many facets are active, shown beside the Filter button. */
    function updateFilterCount() {
      const n = GROUPS.reduce((a, [k]) => a + state[k].length, 0) +
                (state.band ? 1 : 0) + (state.cat ? 1 : 0);
      const el = $('#filterCount');
      if (el) el.textContent = n ? `(${n})` : '';
    }

    const sortMobile = $('#plpSortMobile');
    sortMobile?.addEventListener('change', e => {
      state.sort = e.target.value;
      $('#plpSort').value = e.target.value;
      state.page = 1;
      render();
    });

    renderCatChips();
    renderFilters();
    render();
    updateFilterCount();

    $('#plpSort').value = state.sort;
    $('#plpSort').addEventListener('change', e => {
      state.sort = e.target.value; state.page = 1; render();
    });

    /* ---------------------------------------- search with suggestions -- */
    const search = $('#plpSearch');
    const sugg = $('#searchSuggest');

    function suggestionsFor(q) {
      const term = q.toLowerCase().trim();
      if (!term) return [];
      const out = [];
      (D.searchTerms || []).forEach(t => {
        if (t.toLowerCase().includes(term)) out.push({ kind: 'Search', label: t, apply: () => { state.q = t; } });
      });
      (D.categories || []).forEach(c => {
        if (c.label.toLowerCase().includes(term))
          out.push({ kind: 'Category', label: c.label, apply: () => { state.cat = c.label; state.q = ''; } });
      });
      for (const [key, title] of GROUPS) {
        (F[key] || []).forEach(v => {
          if (v.toLowerCase().includes(term))
            out.push({ kind: title, label: v, apply: () => { state[key] = [v]; state.q = ''; } });
        });
      }
      D.products.forEach(p => {
        if (p.name.toLowerCase().includes(term))
          out.push({ kind: 'Product', label: p.name, href: `product.html?p=${p.slug}` });
      });
      return out.slice(0, 8);
    }

    let current = [];
    function paintSuggestions(q) {
      current = suggestionsFor(q);
      if (!current.length) { sugg.hidden = true; sugg.innerHTML = ''; return; }
      sugg.hidden = false;
      sugg.innerHTML = current.map((s, i) => `
        <button type="button" class="suggest__row" data-sugg="${i}">
          <span class="suggest__kind">${esc(s.kind)}</span>
          <span>${esc(s.label)}</span>
        </button>`).join('');
    }

    search.addEventListener('input', e => {
      state.q = e.target.value;
      state.page = 1;
      paintSuggestions(e.target.value);
      render();
    });
    search.addEventListener('focus', e => paintSuggestions(e.target.value));
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-wrap')) sugg.hidden = true;
    });
    sugg.addEventListener('click', e => {
      const b = e.target.closest('[data-sugg]');
      if (!b) return;
      const pick = current[Number(b.dataset.sugg)];
      if (pick.href) { location.href = pick.href; return; }
      pick.apply();
      search.value = state.q;
      sugg.hidden = true;
      state.page = 1;
      renderFilters(); render();
    });

    /* ------------------------------------------------------ facets -- */
    $('#filters').addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.cat !== undefined) {
        state.cat = el.dataset.cat || null;
      } else if (el.dataset.band !== undefined) {
        state.band = el.dataset.band === '' ? null : BANDS[Number(el.dataset.band)];
      } else if (el.dataset.group) {
        const g = el.dataset.group;
        const set = new Set(state[g]);
        el.checked ? set.add(el.value) : set.delete(el.value);
        state[g] = [...set];
      } else return;
      state.page = 1;
      renderFilters(); render();
      renderCatChips(); updateFilterCount();
    });

    document.addEventListener('click', e => {
      const clear = e.target.closest('[data-clear]');
      if (clear) {
        const g = clear.dataset.clear;
        if (g === 'all') {
          state.cat = null; state.band = null; state.max = null;
          state.sale = false; state.q = '';
          GROUPS.forEach(([k]) => { state[k] = []; });
          if (search) search.value = '';
        } else if (g === 'cat') state.cat = null;
        else if (g === 'band') state.band = null;
        else if (g === 'sale') state.sale = false;
        else if (g === 'q') { state.q = ''; if (search) search.value = ''; }
        else state[g] = state[g].filter(v => v !== clear.dataset.val);
        state.page = 1;
        renderFilters(); render();
        renderCatChips(); updateFilterCount();
        return;
      }
      const pg = e.target.closest('[data-page]');
      if (pg && !pg.disabled) {
        state.page = Number(pg.dataset.page);
        render();
        window.scrollTo({ top: $('#plpTop').offsetTop - 100, behavior: 'smooth' });
      }
    });
  }

  /* =================================================== PRODUCT === */
  function product() {
    const slug = param('p') || D.products[0].slug;
    const p = D.products.find(x => x.slug === slug) || D.products[0];
    document.title = `${p.name} — Aurelle`;

    // Gallery URLs when the admin supplied them, otherwise the two card angles.
    const imgs = (Array.isArray(p.gallery) && p.gallery.length)
      ? [p.img, ...p.gallery].filter(Boolean)
      : [p.img, p.imgAlt].filter(Boolean);
    let finish = p.swatches[0].label;
    let qty = 1;

    $('#pdpCrumbCat').textContent = p.cat;
    $('#pdpCrumbCat').href = `collection.html?cat=${encodeURIComponent(p.cat)}`;
    $('#pdpCrumbName').textContent = p.name;

    $('#pdpGallery').innerHTML = `
      <div class="gallery__thumbs">
        ${imgs.map((src, i) => `<button class="gallery__thumb${i === 0 ? ' is-active' : ''}" type="button" data-img="${i}">
          ${M.img(src, `${p.name} view ${i + 1}`)}</button>`).join('')}
      </div>
      <div class="gallery__main" id="galleryMain">${M.img(imgs[0], p.name, { eager: true })}</div>`;

    $('#pdpGallery').addEventListener('click', e => {
      const b = e.target.closest('[data-img]');
      if (!b) return;
      $$('.gallery__thumb').forEach(t => t.classList.remove('is-active'));
      b.classList.add('is-active');
      $('#galleryMain').innerHTML = M.img(imgs[Number(b.dataset.img)], p.name, { eager: true });
    });

    const off = pctOff(p.price, p.mrp);
    $('#pdpInfo').innerHTML = `
      <p class="eyebrow">${esc(p.cat)}</p>
      <h1>${esc(p.name)}</h1>
      <div class="pdp__meta">
        <span class="rating">${stars(p.rating)} ${p.rating.toFixed(1)} · ${p.reviews} reviews</span>
        <span class="muted" style="font-size:var(--fs-xs)">SKU AUR-${p.slug.slice(0, 4).toUpperCase()}-${p.price}</span>
      </div>
      <p class="muted" style="margin-top:var(--space-4);line-height:var(--lh-relaxed)">${esc(p.blurb)}</p>
      <div class="pdp__price">
        <div class="price">
          <span class="price__now">${inr(p.price)}</span>
          <span class="price__was">${inr(p.mrp)}</span>
          <span class="price__off">${off}% off</span>
        </div>
        <p class="pdp__tax">Inclusive of all taxes · Free shipping over ${inr(C.FREE_SHIP_AT)}</p>
      </div>

      <div class="pdp__field">
        <label>Finish — <span id="finishLabel">${esc(finish)}</span></label>
        <div class="pdp__swatches" id="pdpSwatches">
          ${p.swatches.map((s, i) => `<button class="swatch" type="button" style="background:${s.color}"
             data-finish="${esc(s.label)}" aria-pressed="${i === 0}" aria-label="${esc(s.label)}"></button>`).join('')}
        </div>
      </div>

      <div class="pdp__field">
        <label>Quantity</label>
        <div class="stepper">
          <button type="button" id="qtyDown" aria-label="Decrease quantity">−</button>
          <span id="qtyVal">1</span>
          <button type="button" id="qtyUp" aria-label="Increase quantity">+</button>
        </div>
      </div>

      <div class="pdp__buy">
        <button class="btn btn--primary" type="button" id="pdpAdd">Add to bag</button>
        <button class="btn btn--gold" type="button" id="pdpBuy">Buy it now</button>
      </div>

      <div class="accordion">
        <div class="accordion__item is-open">
          <button class="accordion__head" type="button"><span>Details</span><span>+</span></button>
          <div class="accordion__panel">
            <table class="spec-table">
              <tr><td>Base metal</td><td>Brass, nickel &amp; lead free</td></tr>
              <tr><td>Plating</td><td>24Kt gold-plated, anti-tarnish sealed</td></tr>
              <tr><td>Finish</td><td>${esc(p.metal)}</td></tr>
              <tr><td>Category</td><td>${esc(p.cat)}</td></tr>
              <tr><td>Warranty</td><td>6 months on plating &amp; setting</td></tr>
              <tr><td>Ships in</td><td>2–4 working days (metros)</td></tr>
            </table>
          </div>
        </div>
        <div class="accordion__item">
          <button class="accordion__head" type="button"><span>Care</span><span>+</span></button>
          <div class="accordion__panel">
            Put it on last when you dress, take it off first when you get home. Keep it away from perfume, chlorine and cleaning products, and store it in the pouch it arrived in so nothing scratches against it.
            <ul><li>Wipe with a dry, soft cloth after wear</li><li>Never soak or submerge</li><li>Remove before swimming, showering or the gym</li></ul>
          </div>
        </div>
        <div class="accordion__item">
          <button class="accordion__head" type="button"><span>Shipping &amp; returns</span><span>+</span></button>
          <div class="accordion__panel">
            Free shipping over ${inr(C.FREE_SHIP_AT)}, flat ₹79 below that. Metro delivery in 2–4 working days, elsewhere 4–7. Returns and exchanges accepted within 7 days of delivery, unworn and in the box, with free pickup in serviceable pincodes.
          </div>
        </div>
      </div>`;

    /* interactions */
    $('#pdpSwatches').addEventListener('click', e => {
      const b = e.target.closest('[data-finish]');
      if (!b) return;
      $$('#pdpSwatches .swatch').forEach(s => s.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      finish = b.dataset.finish;
      $('#finishLabel').textContent = finish;
    });

    $('#qtyUp').addEventListener('click', () => { qty++; $('#qtyVal').textContent = qty; });
    $('#qtyDown').addEventListener('click', () => { qty = Math.max(1, qty - 1); $('#qtyVal').textContent = qty; });

    $('#pdpAdd').addEventListener('click', () => {
      C.add(p.slug, qty, finish);
      toast(`${p.name} added to your bag`);
      window.AU.openCart();
    });
    $('#pdpBuy').addEventListener('click', () => {
      C.add(p.slug, qty, finish);
      location.href = 'checkout.html';
    });

    $('#pdpInfo').addEventListener('click', e => {
      const head = e.target.closest('.accordion__head');
      if (head) head.parentElement.classList.toggle('is-open');
    });

    /* ------------------------------------------- sticky buy bar (mobile) -- */
    /* The buy panel scrolls away on a phone, so mirror it in a fixed bar.
       It appears once the real one has left the viewport, which keeps the
       first screen clean. */
    (function stickyBuy() {
      const bar = document.createElement('div');
      bar.className = 'buybar';
      bar.innerHTML = `
        <div class="stepper">
          <button type="button" id="barDown" aria-label="Decrease quantity">−</button>
          <span id="barQty">1</span>
          <button type="button" id="barUp" aria-label="Increase quantity">+</button>
        </div>
        <div class="buybar__price">
          <strong>${inr(p.price)}</strong>
          <span>${p.mrp > p.price ? pctOff(p.price, p.mrp) + '% off' : 'incl. taxes'}</span>
        </div>
        <button class="btn btn--gold" type="button" id="barAdd">Add to bag</button>`;
      document.body.appendChild(bar);
      document.body.classList.add('has-buybar');

      // Keep the two quantity controls in step, either direction.
      const sync = (n) => {
        qty = Math.max(1, n);
        $('#qtyVal').textContent = qty;
        $('#barQty').textContent = qty;
      };
      $('#barUp').addEventListener('click', () => sync(qty + 1));
      $('#barDown').addEventListener('click', () => sync(qty - 1));
      $('#qtyUp').addEventListener('click', () => { $('#barQty').textContent = qty; });
      $('#qtyDown').addEventListener('click', () => { $('#barQty').textContent = qty; });

      $('#barAdd').addEventListener('click', () => {
        C.add(p.slug, qty, finish);
        toast(`${p.name} added to your bag`);
        window.AU.openCart();
      });

      const anchor = $('#pdpAdd');
      if (anchor && 'IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => {
          bar.classList.toggle('is-in', !e.isIntersecting);
        }, { rootMargin: '-10px 0px 0px 0px' }).observe(anchor);
      } else {
        bar.classList.add('is-in');
      }
    })();

    /* ---------------------------------------- sticky buy bar (phones) -- */
    const sticky = $('#pdpSticky');
    if (sticky) {
      $('#sPrice').textContent = inr(p.price);

      const syncQty = () => {
        $('#sQtyVal').textContent = qty;
        $('#qtyVal').textContent = qty;
        $('#sPrice').textContent = inr(p.price * qty);
      };
      $('#sQtyUp').addEventListener('click', () => { qty++; syncQty(); });
      $('#sQtyDown').addEventListener('click', () => { qty = Math.max(1, qty - 1); syncQty(); });
      $('#sAdd').addEventListener('click', () => {
        C.add(p.slug, qty, finish);
        toast(`${p.name} added to your bag`);
        window.AU.openCart();
      });

      // Appear once the main buy button has scrolled away, so the bar is
      // never a duplicate of what is already on screen.
      const anchor = $('#pdpAdd');
      if (anchor && 'IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => {
          sticky.classList.toggle('is-visible', !e.isIntersecting);
        }, { rootMargin: '-80px 0px 0px 0px' }).observe(anchor);
      } else {
        sticky.classList.add('is-visible');
      }
    }

    /* complete the look */
    const also = D.products.filter(x => x.slug !== p.slug && (x.cat === p.cat || x.metal === p.metal)).slice(0, 4);
    $('#pdpAlso').innerHTML = also.map(productCard).join('');

    /* product reviews */
    $('#pdpReviews').innerHTML = D.reviews.slice(0, 3).map(r => `
      <blockquote class="review">
        ${stars(r.stars)}
        <p class="review__quote">${esc(r.quote)}</p>
        <footer class="review__who">${M.img(r.avatar, r.name, { width: 40 })}
          <span><strong>${esc(r.name)}</strong><span>Verified buyer · ${esc(r.place)}</span></span></footer>
      </blockquote>`).join('');
  }

  /* ====================================================== CART === */
  function cartPage() {
    function paint(snap) {
      const body = $('#cartLines'), sum = $('#cartSummary');
      if (!snap.lines.length) {
        $('#cartWrap').innerHTML = `<div class="empty">
          <h3>Your bag is empty</h3>
          <p>Nothing here yet. Start with the pieces people buy most.</p>
          <a class="btn btn--primary" href="collection.html?sort=popular">Shop bestsellers</a>
        </div>`;
        return;
      }
      body.innerHTML = snap.lines.map(l => `
        <div class="line">
          ${M.img(l.product.img, l.product.name, { width: 76 })}
          <div>
            <a href="product.html?p=${encodeURIComponent(l.slug)}"><span class="line__name">${esc(l.product.name)}</span></a>
            <div class="line__variant">${esc(l.finish)} · ${esc(l.product.cat)}</div>
            <div class="stepper">
              <button type="button" data-qty="${esc(l.id)}" data-delta="-1" aria-label="Decrease quantity">−</button>
              <span>${l.qty}</span>
              <button type="button" data-qty="${esc(l.id)}" data-delta="1" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <div><div class="line__price">${inr(l.lineTotal)}</div>
            <button class="line__remove" type="button" data-remove="${esc(l.id)}">Remove</button></div>
        </div>`).join('');

      const t = snap.totals;
      sum.innerHTML = `
        <h3>Order summary</h3>
        <div class="totals">
          <div><span>Subtotal (${t.count} ${t.count === 1 ? 'item' : 'items'})</span><span>${inr(t.subtotal)}</span></div>
          ${t.saved > 0 ? `<div><span>You save</span><span style="color:var(--success)">− ${inr(t.saved)}</span></div>` : ''}
          <div><span>Shipping</span><span>${t.shipping === 0 ? 'Free' : inr(t.shipping)}</span></div>
          <div class="is-total"><span>Total</span><span>${inr(t.total)}</span></div>
        </div>
        <a class="btn btn--gold btn--block" href="checkout.html">Proceed to checkout</a>
        <a class="btn btn--ghost btn--block" href="collection.html" style="margin-top:var(--space-3)">Continue shopping</a>`;
    }
    document.addEventListener('au:cart', e => paint(e.detail));
    paint(C.snapshot());
  }

  /* ================================================== CHECKOUT === */
  const COD_FEE = 49;

  function checkout() {
    /* Cashfree presents its own list of methods once the shopper is handed
       over, so the only real choice here is online versus cash on delivery. */
    function paintPayNote() {
      const note = $('#payNote');
      if (!note) return;
      const cod = $('#pm').value === 'cod';
      note.innerHTML = cod
        ? `A ₹${COD_FEE} handling fee applies. Pay the courier when your parcel arrives.`
        : `You will be taken to our payment partner to complete this securely. ` +
          `Your card details never touch our servers.`;
      paintSummary(C.snapshot());
    }

    function paintSummary(snap) {
      const t = snap.totals;
      const cod = $('#pm') && $('#pm').value === 'cod';
      const fee = cod ? COD_FEE : 0;
      $('#coSummary').innerHTML = `
        <h3>Your order</h3>
        ${snap.lines.map(l => `
          <div class="line">
            ${M.img(l.product.img, l.product.name, { width: 76 })}
            <div><span class="line__name">${esc(l.product.name)}</span>
              <div class="line__variant">${esc(l.finish)} · Qty ${l.qty}</div></div>
            <div class="line__price">${inr(l.lineTotal)}</div>
          </div>`).join('')}
        <div class="totals" style="margin-top:var(--space-5)">
          <div><span>Subtotal</span><span>${inr(t.subtotal)}</span></div>
          <div><span>Shipping</span><span>${t.shipping === 0 ? 'Free' : inr(t.shipping)}</span></div>
          ${fee ? `<div><span>Cash on delivery fee</span><span>${inr(fee)}</span></div>` : ''}
          <div class="is-total"><span>Total</span><span>${inr(t.total + fee)}</span></div>
        </div>`;
    }
    document.addEventListener('au:cart', e => paintSummary(e.detail));
    paintSummary(C.snapshot());
    $('#pm')?.addEventListener('change', paintPayNote);
    paintPayNote();

    $('#coForm').addEventListener('submit', async e => {
      e.preventDefault();
      let ok = true;
      $$('#coForm [required]').forEach(input => {
        const field = input.closest('.field');
        const bad = !input.value.trim() ||
          (input.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.value)) ||
          (input.name === 'phone' && !/^[6-9]\d{9}$/.test(input.value.replace(/\D/g, ''))) ||
          (input.name === 'pincode' && !/^\d{6}$/.test(input.value.trim()));
        field.classList.toggle('field--error', bad);
        if (bad) ok = false;
      });
      if (!ok) { toast('Check the highlighted fields'); return; }
      const snap = C.snapshot();
      if (!snap.lines.length) { toast('Your bag is empty'); return; }

      const btn = $('#coForm button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Placing order…';

      const details = {
        firstName: $('#fn').value.trim(), lastName: $('#ln').value.trim(),
        email: $('#em').value.trim(), phone: $('#ph').value.replace(/\D/g, ''),
        address: $('#ad').value.trim(), city: $('#ct').value.trim(),
        pincode: $('#pc').value.trim(),
        payment: $('#pm').value === 'cod' ? 'Cash on delivery' : 'Online',
      };

      try {
        const order = await window.AU_API.createOrder(details, snap.lines);
        try { sessionStorage.setItem('aurelle.lastOrder', order.ref); } catch (err) {}

        /* Cash on delivery needs no gateway. Everything else goes to
           Cashfree, and the bag is only cleared once payment opens — a
           failed hand-off must leave the shopper's bag intact. */
        const payReady = await window.AU_API.ensurePayCfg?.() || {};
        if ($('#pm').value !== 'cod' && payReady.enabled) {
          btn.textContent = 'Opening payment…';
          const paid = await window.AU_API.startPayment(order.ref);
          if (!paid.ok) {
            btn.disabled = false;
            btn.textContent = 'Place order';
            // Show what actually went wrong — a bare "try again" tells the
            // shopper nothing and tells the shop owner less.
            const box = $('#payError');
            if (box) {
              box.innerHTML = `<strong>Payment could not be started.</strong><br>
                ${esc(paid.reason || 'Unknown error')}<br>
                Your order <strong>${esc(order.ref)}</strong> is saved — you can
                pay for it later from <a href="track-order.html">Track order</a>,
                or choose cash on delivery above.`;
              box.style.display = 'block';
              box.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            toast(paid.reason || 'Could not open the payment page');
            return;
          }
          return;   // Cashfree takes over the page from here
        }

        C.clear();
        location.href = `confirmation.html?ref=${order.ref}`;
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Place order';
        toast(err.message || 'Could not place the order. Try again.');
      }
    });
  }

  /* ============================================== CONFIRMATION === */
  function confirmation() {
    const ref = param('ref') || 'AUR000000';
    $('#confRef').textContent = ref;
    $('#confPicks').innerHTML = D.products
      .filter(p => p.badge === 'Bestseller').slice(0, 4).map(productCard).join('');

    /* Never take the redirect's word for it — ask our server, which asks
       the gateway. Until that answers, say nothing about payment. */
    const note = document.createElement('p');
    note.className = 'muted';
    note.style.cssText = 'margin-top:var(--space-4);font-size:var(--fs-sm)';
    $('#confRef').closest('p')?.after(note);

    (async () => {
      if (!window.AU_API.paymentsEnabled()) return;
      note.textContent = 'Confirming your payment…';
      try {
        const r = await window.AU_API.verifyPayment(ref);
        if (r.paid) {
          note.textContent = 'Payment received. We are packing your order now.';
          note.style.color = 'var(--success)';
          C.clear();
        } else {
          note.innerHTML = 'We have not seen a payment for this order yet. ' +
            'If you were charged it can take a minute to reach us — ' +
            '<a href="track-order.html">check the status</a>.';
        }
      } catch (e) {
        note.textContent = '';
      }
    })();
  }

  /* ================================================== WISHLIST === */
  function wishlist() {
    function paint(snap) {
      const list = D.products.filter(p => snap.wishlist.includes(p.slug));
      $('#wishGrid').innerHTML = list.length
        ? `<div class="product-grid">${list.map(productCard).join('')}</div>`
        : `<div class="empty"><h3>Nothing saved yet</h3>
             <p>Tap the heart on any piece and it will wait for you here.</p>
             <a class="btn btn--primary" href="collection.html">Browse jewellery</a></div>`;
    }
    document.addEventListener('au:cart', e => paint(e.detail));
    paint(C.snapshot());
  }

  /* ====================================================== FAQ ==== */
  function faq() {
    $('#faqList').innerHTML = D.faqs.map((f, i) => `
      <div class="accordion__item${i === 0 ? ' is-open' : ''}">
        <button class="accordion__head" type="button"><span>${esc(f.q)}</span><span>+</span></button>
        <div class="accordion__panel">${esc(f.a)}</div>
      </div>`).join('');
    $('#faqList').addEventListener('click', e => {
      const h = e.target.closest('.accordion__head');
      if (h) h.parentElement.classList.toggle('is-open');
    });
  }

  /* =================================================== STORES ==== */
  function stores() {
    const render = (list) => {
      $('#storeGrid').innerHTML = list.length ? list.map(s => `
        <article class="store">
          <p class="eyebrow">${esc(s.city)}</p>
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.addr)}</p>
          <dl><dt>Hours</dt><dd>${esc(s.hours)}</dd><dt>Call</dt><dd>${esc(s.phone)}</dd></dl>
          <a class="btn btn--ghost btn--sm" style="margin-top:var(--space-5)" href="contact.html">Book an appointment</a>
        </article>`).join('')
        : `<div class="empty"><h3>No stores in that city yet</h3><p>We ship everywhere in India, and new stores open every quarter.</p></div>`;
    };
    render(D.stores);
    $('#storeSearch').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      render(D.stores.filter(s => (s.city + s.name + s.addr).toLowerCase().includes(q)));
    });
  }

  /* ================================================== JOURNAL ==== */
  function journal() {
    $('#journalGrid').innerHTML = D.journal.map(j => `
      <a class="tile tile--wide" href="#">
        ${M.img(j.img, j.title)}<div class="tile__scrim"></div>
        <div class="tile__body"><span>${esc(j.kicker)} · ${esc(j.read)}</span><h3>${esc(j.title)}</h3></div>
      </a>`).join('');
    $('#journalList').innerHTML = D.journal.map(j => `
      <article style="padding-block:var(--space-6);border-bottom:1px solid var(--border)">
        <p class="eyebrow">${esc(j.kicker)} · ${esc(j.read)} read</p>
        <h3 style="font-size:var(--fs-h3)">${esc(j.title)}</h3>
        <p class="muted" style="margin-top:var(--space-3)">${esc(j.excerpt)}</p>
      </article>`).join('');
  }

  /* =============================================== TRACK ORDER === */
  function track() {
    $('#trackForm').addEventListener('submit', async e => {
      e.preventDefault();
      const ref = $('#trackRef').value.trim().toUpperCase();
      if (!/^AUR\d{6}$/.test(ref)) { toast('Order IDs look like AUR123456'); return; }

      const out = $('#trackResult');
      out.innerHTML = '<p class="muted center">Looking that up…</p>';

      const LABELS = { placed: 'Order placed', packed: 'Packed at our warehouse',
                       shipped: 'In transit', delivered: 'Delivered' };
      try {
        const o = await window.AU_API.trackOrder(ref);
        if (!o) {
          out.innerHTML = `<div class="panel"><h3>Tracking needs the server</h3>
            <p class="muted">Start the backend and this pulls the real status.</p></div>`;
          return;
        }
        out.innerHTML = `
          <div class="panel">
            <p class="eyebrow">Order ${esc(o.ref)}</p>
            <h3>${esc(o.status === 'cancelled' ? 'Order cancelled' : LABELS[o.status] || o.status)}</h3>
            <p class="muted" style="font-size:var(--fs-sm);margin-top:var(--space-2)">
              ${o.items.map(i => `${esc(i.name)} × ${i.qty}`).join(', ')} · ${inr(o.total)} · to ${esc(o.city)}
            </p>
            <div style="margin-top:var(--space-6)">
              ${o.timeline.map(t => `
                <div style="display:flex;gap:var(--space-4);align-items:flex-start;padding-bottom:var(--space-5)">
                  <span style="width:22px;height:22px;border-radius:50%;flex:none;display:grid;place-items:center;
                    background:${t.done ? 'var(--gold-500)' : 'var(--ivory-200)'};color:#fff">
                    ${t.done ? window.AU.icon('check', 13) : ''}</span>
                  <div><strong style="font-family:var(--font-sans);font-size:var(--fs-sm)">${esc(LABELS[t.step] || t.step)}</strong>
                    <div class="muted" style="font-size:var(--fs-xs)">${t.done ? 'Done' : 'Pending'}</div></div>
                </div>`).join('')}
            </div>
          </div>`;
      } catch (err) {
        out.innerHTML = `<div class="panel"><h3>We could not find that order</h3>
          <p class="muted">${esc(err.message)}</p></div>`;
      }
    });
  }

  /* ================================================== CONTACT ==== */
  function contact() {
    $('#contactForm').addEventListener('submit', async e => {
      e.preventDefault();
      let ok = true;
      $$('#contactForm [required]').forEach(i => {
        const bad = !i.value.trim() || (i.type === 'email' && !i.value.includes('@'));
        i.closest('.field').classList.toggle('field--error', bad);
        if (bad) ok = false;
      });
      if (!ok) { toast('Check the highlighted fields'); return; }
      try {
        await window.AU_API.contact({
          name: $('#cn').value.trim(), email: $('#ce').value.trim(),
          orderRef: $('#co').value.trim() || null, subject: $('#cs').value,
          body: $('#cm').value.trim(),
        });
        e.target.reset();
        toast('Message sent. We reply within two working days.');
      } catch (err) { toast(err.message || 'Could not send that. Try again.'); }
    });
  }

  /* ================================================== ACCOUNT ==== */
  function account() {
    const box = $('#accountBox');
    let step = 'phone';          // phone -> code -> register
    let phone = '', isNew = false, devCode = null, tab = 'orders';

    const when = iso => {
      if (!iso) return '';
      const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
      return isNaN(d) ? '' : d.toLocaleDateString('en-IN',
        { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const STEPS = [['placed','Placed'],['packed','Packed'],['shipped','Shipped'],['delivered','Delivered']];

    function trackRail(status) {
      if (status === 'cancelled') return '';
      const at = STEPS.findIndex(s => s[0] === status);
      return `<div class="track-rail">${STEPS.map(([k, label], i) => `
        <div class="track-node ${i <= at ? 'is-done' : ''}">
          <div class="track-node__dot">${i <= at ? window.AU.icon('check', 12) : ''}</div>
          <span>${label}</span></div>`).join('')}</div>`;
    }

    function orderCard(o) {
      return `<article class="order-card">
        <div class="order-card__head">
          <div><div class="order-card__ref">${esc(o.ref)}</div>
            <span class="status-pill status-pill--${esc(o.status)}">${esc(o.status)}</span>
            <div class="muted" style="font-size:var(--fs-xs);margin-top:var(--space-2)">
              Placed ${when(o.placedAt)} · to ${esc(o.city)}</div></div>
          <div style="text-align:right"><div class="order-card__total">${inr(o.total)}</div>
            <div class="muted" style="font-size:var(--fs-xs)">
              ${o.items.length} item${o.items.length === 1 ? '' : 's'}</div></div>
        </div>
        ${trackRail(o.status)}
        <div class="order-card__items">
          ${o.items.map(i => `<div class="order-line">
            ${M.img(`assets/img/p-${i.slug}.jpg`, i.name, { width: 52 })}
            <div><div class="order-line__name">${esc(i.name)}</div>
              <div class="order-line__meta">${esc(i.finish || '')} · Qty ${i.qty}</div></div>
            <div style="margin-left:auto;font-size:var(--fs-sm)">${inr(i.lineTotal || 0)}</div>
          </div>`).join('')}
        </div></article>`;
    }

    /* ------------------------------------------------ sign-in steps -- */
    function paintPhone(msg) {
      box.innerHTML = `<div class="panel" style="max-width:420px;margin-inline:auto">
        <p class="eyebrow">Sign in</p>
        <h3>Your mobile number</h3>
        <p class="muted" style="font-size:var(--fs-sm);margin-bottom:var(--space-5)">
          We send a one-time code by SMS. No password to remember.</p>
        <div class="field">
          <label for="phInput">Mobile number</label>
          <div style="display:flex;gap:var(--space-2);align-items:stretch">
            <span style="display:grid;place-items:center;padding:0 var(--space-4);
                         border:1px solid var(--border-strong);border-radius:var(--radius-xs);
                         background:var(--ivory-050);font-size:var(--fs-sm)">+91</span>
            <input id="phInput" type="tel" inputmode="numeric" maxlength="10"
                   placeholder="10-digit number" style="flex:1" value="${esc(phone)}">
          </div>
          <span class="field__err" id="phErr" style="${msg ? 'display:block' : ''}">${esc(msg || '')}</span>
        </div>
        <button class="btn btn--gold btn--block" type="button" id="phSend">Send code</button>
      </div>`;

      const input = $('#phInput');
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 10);
      });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') $('#phSend').click(); });

      $('#phSend').addEventListener('click', async () => {
        const btn = $('#phSend');
        const val = input.value.trim();
        if (!/^[6-9]\d{9}$/.test(val)) { paintPhone('Enter a valid 10-digit mobile number'); return; }
        btn.disabled = true; btn.textContent = 'Sending…';
        try {
          const r = await window.AU_PHONE.requestCode(val);
          phone = r.phone; isNew = r.isNew; devCode = r.devCode || null;
          step = 'code';
          paintCode();
        } catch (e) {
          paintPhone(e.message);
        }
      });
    }

    function paintCode(msg) {
      box.innerHTML = `<div class="panel" style="max-width:420px;margin-inline:auto">
        <p class="eyebrow">Verify</p>
        <h3>Enter the code</h3>
        <p class="muted" style="font-size:var(--fs-sm);margin-bottom:var(--space-5)">
          Sent to <strong>+91 ${esc(phone)}</strong> ·
          <button class="link-btn" type="button" id="phChange">change</button></p>
        ${devCode ? `<div class="login-hint" style="margin-bottom:var(--space-4)">
          No SMS gateway configured, so the code is <strong>${esc(devCode)}</strong>.</div>` : ''}
        <div class="field">
          <label for="codeInput">6-digit code</label>
          <input id="codeInput" inputmode="numeric" maxlength="6" placeholder="······"
                 style="letter-spacing:.5em;text-align:center;font-size:20px">
          <span class="field__err" id="codeErr" style="${msg ? 'display:block' : ''}">${esc(msg || '')}</span>
        </div>
        <button class="btn btn--gold btn--block" type="button" id="codeGo">Verify</button>
        <button class="btn btn--ghost btn--block" type="button" id="codeResend"
                style="margin-top:var(--space-3)">Send a new code</button>
      </div>`;

      const input = $('#codeInput');
      input.focus();
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 6);
        if (input.value.length === 6) $('#codeGo').click();
      });

      $('#phChange').addEventListener('click', () => { step = 'phone'; paintPhone(); });
      $('#codeResend').addEventListener('click', async () => {
        try {
          const r = await window.AU_PHONE.requestCode(phone);
          devCode = r.devCode || null;
          paintCode('A new code is on its way.');
        } catch (e) { paintCode(e.message); }
      });

      $('#codeGo').addEventListener('click', async () => {
        const btn = $('#codeGo');
        if (input.value.length !== 6) { paintCode('Enter the 6-digit code'); return; }
        btn.disabled = true; btn.textContent = 'Checking…';
        try {
          const r = await window.AU_PHONE.verifyCode(phone, input.value);
          if (r.needsRegistration) { step = 'register'; paintRegister(); return; }
          finish();
        } catch (e) {
          paintCode(e.message);
        }
      });
    }

    function paintRegister(msg) {
      box.innerHTML = `<div class="panel" style="max-width:420px;margin-inline:auto">
        <p class="eyebrow">Almost there</p>
        <h3>Create your account</h3>
        <p class="muted" style="font-size:var(--fs-sm);margin-bottom:var(--space-5)">
          Your number <strong>+91 ${esc(phone)}</strong> is verified.</p>
        <div class="field"><label for="regName">Your name</label>
          <input id="regName" placeholder="Full name">
          <span class="field__err" id="regErr" style="${msg ? 'display:block' : ''}">${esc(msg || '')}</span>
        </div>
        <div class="field"><label for="regEmail">Email <span class="muted">(optional)</span></label>
          <input id="regEmail" type="email" placeholder="For order updates and invoices"></div>
        <button class="btn btn--gold btn--block" type="button" id="regGo">Create account</button>
      </div>`;

      $('#regName').focus();
      $('#regGo').addEventListener('click', async () => {
        const name = $('#regName').value.trim();
        if (name.length < 2) { paintRegister('Please tell us your name'); return; }
        const btn = $('#regGo');
        btn.disabled = true; btn.textContent = 'Creating…';
        try {
          // The code is spent by now; the module sends the ticket instead.
          await window.AU_PHONE.verifyCode(phone, null, {
            name, email: $('#regEmail').value.trim() || undefined,
          });
          finish();
        } catch (e) {
          paintRegister(e.message);
        }
      });
    }

    /** Signed in — go wherever they were originally headed. */
    function finish() {
      const back = window.AU_PHONE.takeReturn('account.html');
      if (back && !/account\.html$/.test(back)) { location.href = back; return; }
      window.AU_PHONE.load().then(paint);
    }

    /* ------------------------------------------------- signed in -- */
    function paintDashboard(snap) {
      const c = snap.customer || {};
      const orders = c.orders || [];
      const initials = (c.name || 'A').trim().split(/\s+/).map(w => w[0]).slice(0, 2)
        .join('').toUpperCase();
      const spent = orders.filter(o => o.status !== 'cancelled')
        .reduce((s, o) => s + o.total, 0);
      const active = orders.filter(o => ['placed','packed','shipped'].includes(o.status)).length;

      const body = tab === 'orders'
        ? (orders.length ? orders.map(orderCard).join('')
            : `<div class="empty"><h3>No orders yet</h3>
                 <p>When you buy something it appears here with live tracking.</p>
                 <a class="btn btn--primary" href="collection.html">Start shopping</a></div>`)
        : tab === 'wishlist'
          ? (() => {
              const saved = D.products.filter(p => C.snapshot().wishlist.includes(p.slug));
              return saved.length
                ? `<div class="product-grid product-grid--3">${saved.map(productCard).join('')}</div>`
                : `<div class="empty"><h3>Nothing saved</h3>
                     <p>Tap the heart on any piece and it waits for you here.</p>
                     <a class="btn btn--primary" href="collection.html">Browse</a></div>`;
            })()
          : `<div class="panel"><h3>Your details</h3>
              <table class="spec-table">
                <tr><td>Name</td><td>${esc(c.name || '—')}</td></tr>
                <tr><td>Mobile</td><td>+91 ${esc(c.phone || '')}</td></tr>
                <tr><td>Email</td><td>${esc(c.email || 'Not given')}</td></tr>
                <tr><td>Sign-in</td><td>One-time code by SMS</td></tr>
              </table>
              <button class="btn btn--ghost btn--sm" type="button" id="doSignOut2"
                      style="margin-top:var(--space-6)">Sign out</button></div>`;

      box.innerHTML = `
        <div class="dash-hero">
          <div class="dash-hero__avatar">${esc(initials)}</div>
          <div class="dash-hero__who">
            <p>Signed in</p><h2>${esc(c.name || 'Your account')}</h2>
            <span>+91 ${esc(c.phone || '')}</span>
          </div>
          <button class="btn btn--light btn--sm" type="button" id="doSignOut">Sign out</button>
        </div>
        <div class="dash-stats">
          <div class="dash-stat"><strong>${orders.length}</strong><span>Orders</span></div>
          <div class="dash-stat"><strong>${inr(spent)}</strong><span>Total spent</span></div>
          <div class="dash-stat"><strong>${active}</strong><span>In progress</span></div>
        </div>
        <div class="dash-tabs">
          <button class="dash-tab ${tab==='orders'?'is-active':''}" data-tab="orders">Orders</button>
          <button class="dash-tab ${tab==='wishlist'?'is-active':''}" data-tab="wishlist">Wishlist</button>
          <button class="dash-tab ${tab==='profile'?'is-active':''}" data-tab="profile">Profile</button>
        </div>
        <div id="dashBody">${body}</div>`;

      const out = () => { window.AU_PHONE.signOut(); step = 'phone'; paintPhone(); };
      $('#doSignOut').addEventListener('click', out);
      $('#doSignOut2')?.addEventListener('click', out);
      $$('.dash-tab').forEach(b => b.addEventListener('click', () => {
        tab = b.dataset.tab; paintDashboard(snap);
      }));
    }

    function paint(snap) {
      if (snap.signedIn && snap.customer) return paintDashboard(snap);
      if (step === 'code') return paintCode();
      if (step === 'register') return paintRegister();
      paintPhone();
    }

    box.innerHTML = '<div class="panel center"><p class="muted">Loading your account…</p></div>';
    if (window.AU_PHONE) {
      window.AU_PHONE.subscribe(paint);
      window.AU_PHONE.load();
    } else {
      paintPhone();
    }
  }

  /* ==================================================== BOOT ===== */
  const ROUTES = { home, collection, product, cart: cartPage, checkout, confirmation,
                   wishlist, faq, stores, journal, track, contact, account };

  document.addEventListener('DOMContentLoaded', async () => {
    const page = document.body.dataset.page;

    // The catalogue decides what products render, so wait for it — but it
    // carries its own short timeout and falls back to the bundled data.
    if (window.AU_API) {
      try { await window.AU_API.init(); } catch (err) { /* static mode */ }
    }

    // Paint the page NOW. Nothing below this line may block rendering.
    window.AU.mount(document.body.dataset.nav || '');
    if (ROUTES[page]) {
      try { ROUTES[page](); } catch (err) { console.error(`[aurelle] ${page} failed:`, err); }
    }
    window.AU.reveal();

    // Sign-in resolves in the background. Anything that cares subscribed
    // during render and repaints when this lands, so a slow or unreachable
    // auth service can never leave the page blank.
    if (window.AU_AUTH) {
      window.AU_AUTH.init().catch(() => { /* guest mode */ });
    }
  });
})();
