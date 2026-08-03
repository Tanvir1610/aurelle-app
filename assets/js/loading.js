/* ============================================================
   AURELLE — LOADING FEEDBACK
   ------------------------------------------------------------
   A tap should acknowledge itself immediately. Browsers show
   nothing while the next document loads, which on a slow phone
   connection looks like a dead link or a white screen.

   This gives every navigation a progress bar, marks the thing
   that was tapped as busy, and shows skeletons while a grid is
   being built.
   ============================================================ */
window.AU_LOADING = (function () {

  let bar = null, veil = null, timer = null;

  function ensure() {
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'au-progress';
      document.body.appendChild(bar);
    }
    if (!veil) {
      veil = document.createElement('div');
      veil.className = 'au-veil';
      veil.innerHTML = '<div class="au-spinner"></div>';
      document.body.appendChild(veil);
    }
  }

  /** Creeps toward 90% — the last 10% only arrives when the page does. */
  function start() {
    ensure();
    clearTimeout(timer);
    bar.style.opacity = '1';
    bar.style.width = '12%';
    let at = 12;
    clearInterval(bar._tick);
    bar._tick = setInterval(() => {
      at = Math.min(90, at + (90 - at) * 0.14);
      bar.style.width = at + '%';
    }, 220);

    // Only veil the page if it is taking long enough to feel broken.
    timer = setTimeout(() => veil.classList.add('is-on'), 550);
  }

  function done() {
    if (!bar) return;
    clearInterval(bar._tick);
    clearTimeout(timer);
    bar.style.width = '100%';
    veil.classList.remove('is-on');
    setTimeout(() => {
      bar.style.opacity = '0';
      setTimeout(() => { bar.style.width = '0'; }, 300);
    }, 180);
  }

  /** Mark a button as working. Returns a function to restore it. */
  function busy(el) {
    if (!el) return () => {};
    el.classList.add('is-busy');
    el.setAttribute('aria-busy', 'true');
    return () => {
      el.classList.remove('is-busy');
      el.removeAttribute('aria-busy');
    };
  }

  /** Placeholder cards while a grid is being assembled. */
  function skeletonGrid(n = 8) {
    return `<div class="skeleton-grid">${Array.from({ length: n }, () => `
      <div class="skeleton-card">
        <div class="skeleton-card__img"></div>
        <div class="skeleton-card__body">
          <div class="skeleton-line skeleton-line--short"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line skeleton-line--short"></div>
        </div>
      </div>`).join('')}</div>`;
  }

  function wire() {
    ensure();

    /* Any link that leaves the page gets feedback. Not new tabs, not
       anchors, not downloads, and not anything the page handles itself. */
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) return;

      let url;
      try { url = new URL(href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;

      // A product card should dim, so the tap clearly registered.
      const card = a.closest('.card');
      if (card) card.classList.add('is-loading');

      start();
    }, true);

    // Coming back via the browser's history should not leave a stuck bar.
    window.addEventListener('pageshow', done);
    window.addEventListener('beforeunload', () => { /* bar stays until unload */ });
  }

  return { start, done, busy, skeletonGrid, wire };
})();

document.addEventListener('DOMContentLoaded', () => window.AU_LOADING.wire());
