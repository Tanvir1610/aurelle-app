# Supabase + Clerk setup

The app now runs on either stack. Switch with two environment variables:

| | Development | Production |
|---|---|---|
| `DB_DRIVER` | `sqlite` | `supabase` |
| `AUTH_DRIVER` | `local` | `clerk` |

Nothing else changes. Same pages, same API, same dashboard.

---

## 1. Rotate your Clerk secret key first

The secret key you pasted into chat should be considered compromised. Clerk
dashboard → **API Keys** → regenerate the secret key. Then put it in `.env`,
which is git-ignored:

```bash
cp .env.example .env
```

The publishable key (`pk_test_...`) is safe in a browser by design. The secret
key (`sk_test_...`) is not — anyone holding it can act as any user in your
Clerk instance.

## 2. Wake the Supabase project

**Linkeddit** (`jvppierluckzhqkvifvc`, Singapore) is currently paused, which
Supabase does to free projects after inactivity. Open the project in the
dashboard and click **Resume**. It takes a minute or two.

Tell me when it's up and I'll apply the migration. Or do it yourself: paste
`server/schema.sql` into the SQL Editor and run it.

Everything is prefixed `aurelle_` so it cannot collide with Linkeddit's own
tables:

```
aurelle_products     aurelle_orders       aurelle_order_items
aurelle_customers    aurelle_admins       aurelle_messages
aurelle_subscribers
```

Plus two Postgres functions: `aurelle_create_order` and `aurelle_stats`.

## 3. Get the Supabase keys

Project Settings → **API**:

- **Project URL** → `SUPABASE_URL`
- **service_role** key → `SUPABASE_SERVICE_KEY`

Use the service_role key, not the anon key. Every table has row-level security
on with no policies, so anon and authenticated roles can read nothing at all.
Only service_role gets through, and it never leaves the server — all customer
access is brokered by our API after Clerk verifies who is calling.

## 4. Configure Clerk for OTP

Clerk dashboard → **User & Authentication → Email, Phone, Username**:

- Enable **Email address** as an identifier
- Under verification, choose **Email verification code** (not magic link)

That gives you the six-digit code flow. Clerk renders the whole thing — code
entry, resend timer, rate limiting. We never handle a password.

## 5. Run it

```bash
DB_DRIVER=supabase AUTH_DRIVER=clerk \
SUPABASE_URL=https://jvppierluckzhqkvifvc.supabase.co \
SUPABASE_SERVICE_KEY=eyJ... \
CLERK_PUBLISHABLE_KEY=pk_test_... \
CLERK_SECRET_KEY=sk_test_... \
ADMIN_EMAIL=you@yourshop.com \
node server/server.js
```

On first boot the catalogue seeds into Supabase and `ADMIN_EMAIL` is added to
`aurelle_admins`.

---

## How authentication works

Clerk owns identity. Our database owns permission. They are deliberately
separate.

```
Browser ──► Clerk (OTP)  ──►  session JWT (RS256)
   │
   └──► our API ──► verify JWT against Clerk's JWKS   (server/auth-clerk.js)
                 └► look up email in aurelle_admins   (permission check)
```

Signing in with Clerk gets you a *customer* account. It grants nothing on the
dashboard. To become an administrator your email must be in `aurelle_admins` —
so a stranger signing up on your storefront cannot reach `/admin/`, and the
dashboard returns 403 with an explanation rather than silently failing.

Tokens are verified with `node:crypto` against Clerk's published keys. No Clerk
SDK on the server, so the dependency count is still zero.

### Adding another administrator

```sql
insert into aurelle_admins (email, name, role)
values ('manager@yourshop.com', 'Store manager', 'manager');
```

They sign in with Clerk as normal; their Clerk id binds to the row on first
sign-in.

## What customers get

- Sign in or up with an emailed code, from the header or `/account.html`
- Order history at `/account.html`, scoped to their own orders only
- Orders placed while signed in link to their account automatically

Guest checkout still works. Signing in is never forced.

---

## Order integrity

`aurelle_create_order` is a Postgres function, so pricing, stock checks,
inserts and decrements happen inside one transaction with `SELECT … FOR UPDATE`
on every product row. Two shoppers cannot both buy the last piece, and a
half-written order cannot survive a crash.

Prices come from the database. The browser sends slugs and quantities, never
amounts — a tampered client cannot buy anything at a price it invents.

## Falling back

Delete `DB_DRIVER` and `AUTH_DRIVER` (or set them to `sqlite` and `local`) and
the app reverts to the self-contained build: local file database, password
login, no external services. Useful for development on a plane.
