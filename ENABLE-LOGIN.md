# Turning on customer login

Your deployment is showing "Accounts are not switched on" because the Clerk
environment variables are not set on Render. The code is ready; it just needs
the keys.

## Set these on Render

Dashboard → your service → **Environment** → add:

| Key | Value |
|---|---|
| `AUTH_DRIVER` | `clerk` |
| `CLERK_PUBLISHABLE_KEY` | `pk_test_...` from Clerk → API Keys |
| `CLERK_SECRET_KEY` | `sk_test_...` — **regenerate this first** |

Save. Render redeploys automatically. Reload `/account.html` and you get a
**Sign in** and **Create an account** button.

## Turn on the OTP flow in Clerk

Clerk dashboard → **User & Authentication → Email, Phone, Username**:

1. Enable **Email address** as an identifier
2. Set verification to **Email verification code**, not magic link

That is what produces the six-digit code. Clerk renders the entire flow —
code entry, resend timer, rate limiting. We never handle a password.

## Add your storefront to Clerk's allowed origins

Clerk dashboard → **Domains** (or Paths). Add:

```
https://aurelle-app.onrender.com
```

Test instances are permissive, but if sign-in opens and immediately closes,
this is usually why.

## Order history works right now

Customer accounts no longer need Supabase. The SQLite driver has a `customers`
table and orders carry the signed-in shopper's Clerk id, so order history works
on your current deployment.

One caveat you already know: Render's free plan has no persistent disk, so the
database resets on restart. Sign-in keeps working — Clerk holds the identity —
but past orders vanish with the database. Moving to Supabase fixes that.

## What each state looks like

| Situation | What the customer sees |
|---|---|
| Clerk not configured | "Accounts are not switched on" + track-order link |
| Clerk configured, reachable | Sign in / Create account buttons |
| Clerk configured, unreachable | "Could not reach the sign-in service" + Try again |
| Signed in | Name, email, sign out, order history |

None of these is ever a blank page — that was the bug, and there is now a test
suite asserting it in every state.
