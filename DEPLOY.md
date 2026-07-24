# Getting Aurelle live

## Run it locally first

```bash
cd aurelle-storefront
node server/server.js
```

Node 22.5 or newer is required (the database uses Node's built-in SQLite).
Check with `node -v`. There is **nothing to install** — no `npm install`, no
dependencies at all.

You get:

| | |
|---|---|
| Storefront | http://localhost:3000/ |
| Dashboard | http://localhost:3000/admin/ |
| API health | http://localhost:3000/api/health |

First launch seeds 28 products and prints a dashboard login:

```
email     admin@aurelle.local
password  aurelle-admin
```

**Change that before it touches the internet:**

```bash
ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='a-long-passphrase' node server/server.js
```

### Try the loop end to end

1. Buy something on the storefront and complete checkout.
2. Copy the order reference from the confirmation page.
3. Open `/admin/`, sign in — the order is in **Orders**, revenue has moved on
   **Overview**, and stock has dropped on **Products**.
4. Change the order status to *Shipped*.
5. Paste the reference into **Track order** on the storefront. The customer
   view reflects your change.

### Run the tests

```bash
npm install jsdom          # test-only dependency
node tools/smoke-test.mjs        # 36 — every page renders
node tools/interaction-test.mjs  # 12 — filters, cart, validation
node tools/api-test.mjs          # 50 — every endpoint, auth, validation
node tools/integration-test.mjs  # 19 — UI → HTTP → database → dashboard
```

---

## Deploying to a real URL

The app is one Node process serving both the API and the static files, so
anywhere that runs Node will host the whole thing.

### Important: SQLite needs a real disk

The database is a file at `data/aurelle.db`. Platforms with ephemeral
filesystems (Vercel, Netlify Functions, Cloudflare Workers, Heroku's default
dyno) **will lose your orders on every restart**. Either:

- deploy somewhere with a persistent volume (below), or
- move to Postgres — the only file to change is `server/db.js`.

### Render — see RENDER.md for the full walkthrough

**Correction worth reading:** Render's *free* web services cannot mount a
persistent disk — only paid instances can. On the free plan a SQLite database is
wiped on every restart, redeploy and wake-from-spin-down.

- **Free** — fine for a demo. Set `SEED_DEMO=1` and the dashboard refills with
  51 orders on each boot. Real customer orders will not survive.
- **Starter (~$7/mo)** — attach a disk at `/var/data`, set `DATA_DIR=/var/data`
  and `SEED_DEMO=0`. Orders persist properly.

Step-by-step instructions, environment variables and troubleshooting are in
**RENDER.md**. `render.yaml` encodes the same config as a blueprint.

### Railway / Fly.io

Both detect Node automatically. Set the same environment variables and attach a
volume mounted at `data/`. Fly: `fly launch` then `fly volumes create data`.

### Your own VPS

```bash
sudo apt install nodejs   # must be 22.5+
git clone <your-repo> && cd aurelle-storefront
npm install -g pm2
ADMIN_PASSWORD='...' SESSION_SECRET='...' pm2 start server/server.js --name aurelle
pm2 save && pm2 startup
```

Put nginx or Caddy in front for TLS. Caddy needs two lines:

```
shop.yourdomain.com {
  reverse_proxy localhost:3000
}
```

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Port to listen on | `3000` |
| `ADMIN_EMAIL` | Dashboard login | `admin@aurelle.local` |
| `ADMIN_PASSWORD` | Dashboard password | `aurelle-admin` |
| `SESSION_SECRET` | Signs login tokens | random each boot |
| `DATA_DIR` | Where aurelle.db lives | `./data` |
| `SEED_DEMO` | Refill demo data on boot | off |

Set `SESSION_SECRET` in production. Left unset it regenerates on every restart,
which signs everyone out.

---

## Before you take real money

This is a working application, not yet a compliant shop. Outstanding:

1. **Payments.** Checkout records the chosen method but takes no money. Razorpay
   is the usual choice for INR; the order payload already carries everything its
   API needs.
2. **HTTPS.** Login tokens over plain HTTP can be stolen. Every host above gives
   free TLS.
3. **Rate limiting.** Nothing throttles login attempts yet. Put Cloudflare in
   front, or add a per-IP counter to `server.js`.
4. **Real content.** The 28 products and all six reviews are invented
   placeholders. Publishing invented reviews as genuine customer testimonials is
   prohibited under India's Consumer Protection (E-Commerce) Rules — replace or
   remove that section.
5. **Legal pages.** Terms, privacy, refund policy and contact details are
   mandatory for Indian e-commerce; the footer links exist but the pages are stubs.
6. **Backups.** `data/aurelle.db` is your entire business. Copy it somewhere
   nightly.

---

## Architecture

```
Browser ──► server/server.js ──► server/db.js ──► data/aurelle.db
              │                                     (SQLite)
              ├── /            storefront (static)
              ├── /admin/      dashboard (static)
              └── /api/*       JSON API
```

`assets/js/api.js` is the bridge. When the API answers it merges live catalogue
data into `AU_DATA`; when it does not, every page falls back to the bundled data
and keeps working. Open `index.html` as a plain file with no server running and
the storefront still browses — it just cannot take orders.
