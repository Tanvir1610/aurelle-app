/* ============================================================
   AURELLE — SHARED UI
   Injects the header, mega menu, cart drawer and footer into
   every page, and exposes the renderers pages reuse (product
   card, rating, price, toast).
   ============================================================ */
window.AU = (function () {

  const D = () => window.AU_DATA;
  const M = () => window.AU_MEDIA;
  const C = () => window.AU_CART;

  /* ---------------------------------------------------- helpers -- */
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** Indian digit grouping — ₹1,49,999 not ₹149,999. */
  function inr(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
  function pctOff(price, mrp) {
    if (!mrp || mrp <= price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function param(name, dflt) {
    const v = new URLSearchParams(location.search).get(name);
    return v === null ? (dflt === undefined ? null : dflt) : v;
  }

  /** matchMedia is missing in some embedded/webview contexts — never throw. */
  function mq(query) {
    try { return !!(window.matchMedia && window.matchMedia(query).matches); }
    catch (e) { return false; }
  }

  /* Inline SVG icon set — thin stroke, currentColor. */
  const ICONS = {
    search: '<path d="M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.35-4.35"/>',
    user:   '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    heart:  '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
    bag:    '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    menu:   '<path d="M3 12h18M3 6h18M3 18h18"/>',
    x:      '<path d="M18 6 6 18M6 6l12 12"/>',
    star:   '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z"/>',
    check:  '<path d="M20 6 9 17l-5-5"/>',
    truck:  '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    'shield-check': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    'refresh-ccw': '<path d="M3 2v6h6"/><path d="M21 12A9 9 0 0 0 6 5.3L3 8"/><path d="M21 22v-6h-6"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/>',
    sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
    pin:    '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    phone:  '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    mail:   '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>',
    plus:   '<path d="M12 5v14M5 12h14"/>',
    home:   '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    grid:   '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    flame:  '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5l3 2"/>',
    chat:   '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
  };

  function icon(name, size) {
    const s = size || 20;
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor"` +
           ` stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  function stars(n) {
    let out = '';
    for (let i = 1; i <= 5; i++) {
      out += `<svg width="12" height="12" viewBox="0 0 24 24" fill="${i <= Math.round(n) ? 'currentColor' : 'none'}"` +
             ` stroke="currentColor" stroke-width="1.4" aria-hidden="true">${ICONS.star}</svg>`;
    }
    return `<span class="rating__stars">${out}</span>`;
  }

  /* ------------------------------------------------ product card -- */
  function priceBlock(p) {
    const off = pctOff(p.price, p.mrp);
    return `<div class="price">
      <span class="price__now">${inr(p.price)}</span>
      ${p.mrp > p.price ? `<span class="price__was">${inr(p.mrp)}</span><span class="price__off">${off}% off</span>` : ''}
    </div>`;
  }

  function productCard(p) {
    const badgeCls = p.badge === 'New' ? ' card__badge--new' : '';
    const href = `product.html?p=${encodeURIComponent(p.slug)}`;
    return `<article class="card" data-slug="${esc(p.slug)}">
      <div class="card__media">
        ${p.badge ? `<span class="card__badge${badgeCls}">${esc(p.badge)}</span>` : ''}
        <button class="wishlist" type="button" data-wish="${esc(p.slug)}"
                aria-pressed="${C().inWish(p.slug)}" aria-label="Save ${esc(p.name)}">
          ${icon('heart', 16)}
        </button>
        <a href="${href}" aria-label="${esc(p.name)}">
          ${M().img(p.img, p.name)}
          ${M().img(p.imgAlt, '', { class: 'card__img--alt' })}
        </a>
        <button class="btn btn--primary btn--sm card__quickadd btn--block" type="button" data-add="${esc(p.slug)}">
          Add to bag
        </button>
      </div>
      <div class="card__body">
        <span class="card__cat">${esc(p.cat)}</span>
        <a href="${href}"><span class="card__name">${esc(p.name)}</span></a>
        <span class="rating">${stars(p.rating)} ${p.rating.toFixed(1)} (${p.reviews})</span>
        ${priceBlock(p)}
        <div class="swatches">
          ${p.swatches.map(s => `<span class="swatch" style="background:${s.color}" title="${esc(s.label)}"></span>`).join('')}
        </div>
      </div>
    </article>`;
  }

  function grid(list, cls) {
    if (!list.length) return '';
    return `<div class="product-grid${cls ? ' ' + cls : ''}">${list.map(productCard).join('')}</div>`;
  }

  /* ----------------------------------------------------- toasts -- */
  function toast(msg) {
    let host = $('.toasts');
    if (!host) { host = document.createElement('div'); host.className = 'toasts'; document.body.appendChild(host); }
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `${icon('check', 18)}<span>${esc(msg)}</span>`;
    host.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 240ms';
      setTimeout(() => el.remove(), 260);
    }, 2600);
  }

  /* ----------------------------------------------------- header -- */
  function headerHTML(active) {
    const d = D();
    const navItems = Object.keys(d.megamenu).map(label => {
      const cols = d.megamenu[label];
      return `<li class="nav__item">
        <a class="nav__link" href="collection.html">${esc(label)}</a>
        <div class="mega"><div class="container"><div class="mega__grid">
          ${cols.map(c => `<div class="mega__col">
            <h4>${esc(c.h)}</h4>
            <ul>${c.items.map(i => `<li><a href="${i.href}">${esc(i.label)}</a></li>`).join('')}</ul>
          </div>`).join('')}
          <a class="mega__promo" href="collection.html?occasion=Wedding">
            ${M().img('assets/img/b-editorial-bridal.svg', 'Bridal by Aurelle')}
            <div><strong>Bridal by Aurelle</strong><span>31 pieces, built light</span></div>
          </a>
        </div></div></div>
      </li>`;
    }).join('');

    const plain = [
      ['Bestsellers', 'collection.html?sort=popular'],
      ['Journal', 'journal.html'],
      ['Stores', 'stores.html'],
      ['About', 'about.html'],
    ].map(([l, h]) => `<li class="nav__item"><a class="nav__link${active === l ? ' is-current' : ''}" href="${h}">${l}</a></li>`).join('');

    return `
<a class="skip-link" href="#main">Skip to content</a>
<div class="announce" aria-live="polite">
  <div class="announce__track" id="announceTrack">
    ${d.announcements.map((a, i) => `<span class="announce__msg${i === 0 ? ' is-active' : ''}">${a}</span>`).join('')}
  </div>
</div>
<header class="site-header" id="siteHeader">
  <div class="container header__inner">
    <button class="icon-btn burger" id="burger" type="button" aria-label="Open menu" aria-expanded="false">${icon('menu')}</button>
    <a class="wordmark" href="index.html">Aurelle<small>FINE FASHION JEWELLERY</small></a>
    <nav class="header__nav" id="headerNav" aria-label="Primary">
      <ul class="nav">${navItems}${plain}</ul>
    </nav>
    <div class="header__actions">
      <a class="icon-btn" href="collection.html" aria-label="Search">${icon('search')}</a>
      <a class="icon-btn" href="account.html" aria-label="Account">${icon('user')}</a>
      <a class="icon-btn" href="wishlist.html" aria-label="Wishlist">${icon('heart')}
        <span class="icon-btn__count" data-count="0" id="wishCount">0</span></a>
      <button class="icon-btn" id="openCart" type="button" aria-label="Open bag">${icon('bag')}
        <span class="icon-btn__count" data-count="0" id="cartCount">0</span></button>
    </div>
  </div>
</header>`;
  }

  /* ----------------------------------------------- bottom nav (mobile) -- */
  /* Primary navigation within thumb reach. Hidden above 768px, where the
     header already does this job. */
  function botnavHTML(active) {
    const items = [
      ['Home', 'index.html', 'home', null],
      ['Category', 'collection.html', 'grid', null],
      ['Trending', 'collection.html?sort=popular', 'flame', null],
      ['Stores', 'stores.html', 'pin', null],
      ['Account', 'account.html', 'user', null],
    ];
    return `<nav class="botnav" aria-label="Primary, mobile">
      ${items.map(([label, href, ic]) => `
        <a class="botnav__item${active === label ? ' is-current' : ''}" href="${href}"
           ${active === label ? 'aria-current="page"' : ''}>
          ${icon(ic, 21)}<span>${label}</span>
        </a>`).join('')}
    </nav>`;
  }

  /* ------------------------------------------------------ footer -- */
  function footerHTML() {
    const cats = D().categories.slice(0, 6);
    return `
<footer class="site-footer">
  <div class="container">
    <div class="footer__grid">
      <div class="footer__col footer__about">
        <a class="wordmark" href="index.html">Aurelle<small>FINE FASHION JEWELLERY</small></a>
        <p>24Kt gold-plated, anti-tarnish, skin-friendly jewellery made in India — designed to be worn on ordinary days, not kept in a locker.</p>
        <div class="footer__social">
          <a href="#" aria-label="Instagram">${icon('sparkles', 16)}</a>
          <a href="#" aria-label="Email us">${icon('mail', 16)}</a>
          <a href="#" aria-label="Call us">${icon('phone', 16)}</a>
        </div>
      </div>
      <div class="footer__col">
        <h4>Shop</h4>
        <ul>${cats.map(c => `<li><a href="collection.html?cat=${encodeURIComponent(c.label)}">${esc(c.label)}</a></li>`).join('')}</ul>
      </div>
      <div class="footer__col">
        <h4>Help</h4>
        <ul>
          <li><a href="faq.html">FAQs</a></li>
          <li><a href="track-order.html">Track your order</a></li>
          <li><a href="faq.html#returns">Returns &amp; exchange</a></li>
          <li><a href="faq.html#shipping">Shipping</a></li>
          <li><a href="contact.html">Contact us</a></li>
        </ul>
      </div>
      <div class="footer__col">
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">Our story</a></li>
          <li><a href="stores.html">Store locator</a></li>
          <li><a href="journal.html">Journal</a></li>
          <li><a href="contact.html">Careers</a></li>
          <li><a href="faq.html">Terms &amp; privacy</a></li>
        </ul>
      </div>
    </div>
    <div class="footer__bar">
      <span>© ${new Date().getFullYear()} Aurelle Jewellery Pvt. Ltd. All rights reserved.</span>
      <div class="footer__pay"><span>UPI</span><span>Visa</span><span>Mastercard</span><span>RuPay</span><span>Net banking</span><span>COD</span></div>
    </div>
  </div>
</footer>`;
  }

  /* ------------------------------------------------ cart drawer -- */
  function drawerHTML() {
    return `
<div class="drawer-scrim" id="cartScrim"></div>
<aside class="drawer" id="cartDrawer" role="dialog" aria-modal="true" aria-label="Shopping bag">
  <div class="drawer__head">
    <h3>Your bag (<span id="drawerCount">0</span>)</h3>
    <button class="icon-btn" id="closeCart" type="button" aria-label="Close bag">${icon('x')}</button>
  </div>
  <div class="drawer__body" id="drawerBody"></div>
  <div class="drawer__foot" id="drawerFoot"></div>
</aside>`;
  }

  function renderDrawer(snap) {
    const body = $('#drawerBody');
    const foot = $('#drawerFoot');
    if (!body || !foot) return;
    const t = snap.totals;
    $('#drawerCount').textContent = t.count;

    if (!snap.lines.length) {
      body.innerHTML = `<div class="empty">
        <h3>Your bag is empty</h3>
        <p>Nothing in here yet. The bestsellers are a good place to start.</p>
        <a class="btn btn--primary" href="collection.html?sort=popular">Shop bestsellers</a>
      </div>`;
      foot.innerHTML = '';
      return;
    }

    const pct = Math.min(100, (t.subtotal / t.freeShipAt) * 100);
    const shipMsg = t.toFreeShip > 0
      ? `Add ${inr(t.toFreeShip)} more for free shipping`
      : 'Free shipping unlocked';

    body.innerHTML = `
      <div class="ship-bar">
        <p>${shipMsg}</p>
        <div class="ship-bar__track"><div class="ship-bar__fill" style="width:${pct}%"></div></div>
      </div>
      ${snap.lines.map(l => `
      <div class="line">
        ${M().img(l.product.img, l.product.name, { width: 76 })}
        <div>
          <a href="product.html?p=${encodeURIComponent(l.slug)}"><span class="line__name">${esc(l.product.name)}</span></a>
          <div class="line__variant">${esc(l.finish)}</div>
          <div class="stepper">
            <button type="button" data-qty="${esc(l.id)}" data-delta="-1" aria-label="Decrease quantity">−</button>
            <span>${l.qty}</span>
            <button type="button" data-qty="${esc(l.id)}" data-delta="1" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <div>
          <div class="line__price">${inr(l.lineTotal)}</div>
          <button class="line__remove" type="button" data-remove="${esc(l.id)}">Remove</button>
        </div>
      </div>`).join('')}`;

    foot.innerHTML = `
      <div class="totals">
        <div><span>Subtotal</span><span>${inr(t.subtotal)}</span></div>
        ${t.saved > 0 ? `<div><span>You save</span><span style="color:var(--success)">− ${inr(t.saved)}</span></div>` : ''}
        <div><span>Shipping</span><span>${t.shipping === 0 ? 'Free' : inr(t.shipping)}</span></div>
        <div class="is-total"><span>Total</span><span>${inr(t.total)}</span></div>
      </div>
      <a class="btn btn--gold btn--block" href="checkout.html">Checkout</a>
      <a class="btn btn--ghost btn--block" href="cart.html" style="margin-top:var(--space-3)">View full bag</a>`;
  }

  function openCart()  { $('#cartScrim')?.classList.add('is-open'); $('#cartDrawer')?.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
  function closeCart() { $('#cartScrim')?.classList.remove('is-open'); $('#cartDrawer')?.classList.remove('is-open'); document.body.style.overflow = ''; }

  /* -------------------------------------------------- behaviours -- */
  function announceRotator() {
    const msgs = $$('.announce__msg');
    if (msgs.length < 2) return;
    let i = 0;
    setInterval(() => {
      msgs[i].classList.remove('is-active');
      i = (i + 1) % msgs.length;
      msgs[i].classList.add('is-active');
    }, 4200);
  }

  function reveal() {
    const items = $$('[data-reveal]');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(el => io.observe(el));
  }

  function wireGlobal() {
    // Sticky header shadow
    const header = $('#siteHeader');
    if (header) {
      const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 8);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    // Mobile nav
    const burger = $('#burger'), nav = $('#headerNav');
    burger?.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    // Mobile: tapping a nav item with a mega panel opens it in place
    $$('.nav__item').forEach(item => {
      const link = $('.nav__link', item);
      if (!$('.mega', item)) return;
      link?.addEventListener('click', (e) => {
        if (mq('(max-width: 768px)')) {
          e.preventDefault();
          item.classList.toggle('is-open');
        }
      });
    });

    // Cart drawer
    $('#openCart')?.addEventListener('click', openCart);
    $('#closeCart')?.addEventListener('click', closeCart);
    $('#cartScrim')?.addEventListener('click', closeCart);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });

    // Delegated: add to bag / wishlist / qty / remove
    document.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      if (add) {
        const p = C().add(add.dataset.add, 1, add.dataset.finish);
        if (p) { toast(`${p.name} added to your bag`); openCart(); }
        return;
      }
      const wish = e.target.closest('[data-wish]');
      if (wish) {
        const on = C().toggleWish(wish.dataset.wish);
        wish.setAttribute('aria-pressed', String(on));
        toast(on ? 'Saved to your wishlist' : 'Removed from your wishlist');
        return;
      }
      const qty = e.target.closest('[data-qty]');
      if (qty) {
        const line = C().detailed().find(l => l.id === qty.dataset.qty);
        if (line) C().setQty(line.id, line.qty + Number(qty.dataset.delta));
        return;
      }
      const rm = e.target.closest('[data-remove]');
      if (rm) { C().remove(rm.dataset.remove); toast('Removed from your bag'); }
    });

    // Newsletter — client-side only until the backend exists
    document.addEventListener('submit', async (e) => {
      const form = e.target.closest('[data-newsletter]');
      if (!form) return;
      e.preventDefault();
      const input = $('input[type=email]', form);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.value)) {
        toast('Enter a valid email address'); return;
      }
      try {
        await window.AU_API.subscribe(input.value.trim());
        form.reset();
        toast('You are on the list. Watch your inbox.');
      } catch (err) { toast(err.message || 'Could not sign you up. Try again.'); }
    });
  }

  /* Header account control follows the Clerk session. */
  function wireAccount() {
    if (!window.AU_AUTH) return;
    window.AU_AUTH.subscribe(snap => {
      const link = document.querySelector('a[href="account.html"]');
      if (!link) return;
      if (snap.enabled && snap.signedIn) {
        link.setAttribute('aria-label', `Account — ${snap.user.name}`);
        link.title = snap.user.email || snap.user.name;
        link.style.color = 'var(--gold-600)';
      } else {
        link.style.color = '';
        link.title = snap.enabled ? 'Sign in' : 'Account';
      }
    });
  }

  /* Badge counts stay in sync everywhere. */
  function wireCounts() {
    C().subscribe(snap => {
      const cc = $('#cartCount'), wc = $('#wishCount');
      if (cc) { cc.textContent = snap.totals.count; cc.dataset.count = snap.totals.count; }
      if (wc) { wc.textContent = snap.wishlist.length; wc.dataset.count = snap.wishlist.length; }
      renderDrawer(snap);
      document.dispatchEvent(new CustomEvent('au:cart', { detail: snap }));
    });
  }

  /* ------------------------------------------------------- help chat -- */
  /* Answers come from the FAQ content, so there is one source of truth and
     nothing here can contradict the FAQ page. */
  function chatHTML() {
    return `
<button class="chat-launch" id="chatLaunch" type="button" aria-label="Open help">
  ${icon('chat', 22)}<span class="chat-launch__dot"></span>
</button>
<aside class="chat-panel" id="chatPanel" role="dialog" aria-label="Help">
  <div class="chat-head">
    <div><strong>Aurelle help</strong><span>Answers in a tap</span></div>
    <button type="button" id="chatClose" aria-label="Close help">${icon('x', 18)}</button>
  </div>
  <div class="chat-log" id="chatLog"></div>
  <div class="chat-asks" id="chatAsks"></div>
</aside>`;
  }

  function wireChat() {
    const panel = $('#chatPanel'), log = $('#chatLog'), asks = $('#chatAsks');
    if (!panel) return;

    const faqs = (D().faqs || []);
    /* A few shop-specific answers the FAQ does not cover. */
    const extra = [
      { q: 'Where is my order?',
        a: 'Enter your order reference on the <a href="track-order.html">Track order</a> page ' +
           'and you will see exactly where it is. References look like AUR123456 and are in ' +
           'your confirmation email.' },
      { q: 'What does delivery cost?',
        a: 'Free above ₹999. Below that a flat ₹79 applies. Cash on delivery adds ₹49.' },
      { q: 'Do you have a store near me?',
        a: 'Six stores across India. The <a href="stores.html">store locator</a> has addresses ' +
           'and opening hours.' },
      { q: 'Talk to a person',
        a: 'Write to care@aurelle.example or call +91 79 4000 1204, Monday to Saturday, ' +
           '10:00–19:00 IST. You can also use the <a href="contact.html">contact form</a> — ' +
           'we reply within two working days.' },
    ];
    const topics = [...faqs.map(f => ({ q: f.q, a: esc(f.a) })), ...extra];

    function say(who, html) {
      const el = document.createElement('div');
      el.className = `chat-msg chat-msg--${who}`;
      el.innerHTML = html;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
    }

    function paintAsks() {
      asks.innerHTML = topics
        .map((t, i) => `<button class="chat-ask" type="button" data-ask="${i}">${esc(t.q)}</button>`)
        .join('');
    }

    let opened = false;
    function open() {
      panel.classList.add('is-open');
      if (!opened) {
        opened = true;
        say('bot', 'Hello. Pick a question below and I will answer it straight away — ' +
                   'or write to us and a person will reply within two working days.');
        paintAsks();
      }
    }
    const close = () => panel.classList.remove('is-open');

    $('#chatLaunch')?.addEventListener('click', () =>
      panel.classList.contains('is-open') ? close() : open());
    $('#chatClose')?.addEventListener('click', close);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) close();
    });

    asks.addEventListener('click', e => {
      const b = e.target.closest('[data-ask]');
      if (!b) return;
      const topic = topics[Number(b.dataset.ask)];
      say('me', esc(topic.q));
      // A beat before answering, so it reads as a reply rather than a page load.
      setTimeout(() => say('bot', topic.a), 260);
    });
  }

  /** Called by every page: paints chrome, then hands control back. */
  function mount(activeNav) {
    const head = document.createElement('div');
    head.innerHTML = headerHTML(activeNav);
    document.body.prepend(head);

    document.body.insertAdjacentHTML('beforeend',
      drawerHTML() + footerHTML() + botnavHTML(activeNav) + chatHTML());

    announceRotator();
    wireGlobal();
    wireCounts();
    wireAccount();
    wireChat();
    reveal();
  }

  return { $, $$, inr, pctOff, esc, param, mq, icon, stars, productCard, priceBlock, grid,
           toast, mount, openCart, closeCart, reveal };
})();
