# If sign-in bounces you back to the login card

That loop had a specific cause, now fixed in the code. Deploy this build first,
then — if it still refuses — the dashboard will tell you exactly why instead of
silently returning you to the login screen.

## What was happening

Clerk's **default session token does not contain an email address**. It carries
`sub` (the user id), `iss`, `exp` and little else. So the server asked Clerk's
Backend API for the profile, which requires `CLERK_SECRET_KEY`.

If that key is wrong, stale or missing, the call failed. The old code treated
that as "no valid session" and returned **401**. The dashboard treats 401 as
*session expired* and signs you out — turning a configuration problem into an
endless loop.

Three things changed:

1. A failed profile lookup no longer invalidates a session that has already
   been cryptographically verified against Clerk's public keys.
2. The server returns **403 with a reason**, never a bare 401, when someone is
   signed in but not admitted.
3. The dashboard never signs you out on a 401 under Clerk. It shows what went
   wrong and offers **Try again**, keeping your Clerk session alive.

## Recommended: put the email in the session token

This removes the Backend API from the sign-in path entirely — faster, and
immune to a bad secret key.

Clerk dashboard → **Sessions** → *Customize session token* → Edit, then use:

```json
{
  "email": "{{user.primary_email_address}}"
}
```

Save. The server reads `claims.email` directly and never calls the Backend API
during sign-in.

## Check your Render environment

```
AUTH_DRIVER=clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...          ← must match the same Clerk instance
ADMIN_EMAIL=vhoratanvir1610@gmail.com
```

Both Clerk keys must come from the *same* instance. Your publishable key
decodes to `credible-blowfish-34.clerk.accounts.dev` — if the dashboard you
copied the secret from shows a different instance, that is the mismatch.

Verify the server sees them:

```
curl https://aurelle-app.onrender.com/api/config
```

Expect `"auth":"clerk"`, `"enabled":true`, and `"adminCount":1`. If
`adminCount` is `0`, `ADMIN_EMAIL` is not set and nobody can get in.

## What you will now see instead of a loop

| Situation | Screen |
|---|---|
| Profile unreadable from Clerk | "your email could not be read from Clerk" + the underlying error + Try again |
| Signed in, not on the list | "Not an administrator", showing which address signed in |
| No administrators configured | "No administrators configured" + how to set `ADMIN_EMAIL` |
| All correct | The dashboard |

Every one of those keeps your Clerk session, so **Try again** works the moment
the server config is corrected — no need to sign in twice.
