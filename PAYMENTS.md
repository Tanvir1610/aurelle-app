# Payments — Cashfree

## If the payment page will not open

The commonest cause by far is credentials pointed at the wrong host. Cashfree
issues **separate** keys for sandbox and production, and each host rejects the
other's:

```
curl https://aurelle-app.onrender.com/api/config
```

If that shows `"mode":"sandbox"` while your key is `cfsk_ma_prod_…`, that is
the problem. Two ways out:

- **Testing** — get sandbox credentials from Cashfree (Developers → API Keys →
  switch the dashboard toggle to Sandbox) and use those with
  `CASHFREE_ENV=sandbox`.
- **Going live** — set `CASHFREE_ENV=production` and keep the production key.

The server now refuses early on this mismatch and says which side is wrong,
both in the boot log and on the checkout page, rather than failing with an
opaque gateway error.

## The App ID is a server credential

Cashfree's App ID (`x-client-id`) authenticates order creation together with
the secret. It is **not** a public identifier like a Stripe publishable key —
the browser only ever needs the `payment_session_id` our server returns.

It is no longer included in `/api/config`. If your App ID has been public,
regenerate both halves of the pair.

## Rotate the key you shared

The secret you pasted in chat is a **production** key (`cfsk_ma_prod_…`).
Anyone holding it can create charges against your merchant account and read
your transaction data. Treat it as compromised:

Cashfree dashboard → **Developers → API Keys** → regenerate the secret key.

It is not in this codebase. Credentials are read from the environment only.

## Switch payments on

Render → your service → **Environment**:

```
CASHFREE_APP_ID=<your App ID>
CASHFREE_SECRET_KEY=<your NEW secret key>
CASHFREE_ENV=sandbox
PUBLIC_URL=https://aurelle-app.onrender.com
```

**Leave it on sandbox until you have taken a test payment end to end.**
Production is deliberately opt-in — without `CASHFREE_ENV=production` the
server talks to the sandbox, so a half-finished deploy cannot take real money.

The boot log tells you which mode is live:

```
Payments     sandbox
```

If your key and environment disagree — a production key with sandbox mode, or
the reverse — the log says so explicitly. That mismatch otherwise fails only
at the moment a customer tries to pay.

## Add the webhook

Cashfree dashboard → **Developers → Webhooks** → add:

```
https://aurelle-app.onrender.com/api/payments/webhook
```

Subscribe to payment success events. The webhook is the reliable path: a
shopper who pays and then closes the tab still gets their order confirmed,
because Cashfree tells us directly.

## How a payment flows

```
checkout  →  our server prices the order and writes it
          →  POST /api/payments/session   (amount from OUR record)
          →  Cashfree returns a payment_session_id
          →  Cashfree's SDK takes over the page
          →  shopper pays
          →  returns to /confirmation.html?ref=AUR123456
          →  we ask Cashfree what actually happened
          →  webhook confirms independently
```

Three things worth knowing about that flow:

**The browser never sends an amount.** It sends an order reference. The
server looks up what it charged and asks Cashfree for exactly that. A
tampered client cannot buy a ₹5,000 set for ₹1.

**A redirect is not proof of payment.** The confirmation page asks our server,
which asks Cashfree. Until that answers, the page says nothing about payment
status. If the amounts do not match, the order is not advanced and the
mismatch is logged.

**Webhooks must be signed.** Cashfree signs each one as
`base64(HMAC-SHA256(timestamp + body, secret))`. Unsigned and forged calls are
refused with 401. The comparison is constant-time so the signature cannot be
guessed byte by byte.

## Cash on delivery

Still works and skips the gateway entirely. Choosing it at checkout goes
straight to the confirmation page.

## Going live

1. Take a sandbox payment end to end and confirm the order reaches **packed**
   in the dashboard.
2. Set `CASHFREE_ENV=production` and swap in the live key.
3. Test with a small real payment — ₹1 — and refund it.

Two things that are still your responsibility before trading: your refund and
returns policy must be published on the site (mandatory for Indian
e-commerce), and Cashfree will want your business verification completed
before settling funds.

## What the shopper chooses

The checkout now offers two options, not four:

- **Pay online** — UPI, card, net banking or wallet
- **Cash on delivery** (+₹49 handling)

Cashfree presents its own method list once the shopper is handed over, so
listing UPI and cards separately on our form was misleading — whatever they
picked was ignored a moment later.

The ₹49 handling fee is applied **by the server**, from the payment method on
the order record. A browser cannot talk its way out of it, and the amount the
gateway is asked for always matches what we recorded.
