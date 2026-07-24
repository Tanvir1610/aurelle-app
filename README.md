# Aurelle — Storefront + Dashboard

A full e-commerce application built on the **Aurelle Design System**:
14-page storefront, JSON API, SQLite database and an admin dashboard.

**Zero npm dependencies.** The server is pure `node:http`; the database is
Node's built-in SQLite. Requires Node 22.5+.

---

## Run it

```bash
cd aurelle-storefront
node server/server.js
```

| | |
|---|---|
| Storefront | http://localhost:3000/ |
| Dashboard | http://localhost:3000/admin/ |

First launch seeds the catalogue and prints a dashboard login
(`admin@aurelle.local` / `aurelle-admin`). Override with `ADMIN_EMAIL` and
`ADMIN_PASSWORD`.

Want the dashboard populated? `node tools/seed-demo.mjs` creates 51 orders
across 14 days, 8 enquiries and 15 subscribers. Add `--force` to rebuild.

Going live: **RENDER.md** for Render specifically, **DEPLOY.md** for other hosts.

The storefront also runs with no server at all — open `index.html` directly and
it falls back to the bundled catalogue.

## Test it

```bash
npm install jsdom                # test-only
node tools/smoke-test.mjs        # 36 — every page renders
node tools/interaction-test.mjs  # 12 — filters, cart, validation
node tools/api-test.mjs          # 50 — endpoints, auth, validation, traversal
node tools/integration-test.mjs  # 19 — UI → HTTP → database → dashboard
```

117 assertions, all passing.

---

## The dashboard

At `/admin/`. Token auth, scrypt-hashed passwords, HMAC-signed sessions.

- **Overview** — revenue, average order value, orders needing action, 14-day
  revenue chart, best sellers, low-stock warnings
