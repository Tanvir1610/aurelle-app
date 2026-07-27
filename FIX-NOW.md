# Two steps to a working dashboard

## Step 1 — remove the database from git (do this first)

Your repo contains `data/aurelle.db`. Every deploy overwrites the live
database with that file, and the committed copy lists exactly one
administrator:

```
admin@aurelle.local
```

Not your Gmail. So whatever the server sets up on boot is discarded the next
time you push. This is the single biggest reason the dashboard keeps refusing
you.

```bash
git rm --cached data/aurelle.db data/aurelle.db-shm data/aurelle.db-wal
git commit -m "Stop tracking the database"
git push
```

`.gitignore` already excludes them; `git rm --cached` is needed because they
were committed before that rule existed.

## Step 2 — set these on Render

Dashboard → your service → **Environment**:

```
ADMIN_EMAIL=vhoratanvir1610@gmail.com
ADMIN_PASSWORD=Aurelle@2026
AUTH_DRIVER=clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Deploy. The boot log should show:

```
Admin account created for vhoratanvir1610@gmail.com
```

---

## What changed in the code

The dashboard now accepts **two** ways in, and you only need one to work.

**Password** — email and password, straight to the dashboard. No Clerk
involved, so a misconfigured or unreachable Clerk cannot lock you out. This is
the reliable route.

**Email code** — Clerk's one-time code, as before.

Both appear on `/admin/` when both are configured. Customers still use Clerk on
the storefront; nothing changes for them.

Your credentials for the password route:

```
vhoratanvir1610@gmail.com
Aurelle@2026
```

A password session is stored for the tab and takes precedence over Clerk, so
once you are in, you stay in until you sign out or close the tab.

---

## Optional, but worth it: move to Supabase

While the database is a file on Render's free plan, it resets on every restart.
The Supabase project is already set up with your admin record:

```
DB_DRIVER=supabase
SUPABASE_URL=https://jvppierluckzhqkvifvc.supabase.co
SUPABASE_SERVICE_KEY=<service_role key from Settings → API>
```

With that set, orders and products survive restarts and the committed-database
problem disappears permanently.

Note: password sign-in needs `DB_DRIVER=sqlite`, because the password lives in
the local admins table. On Supabase, use the Clerk code route — your email is
already in `aurelle_admins` there.

---

## What the dashboard gives you

| Panel | What you can do |
|---|---|
| Overview | Revenue with week-on-week trend, 14-day chart, order funnel, best sellers, activity feed, low stock with one-click restock |
| Orders | Search and filter, click any row for full detail — items, address, payment — and change status inline |
| Products | Add and edit jewellery: artwork picker, occasions, finishes, price, stock, badge, with a live storefront preview |
| Customers | Account holders and guest buyers with order counts and lifetime spend |
| Messages | Contact-form enquiries, mark handled |
| Subscribers | Newsletter list with CSV export |
| Access | Add or remove administrators |
