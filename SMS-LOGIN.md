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

## Configure the SMS gateway

Aurelle sends OTPs through the vas.themultimedia.in bulk SMS gateway, a
DLT-registered Indian SMS provider.

```
SMS_API_KEY=...                 # from the gateway dashboard
SMS_SENDER=ZPDEAL               # approved 6-character DLT sender ID
SMS_ENTITY_ID=...               # DLT entity ID
SMS_TEMPLATE_ID=...             # DLT template ID for this exact message
SMS_TEMPLATE=Dear User, Your Login OTP {#var#} Valid for {#var#} Please do not share this OTP.
SMS_GATEWAY_URL=https://vas.themultimedia.in/domestic/sendsms/bulksms_v2.php
OTP_TTL_MINUTES=10
```

The two `{#var#}` placeholders are filled in order at send time: the code,
then the validity window (e.g. "10 minutes").

DLT rules mean the message text has to match what's registered
byte-for-byte outside those two placeholders — carriers silently drop
anything that doesn't. That includes any brand or company name written into
the template itself, which does not need to match `SMS_SENDER` or the
storefront's own name.

`SMS_API_KEY`, `SMS_SENDER`, `SMS_ENTITY_ID` and `SMS_TEMPLATE_ID` are all
required together. If the gateway returns an authorization error (Twilio's
old error 70051 and similar codes from other gateways both mean the same
thing), it's almost always one of these four not being linked to the others
on the gateway's own dashboard — double-check the sender ID, entity ID and
template ID are all associated with the API key there before assuming the
code is wrong.

**Without `SMS_API_KEY` the flow still works end to end** — codes are
written to the server log instead of being texted, and returned to the
browser so you can develop and test without spending messages. The moment
the gateway is configured, real SMS is sent and the code stops being
exposed.

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
