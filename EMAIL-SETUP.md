# Order emails and invoices

## Revoke the passwords you shared

Two Gmail App Passwords have been posted in chat. Each grants full send access
to that mailbox. Revoke both, then generate one fresh:

Google Account → Security → **App passwords** → delete the old ones → create new.

Put the new one in Render's Environment tab. It is not in this codebase —
credentials are read from the environment only.

## Configure

Render → your service → **Environment**:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=vhoratanvir1610@gmail.com
SMTP_PASS=<your NEW app password>
MAIL_FROM=vhoratanvir1610@gmail.com
STORE_NAME=Aurelle
```

Port 587 uses STARTTLS and is the default. Port 465 also works — set
`SMTP_PORT=465` and the client switches to implicit TLS automatically.

Spaces in the App Password are stripped, so pasting it in Google's
four-letter groups is fine.

## Test it

I could not send a real message from my environment — outbound SMTP is
blocked there, so the wire itself is the one part I could not exercise. Two
endpoints let you check it on Render:

```bash
# credentials only, sends nothing
curl -H "Authorization: Bearer <admin token>" \
  https://aurelle-app.onrender.com/api/admin/mail/verify

# an actual message
curl -X POST -H "Authorization: Bearer <admin token>" \
  -H "content-type: application/json" \
  -d '{"to":"you@example.com"}' \
  https://aurelle-app.onrender.com/api/admin/mail/test
```

`verify` reports `{"ok":true}` when Gmail accepts the login. If it returns
`535`, the App Password is wrong or was revoked.

## What sends, and when

| Moment | Email | Invoice |
|---|---|---|
| Customer places an order | Order Confirmation | attached |
| Dashboard marks it packed | Order Confirmed | attached |
| Dashboard cancels it | Order Cancelled | not attached |

Sending is best-effort by design. A mail failure is logged and reported but
never rolls back an order — losing a paid order because Gmail was briefly
unreachable would be far worse than a missing email.

## The invoice

Generated as a PDF per order, with no rendering library: header, billing
address, itemised lines, subtotal, shipping, any handling fee, and the total.
Download one directly:

```
GET /api/admin/orders/AUR123456/invoice
```

Preview a draft without sending:

```
GET /api/admin/orders/AUR123456/email/placed
```

(`placed`, `accepted` or `cancelled`.)

## A note on deliverability

Gmail will send these reliably at low volume. As order numbers grow, messages
from a personal Gmail address to many recipients tend to land in spam, because
the domain has no SPF or DKIM records authorising bulk sending.

When that starts to matter, move to a transactional provider on your own
domain — Brevo, Resend and Amazon SES all have free tiers well above what a
new shop needs. Only `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS` would change.