- **Orders** — search and filter, expand line items, change status (the
  customer's tracking page updates immediately)
- **Products** — full CRUD, live on the storefront the moment you save
- **Messages** — contact-form enquiries, mark handled
- **Subscribers** — newsletter list, CSV export

## API

```
GET    /api/health
GET    /api/catalogue              drop-in replacement for AU_DATA
GET    /api/products               ?cat= &metal= &max= &q=
GET    /api/products/:slug
POST   /api/orders                 server-priced, stock-checked
GET    /api/orders/:ref            customer tracking
POST   /api/newsletter
POST   /api/contact
POST   /api/auth/login
GET    /api/auth/me                                          [auth]
GET    /api/admin/stats                                      [auth]
GET    /api/admin/orders           ?status= &q=              [auth]
PATCH  /api/admin/orders/:ref                                [auth]
GET    /api/admin/products                                   [auth]
POST   /api/admin/products         create or update          [auth]
DELETE /api/admin/products/:slug   archive                   [auth]
GET    /api/admin/messages                                   [auth]
PATCH  /api/admin/messages/:id                               [auth]
GET    /api/admin/subscribers                                [auth]
```

Orders are priced **server-side** from database prices — the browser cannot
influence what anything costs.

---

## What is here

**14 pages.** Home, Collection (PLP), Product (PDP), Cart, Checkout,
Confirmation, Wishlist, About, Contact, Stores, FAQ, Journal, Track Order, Account.

**Static content** — all copy, product data, reviews, store list and FAQs live in
`assets/js/data.js`.

**Dynamic behaviour, all working client-side:**

| Feature | Where |
|---|---|
| Rotating announcement bar | `ui.js` |
| Sticky header + hover mega-menu (tap-to-open on mobile) | `ui.js` |
| Auto-playing hero carousel, pauses on hover, respects reduced-motion | `app.js` |
| PLP: category/price/metal/occasion filters with live facet counts | `app.js` |
| PLP: search, 6 sort modes, active-filter chips, pagination | `app.js` |
| PDP: gallery, finish swatches, quantity stepper, accordions | `app.js` |
| Cart: add/remove/quantity, slide-in drawer, free-shipping progress | `cart.js` |
| Wishlist with persistent state | `cart.js` |
| Checkout with real field validation (email, 10-digit phone, 6-digit pincode) | `app.js` |
| Toasts, scroll reveals, keyboard focus, mobile nav | `ui.js` |

State persists via `localStorage`, with an automatic in-memory fallback so it
never throws in private mode or a sandboxed frame.

---

## Content & imagery — read this before launch

This storefront follows the **structure and UX patterns** of a modern Indian
jewellery storefront: announcement bar → mega-menu → hero → category grid →
product rails → budget tiles → bestsellers → editorial band → store locator →
USP strip → reviews → newsletter → footer.

**Nothing was copied from any live site.** All copy, product names, prices,
reviews and imagery here are original placeholder content written for Aurelle.
Lifting a competitor's product photography or marketing copy would expose you to
copyright and passing-off claims the moment you go live — so this ships clean and
yours to own.

Replace the placeholder catalogue with your real products and photography before
launch. The reviews in `data.js` are invented; publishing invented reviews as
real customer testimonials is prohibited under India's Consumer Protection
(E-Commerce) Rules — swap them for genuine ones or remove the section.

### Imagery

Ships with **78 original SVG illustrations** generated by
`tools/generate_art.py` — gold line-art jewellery on warm tinted grounds, keyed
to the brand tokens. No licences, no external requests, works offline.

To upgrade to real photography:

```bash
# free key from https://www.pexels.com/api/
PEXELS_API_KEY=xxx node tools/fetch-media.mjs
PEXELS_API_KEY=xxx node tools/fetch-media.mjs --video   # + hero video
```

This downloads licence-free imagery, writes credits to
`assets/img/stock/CREDITS.json`, and rewires `assets/js/media.js`. Every image
falls back to the generated art if a remote URL fails, so a dead CDN never leaves
a broken tile. Revert by setting `SOURCE = 'local'`.

For your own photography: drop files in `assets/img/`, map them in the `REMOTE`
block of `media.js`. That is the only file that needs to change.

---

## Phase 2: the backend

The frontend is deliberately structured so this is additive. Three integration
points, each already marked `Backend hook` in the source:

**1. Catalogue** — replace the `AU_DATA` literal in `data.js` with:
```js
window.AU_DATA = await (await fetch('/api/catalogue')).json();
```
Keep the shape identical and every page keeps working untouched.

**2. Orders** — `app.js` → `checkout()`. Replace the local reference generator with
`POST /api/orders`, then redirect to `confirmation.html?ref=` the server's ID.

**3. Auth, tracking, contact** — `account()`, `track()`, `contact()` in `app.js`
each have one stubbed call.

Suggested API surface:

```
GET  /api/products              list + filters
GET  /api/products/:slug        single product
POST /api/cart                  server-side cart (optional; client cart works today)
POST /api/orders                create order
GET  /api/orders/:ref           tracking
POST /api/auth/login            sign in
POST /api/newsletter            list signup
POST /api/contact               enquiry
```

Payments in India: Razorpay is already a connector you have available; the
checkout form collects everything its order API needs.

---

## Structure

```
aurelle/
├── index.html … account.html      14 pages
├── assets/
│   ├── css/tokens.css             design-system tokens (unmodified)
│   ├── css/site.css               layout & components
│   ├── js/data.js                 content layer  → becomes the API
│   ├── js/media.js                image/video registry
│   ├── js/cart.js                 cart & wishlist state
│   ├── js/ui.js                   header, footer, drawer, cards, toasts
│   ├── js/app.js                  page controllers
│   └── img/                       78 generated SVGs
└── tools/
    ├── generate_art.py            regenerate artwork
    ├── fetch-media.mjs            pull licence-free stock
    ├── smoke-test.mjs             page render tests
    └── interaction-test.mjs       behaviour tests
```

## Design system adherence

Every colour, space, radius, shadow and easing value comes from
`assets/css/tokens.css` via CSS custom properties. No raw hex in `site.css`
except `rgba()` scrims. Cormorant Garamond for display, Jost for UI, uppercase
wide-tracked eyebrows and buttons, restrained radii, image-zoom hovers, INR with
Indian digit grouping — per the design system readme.
