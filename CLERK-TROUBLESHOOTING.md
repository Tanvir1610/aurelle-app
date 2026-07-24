# When the sign-in button does nothing

The button now tells you what went wrong instead of failing silently. Deploy
the current build and reload `/admin/` — you will get one of these.

## "Preparing sign-in…" (disabled)

Clerk is still starting. It becomes clickable within a few seconds. If it never
does, you land in the next case.

## "Sign-in unavailable" with a reason

Clerk's script could not load or start. Almost always one of four things.

### 1. This site is not registered in Clerk

The most common cause. Clerk refuses to run on origins it does not know.

Clerk dashboard → **Domains** (development instances may call it *Paths* or
*Allowed origins*). Add:

```
https://aurelle-app.onrender.com
```

Save, hard-reload the page (Ctrl+Shift+R).

### 2. The keys belong to a different Clerk instance

Your publishable key decodes to:

```
credible-blowfish-34.clerk.accounts.dev
```

If the Clerk dashboard you are configuring shows a different instance name,
the server has keys from another project. Copy both keys again from
**API Keys** in the instance you actually want, and make sure
`CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are from the *same* one.

### 3. A browser extension is blocking it

uBlock Origin, Privacy Badger and similar tools sometimes block
`*.clerk.accounts.dev`. Test in an incognito window with extensions disabled.
If it works there, allow-list the domain.

### 4. The environment variables are not actually set

Check Render → Environment for all three:

```
AUTH_DRIVER=clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Confirm from your own machine:

```
curl https://aurelle-app.onrender.com/api/config
```

You want `"auth":"clerk"` and `"enabled":true`. If you see `"auth":"local"` or
`"enabled":false`, the server does not have the keys.

---

## Read the browser console

Fastest way to identify it. Open DevTools (F12) → **Console**, reload, and look
for a line mentioning `clerk`. Common ones:

| Message | Meaning |
|---|---|
| `Failed to load resource ... clerk.accounts.dev` | Blocked or unregistered — cases 1 or 3 |
| `Invalid publishable key` | Case 2 |
| `net::ERR_BLOCKED_BY_CLIENT` | Case 3, an extension |
| Nothing at all about Clerk | Case 4, keys not set |

Also check the **Network** tab for `clerk.browser.js`. Status 200 means it
loaded; blocked or 404 points at cases 1–3.

---

## Turn on the OTP flow

Once the script loads, the modal appears but needs Clerk configured to use
codes rather than links:

Clerk dashboard → **User & Authentication → Email, Phone, Username**

1. Enable **Email address** as an identifier
2. Set verification to **Email verification code**, not magic link

## Signing in still refuses you

If sign-in succeeds but the dashboard says you are not an administrator, the
server's `ADMIN_EMAIL` does not match the address you signed in with. Set:

```
ADMIN_EMAIL=vhoratanvir1610@gmail.com
```

Restart. It is re-applied on every boot, and the boot log confirms it:

```
Admin account created for vhoratanvir1610@gmail.com
```
