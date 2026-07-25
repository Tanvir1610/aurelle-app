# Supabase is live

The Linkeddit project (`jvppierluckzhqkvifvc`, Singapore) now holds the Aurelle
schema. Nothing that was already in the project was touched — every object is
prefixed `aurelle_`.

## What is in there

| | |
|---|---|
| Tables | `aurelle_products`, `aurelle_orders`, `aurelle_order_items`, `aurelle_customers`, `aurelle_admins`, `aurelle_messages`, `aurelle_subscribers` |
| Functions | `aurelle_create_order`, `aurelle_stats` |
| Products seeded | 28 |
| Administrators | `vhoratanvir1610@gmail.com` (owner) |

Row-level security is on for every table with **no policies**, so the anon and
authenticated keys can read nothing. Only the `service_role` key reaches this
data, and it never leaves the server.

## Switch Render over to it

Render → your service → **Environment**:

```
DB_DRIVER=supabase
SUPABASE_URL=https://jvppierluckzhqkvifvc.supabase.co
SUPABASE_SERVICE_KEY=<service_role key>
AUTH_DRIVER=clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
ADMIN_EMAIL=vhoratanvir1610@gmail.com
```

Get the service_role key from Supabase → **Project Settings → API**. It is the
long one under *service_role*, not the anon key.

Once `DB_DRIVER=supabase` is set, orders survive restarts — which is the thing
Render's free plan otherwise takes away from you.

## About the admin password

You asked for `aurelle-admin` as the admin password. It is set as
`ADMIN_PASSWORD` in `.env.example`, and it works — but only under
`AUTH_DRIVER=local`.

**Under Clerk there is no password at all.** That is the point of one-time
codes: the code emailed to you *is* the credential, so there is nothing to
store, leak or reset. Clerk does not accept a password from us, and none can be
set for a user through its API when the instance is configured for OTP.

So the real answer to "who can open the dashboard" is the row in
`aurelle_admins`, which now contains your address. Sign in with
`vhoratanvir1610@gmail.com`, enter the emailed code, and you are in.

If you would rather have a password, set `AUTH_DRIVER=local` and the dashboard
reverts to email + password — but customers then lose sign-in entirely, since
the storefront account area depends on Clerk.

## Adding another administrator

```sql
insert into public.aurelle_admins (email, name, role)
values ('manager@yourshop.com', 'Store manager', 'manager');
```

They sign in through Clerk as usual; their Clerk id binds to the row on first
sign-in.
