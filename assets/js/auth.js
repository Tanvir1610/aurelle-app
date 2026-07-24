/* ============================================================
   AURELLE — CLERK AUTH (browser)
   ------------------------------------------------------------
   Loads Clerk on demand, exposes sign-in/out, and hands the
   current session token to AU_API so requests are authenticated.

   Clerk's own UI handles the email OTP flow — the code entry,
   resend timer and verification all come from Clerk. We never
   see or store a password.

   If Clerk is not configured server-side, everything here turns
   into a no-op and the shop runs exactly as it did before, with
   guest checkout.
   ============================================================ */
window.AU_AUTH = (function () {

  let clerk = null;
  let ready = false;
  let config = null;
  let lastError = null;
  const listeners = [];

  /** Never let a hung network call leave the page blank forever. */
  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
    ]);
  }

  const emit = () => {
    const snap = state();
    listeners.forEach(fn => { try { fn(snap); } catch (e) { console.error(e); } });
  };

  function state() {
    const u = clerk && clerk.user;
    return {
      enabled: !!(config && config.clerk && config.clerk.enabled),
      ready,
      error: lastError,
      signedIn: !!u,
      user: u ? {
        id: u.id,
        email: u.primaryEmailAddress ? u.primaryEmailAddress.emailAddress : null,
        firstName: u.firstName || null,
        lastName: u.lastName || null,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') ||
              (u.primaryEmailAddress ? u.primaryEmailAddress.emailAddress : 'Account'),
        imageUrl: u.imageUrl || null,
      } : null,
    };
  }

  /** Load the Clerk script once, from the instance's own CDN path. */
  function loadScript(publishableKey, frontendApi) {
    return new Promise((resolve, reject) => {
      if (window.Clerk) return resolve(window.Clerk);
      const s = document.createElement('script');
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.dataset.clerkPublishableKey = publishableKey;
      s.src = `https://${frontendApi}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
      s.onload = () => resolve(window.Clerk);
      s.onerror = () => reject(new Error('Clerk script failed to load'));
      document.head.appendChild(s);
      setTimeout(() => {
        if (!window.Clerk) reject(new Error('Clerk script did not load in time'));
      }, 10000);
    });
  }

  async function init() {
    if (ready) return state();

    // Ask our own server what is configured. Never hardcode keys here.
    try {
      const res = await withTimeout(fetch('/api/config'), 5000, 'Config request');
      config = await res.json();
    } catch (e) {
      lastError = e.message;
      config = { clerk: { enabled: false } };
    }

    if (!config.clerk || !config.clerk.enabled) {
      ready = true;
      emit();
      return state();
    }

    try {
      await withTimeout(
        loadScript(config.clerk.publishableKey, config.clerk.frontendApi),
        12000, 'Clerk script');

      const instance = window.Clerk;
      // Publish only once load() has finished — calling openSignIn() on a
      // half-started instance silently does nothing.
      await withTimeout(instance.load({ afterSignOutUrl: '/' }), 12000, 'Clerk startup');
      clerk = instance;

      // Keep the UI in step with Clerk's own session changes.
      clerk.addListener(() => { emit(); syncCustomer(); });

      ready = true;
      emit();
      syncCustomer();
    } catch (e) {
      console.warn('[auth] Clerk unavailable, continuing as guest:', e.message);
      lastError = e.message;
      clerk = null;
      ready = true;
      emit();
    }
    return state();
  }

  /** Current session token, or null. AU_API attaches this automatically. */
  async function token() {
    if (!clerk || !clerk.session) return null;
    try { return await clerk.session.getToken(); }
    catch (e) { return null; }
  }

  /** Mirror the Clerk user into our own customers table. */
  async function syncCustomer() {
    const t = await token();
    if (!t) return;
    try {
      await fetch('/api/me/sync', {
        method: 'POST',
        headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
        body: '{}',
      });
    } catch (e) { /* non-fatal */ }
  }

  /**
   * Clerk's modal drives the whole OTP exchange. If it refuses to mount
   * (blocked frame, origin not registered in Clerk) fall back to the hosted
   * page rather than doing nothing.
   */
  function openClerk(mode, redirectUrl) {
    const after = redirectUrl || window.location.href;
    if (!clerk || !ready) {
      lastError = 'Sign-in is still starting. Give it a moment and try again.';
      emit();
      return false;
    }
    const opts = { afterSignInUrl: after, afterSignUpUrl: after };
    try {
      if (mode === 'up') clerk.openSignUp(opts); else clerk.openSignIn(opts);
      return true;
    } catch (e) {
      try {
        if (mode === 'up') clerk.redirectToSignUp(opts); else clerk.redirectToSignIn(opts);
        return true;
      } catch (e2) {
        lastError = e2.message || e.message || 'Could not open sign-in.';
        emit();
        return false;
      }
    }
  }

  const signIn = redirectUrl => openClerk('in', redirectUrl);
  const signUp = redirectUrl => openClerk('up', redirectUrl);

  async function signOut() {
    if (!clerk) return;
    await clerk.signOut();
    emit();
  }

  /** Render Clerk's account management widget into an element. */
  function mountProfile(el) {
    if (!clerk || !el) return false;
    clerk.mountUserProfile(el);
    return true;
  }

  function subscribe(fn) {
    listeners.push(fn);
    // Always call immediately, even before init finishes, so the caller can
    // show a loading state instead of an empty box.
    try { fn(state()); } catch (e) { console.error(e); }
    return () => {
      const i = listeners.indexOf(fn);
      if (i > -1) listeners.splice(i, 1);
    };
  }

  /** Let the UI offer a retry after a failed or timed-out start. */
  async function retry() {
    ready = false;
    lastError = null;
    config = null;
    emit();
    return init();
  }

  return { init, token, state, signIn, signUp, signOut, mountProfile,
           subscribe, syncCustomer, retry };
})();
