# Deploying Aurelle to Render

## Decide this first: free or paid

The database is a SQLite file on disk. That one fact drives the whole decision.

**Render's free web services cannot mount a persistent disk.** Only paid
instances can. On the free plan your database is wiped on every restart,
redeploy, and wake-from-spin-down.

| | Free | Starter (~$7/mo) |
|---|---|---|
| Cost | ₹0 | ~₹600/mo |
| Persistent disk | No | Yes |
| Real orders survive | **No** | Yes |
| Sleeps when idle | After 15 min | Never |
| First hit after sleep | Up to ~1 min | Instant |
| Good for | Demo, portfolio, showing a client | An actual shop |

Free is genuinely fine for showing this to someone — `SEED_DEMO=1` refills the
dashboard with 51 orders on every boot, so it always looks alive. Just know that
if a real visitor places an order, it disappears on the next restart.

If you are taking real money, pay the $7. Losing a customer's order is not a
tradeoff worth ₹600.

There is a third option: keep the free plan and move the data to Render's free
Postgres. That database expires 30 days after creation and needs `server/db.js`
rewritten for Postgres. Ask me if you want that — it's about an hour of work.

---

## Step 1 — Get the code into GitHub

Render deploys from a repository, so the folder has to be on GitHub first.

```bash
cd aurelle-app
git init
git add .
git commit -m "Aurelle storefront and dashboard"
```

Create an empty repo on github.com (no README, no .gitignore — this folder has
one), then:

```bash
git remote add origin https://github.com/YOUR-NAME/aurelle.git
git branch -M main
git push -u origin main
```

The included `.gitignore` keeps `data/*.db` out of the repo, which is what you
want — the database belongs on the server, not in source control.

## Step 2 — Create the web service

1. Sign in at [dashboard.render.com](https://dashboard.render.com)
2. **New → Web Service**
3. Connect your GitHub account, pick the `aurelle` repo
4. Fill in:

| Field | Value |
|---|---|
| Name | `aurelle` (becomes `aurelle.onrender.com`) |
| Region | Singapore (closest to India) |
| Branch | `main` |
| Runtime | Node |
| Build command | *leave empty* |
| Start command | `node server/server.js` |
| Instance type | Free (or Starter) |

The build command really is empty. There are no dependencies to install.

## Step 3 — Environment variables

Under **Environment**, add these before the first deploy:

| Key | Value |
|---|---|
| `NODE_VERSION` | `22.18.0` |
| `ADMIN_EMAIL` | your real email |
| `ADMIN_PASSWORD` | a long passphrase you choose |
| `SESSION_SECRET` | click Generate |
| `SEED_DEMO` | `1` on free, `0` on paid |

`NODE_VERSION` matters — Render may default to an older Node, and `node:sqlite`
needs 22.5 or newer. Without it you get a "Cannot find module 'node:sqlite'"
crash on boot.

`SESSION_SECRET` matters too. Left unset it regenerates on every restart, which
signs you out of the dashboard each time.

Set both `ADMIN_EMAIL` and `ADMIN_PASSWORD`, or neither. Setting only one is
ignored — the boot log tells you which is missing.

Credentials are reconciled on **every** boot, so changing them later and
redeploying works. When you configure a real account, the published
`admin@aurelle.local` default is deleted automatically, so it cannot be used
against your deployment.

## Step 4 — Health check

Under **Settings → Health Check Path**, enter:

```
/api/health
```

Render uses this to know the app is actually up rather than merely running.

## Step 5 — Deploy

Click **Create Web Service**. First deploy takes 1–2 minutes. Watch the log for:

```
AURELLE — server running
Storefront   http://localhost:10000/
Database     /opt/render/project/src/data/aurelle.db
Demo data    51 orders
```

Then visit:

- Storefront → `https://your-app.onrender.com/`
- Dashboard → `https://your-app.onrender.com/admin/`

Sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you set.

---

## If you chose Starter (persistent data)

Two extra steps:

1. **Settings → Disks → Add Disk**
   - Name: `aurelle-data`
   - Mount path: `/var/data`
   - Size: 1 GB

2. **Environment**, add and change:
   - `DATA_DIR` = `/var/data`
   - `SEED_DEMO` = `0`

Redeploy. The log should now read `Database  /var/data/aurelle.db`. Orders now
survive restarts.

To load demo data once on a paid instance, use Render's **Shell** tab:

```bash
node tools/seed-demo.mjs
```

Or wipe and rebuild it with `node tools/seed-demo.mjs --force`.

---

## Using the blueprint instead

`render.yaml` in the project root encodes all of the above. **New → Blueprint**,
point it at the repo, and Render reads the config and prompts only for
`ADMIN_EMAIL` and `ADMIN_PASSWORD`. The file defaults to the free, demo-safe
setup; comments inside explain exactly what to uncomment for the paid disk.

---

## Troubleshooting

**"Cannot find module 'node:sqlite'"** — Node is too old. Set `NODE_VERSION` to
`22.18.0` and redeploy.

**"Cannot find module '/server/db.js'"** — the repo is missing files. Run
`git status` locally; if `server/db.js` shows as untracked, your `.gitignore` is
too aggressive. `git add -f server/db.js` and push.

**Dashboard signs you out constantly** — `SESSION_SECRET` is not set.

**Orders vanish** — expected on free. See the table at the top.

**First load takes a minute** — free instance waking from spin-down. Only the
first request after 15 idle minutes is slow.

**Dashboard login rejects your password** — set `ADMIN_EMAIL` and
`ADMIN_PASSWORD` in Render's Environment tab and redeploy. Credentials are
re-applied on every boot, so this always takes effect. Two things to check:
set *both* variables (one alone is ignored, and the log says so), and note that
emails are stored lowercase, so `Owner@Shop.com` and `owner@shop.com` are the
same account.

If you cannot restart, open Render's **Shell** tab:

```bash
node tools/set-password.mjs                        # list accounts
node tools/set-password.mjs you@shop.com NewPass1  # reset one
```

On a free instance the shell change is lost at the next restart — put the
credentials in the environment variables instead.

---

## Before real customers

Deploying is not the same as being ready to trade:

1. **Payments.** Checkout records a method but takes no money. Razorpay next.
2. **Rate limiting.** Nothing throttles login attempts. Put Cloudflare in front.
3. **Real content.** The 28 products and all reviews are invented placeholders.
   Publishing invented reviews as genuine testimonials is prohibited under
   India's Consumer Protection (E-Commerce) Rules.
4. **Legal pages.** Terms, privacy, refund policy and a working contact address
   are mandatory for Indian e-commerce. The footer links exist; the pages don't.
5. **Backups.** On paid, `data/aurelle.db` is the whole business. Copy it off
   the disk on a schedule.
