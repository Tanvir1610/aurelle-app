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

## Configure the gateway

```
SMS_API_KEY=...
SMS_SENDER=AURELE            # your 6-character DLT sender ID
SMS_ENTITY_ID=...            # your DLT entity registration
SMS_TEMPLATE_ID=...          # the registered template for this message
SMS_TEMPLATE=Dear User, Your Login OTP {otp} Valid for {mins} Please do not share this OTP.
OTP_TTL_MINUTES=10
```

`{otp}` and `{mins}` are substituted at send time. The rest of the text must
match your registered DLT template exactly, or the gateway rejects it.

**Without `SMS_API_KEY` the flow still works end to end** — codes are written
to the server log instead of being texted, and returned to the browser so you
can develop and test without spending messages. The moment a key is present,
real SMS is sent and the code stops being exposed.

## About the credentials you supplied

The key you shared decodes to a username and password for a **ZappDeal**
account, with sender ID `ZPDEAL` and that company's DLT entity and template
registrations.

Two consequences, both practical:

- Customers signing into Aurelle would receive a message signed
  *"Regards, ZappDeal"*.
- Under TRAI's DLT rules the template is bound to that entity and sender. The
  traffic is billed and attributed to them, and a mismatched template is
  rejected outright by most gateways.

Register Aurelle's own sender ID and template with your SMS provider, then set
the four variables above. Nothing in the code needs to change.

Also worth doing: that credential has been posted in a chat thread. Rotate it.

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
