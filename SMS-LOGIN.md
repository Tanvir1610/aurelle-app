# Phone sign-in

Customers sign in with their mobile number and a one-time code. No password.

## The flow

```
enter mobile number
  → known number?  code sent, sign in
  → new number?    code sent, then asked for a name
  → verified       returned to the page they were originally heading for
```

A new customer gives a name; email is optional but recommended, since order
confirmations and invoices are sent by email.

## Configure Twilio

```
TWILIO_ACCOUNT_SID=...          # starts "AC…", from the Twilio console
TWILIO_AUTH_TOKEN=...           # used for basic auth, unless an API key is set below
TWILIO_API_KEY=...              # optional, starts "SK…" — a scoped, revocable credential
TWILIO_API_SECRET=...           # required alongside TWILIO_API_KEY
TWILIO_PHONE_NUMBER=+91xxxxxxxxxx   # the Twilio number messages are sent from, E.164 form
SMS_TEMPLATE=Dear User, Your Login OTP {otp} Valid for {mins} Please do not share this OTP.
OTP_TTL_MINUTES=10
```

`{otp}` and `{mins}` are substituted at send time.

Twilio accepts either credential pair for authenticating the request:

- **Account SID + auth token** — the pair shown on the console's main
  dashboard. Simplest to set up.
- **API key + secret** (recommended) — a separate, scoped credential
  created under Account → API keys & tokens. It can be revoked on its own
  without touching the main auth token, so it's the safer choice for a
  server that's deployed somewhere other than your own machine.

If `TWILIO_API_KEY` and `TWILIO_API_SECRET` are both set, they're used. Either
way, `TWILIO_ACCOUNT_SID` is always required — it identifies which account
the sending number belongs to.

**Without `TWILIO_ACCOUNT_SID` the flow still works end to end** — codes are
written to the server log instead of being texted, and returned to the
browser so you can develop and test without spending messages. The moment
Twilio is configured, real SMS is sent and the code stops being exposed.

Keep these values out of source control — set them in your host's
environment variables (Render, Fly, Railway, etc.), never commit a filled-in
`.env`.

## What stops abuse

A six-digit code is only as good as the limits around it.

| Guard | Setting |
|---|---|
| Code lifetime | 10 minutes |
| Wrong attempts | 5, then the code is dead |
| Resend cooldown | 60 seconds |
| Codes per number | 5 per hour |
| Storage | salted SHA-256 hash, never the code itself |
| Reuse | a verified code is consumed immediately |

A leaked database cannot be used to sign in as anybody, because the codes are
not in it.

New customers get a short-lived signed registration ticket after verifying,
rather than being asked for the code a second time — the code is spent on
first use, as it must be.

## Returning to the right page

If someone is asked to sign in from a product page, they land back on that
product page afterwards, not the account page.

Redirects are same-origin only. An open redirect here would let a phishing
link bounce a signed-in customer to another site, so the destination is
validated before use.

## Sessions

A successful sign-in issues a signed token, valid 30 days, stored in the
browser. It carries the phone number and name, and is verified on the server
for every request — a tampered token is rejected.
