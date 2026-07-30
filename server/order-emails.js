/**
 * Aurelle — order emails.
 *
 * Three moments in an order's life get a message. The invoice is attached to
 * the two that confirm a purchase; a cancellation does not need one.
 *
 * Every send is best-effort: a mail failure must never roll back an order or
 * break a checkout that has already taken money. Failures are logged and
 * reported, not thrown at the customer.
 */
import { sendMail, isConfigured, STORE } from './mailer.js';
import { invoicePdf } from './invoice.js';

const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Shared shell so the three messages look like one brand. */
function shell(bodyHtml) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#faf6f0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="background:#faf6f0;padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;background:#fffdfa;border:1px solid #e9e1d6;border-radius:6px;">
    <tr><td style="padding:26px 30px 18px;border-bottom:1px solid #efe8dd;text-align:center;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;letter-spacing:.14em;
                  color:#1a1512;">${esc(STORE.toUpperCase())}</div>
      <div style="font-family:Arial,sans-serif;font-size:8px;letter-spacing:.22em;
                  color:#9b9186;margin-top:5px;">FINE FASHION JEWELLERY</div>
    </td></tr>
    <tr><td style="padding:26px 30px 30px;font-family:Arial,Helvetica,sans-serif;
                   font-size:14px;line-height:1.65;color:#3a352f;">
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding:16px 30px 22px;border-top:1px solid #efe8dd;
                   font-family:Arial,sans-serif;font-size:11px;color:#9b9186;text-align:center;">
      ${esc(STORE)} · 24Kt gold-plated, anti-tarnish, skin-friendly jewellery<br>
      Questions? Just reply to this email.
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

function itemsTable(order) {
  const rows = (order.items || []).map(i => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #f0eae0;">
        ${esc(i.name)}${i.finish ? `<br><span style="color:#9b9186;font-size:12px;">${esc(i.finish)}</span>` : ''}
      </td>
      <td style="padding:9px 0;border-bottom:1px solid #f0eae0;text-align:center;">${i.qty}</td>
      <td style="padding:9px 0;border-bottom:1px solid #f0eae0;text-align:right;">${money(i.line_total)}</td>
    </tr>`).join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="margin:18px 0;font-size:13px;">
    <tr style="color:#9b9186;font-size:10px;letter-spacing:.09em;">
      <td style="padding-bottom:6px;">ITEM</td>
      <td style="padding-bottom:6px;text-align:center;">QTY</td>
      <td style="padding-bottom:6px;text-align:right;">TOTAL</td>
    </tr>
    ${rows}
    <tr><td colspan="2" style="padding-top:12px;">Subtotal</td>
        <td style="padding-top:12px;text-align:right;">${money(order.subtotal)}</td></tr>
    <tr><td colspan="2">Shipping</td>
        <td style="text-align:right;">${order.shipping === 0 ? 'Free' : money(order.shipping)}</td></tr>
    <tr><td colspan="2" style="padding-top:8px;font-weight:bold;font-size:15px;">Total</td>
        <td style="padding-top:8px;text-align:right;font-weight:bold;font-size:15px;">
          ${money(order.total)}</td></tr>
  </table>`;
}

function plainItems(order) {
  return (order.items || [])
    .map(i => `  ${i.name}${i.finish ? ` (${i.finish})` : ''} x${i.qty}  ${money(i.line_total)}`)
    .join('\n');
}

/* ------------------------------------------------------------ drafts -- */
const TEMPLATES = {
  placed: (o) => ({
    subject: `Order Confirmation – Order #${o.ref}`,
    text:
`Dear ${o.first_name},

Thank you for your order with ${STORE}.

Your order #${o.ref} has been successfully placed.

Order Details
  Order ID: ${o.ref}
  Order Date: ${String(o.created_at || '').slice(0, 10)}
  Total Amount: ${money(o.total)}

${plainItems(o)}

Delivering to:
  ${o.address}
  ${o.city} ${o.pincode}

We will notify you once your order is confirmed and processed.
Your invoice is attached.

Regards,
${STORE} Customer Support`,
    html: shell(`
      <p style="margin:0 0 14px;">Dear ${esc(o.first_name)},</p>
      <p style="margin:0 0 6px;">Thank you for your order with ${esc(STORE)}.</p>
      <p style="margin:0 0 4px;">Your order <strong>#${esc(o.ref)}</strong> has been
         successfully placed.</p>
      ${itemsTable(o)}
      <p style="margin:16px 0 4px;color:#9b9186;font-size:11px;letter-spacing:.09em;">DELIVERING TO</p>
      <p style="margin:0 0 18px;font-size:13px;">${esc(o.address)}<br>
         ${esc(o.city)} ${esc(o.pincode)}</p>
      <p style="margin:0 0 6px;">We will let you know as soon as it is confirmed and on its way.</p>
      <p style="margin:0;color:#9b9186;font-size:12px;">Your invoice is attached to this email.</p>`),
    attachInvoice: true,
  }),

  accepted: (o) => ({
    subject: `Your Order #${o.ref} Has Been Confirmed`,
    text:
`Dear ${o.first_name},

Great news. Your order #${o.ref} has been confirmed and is now being processed.

  Order ID: ${o.ref}
  Total Amount: ${money(o.total)}

${plainItems(o)}

Thank you for shopping with us.

Regards,
${STORE} Customer Support`,
    html: shell(`
      <p style="margin:0 0 14px;">Dear ${esc(o.first_name)},</p>
      <p style="margin:0 0 6px;">Great news — your order <strong>#${esc(o.ref)}</strong> has been
         confirmed and is now being processed.</p>
      ${itemsTable(o)}
      <p style="margin:12px 0 0;">Thank you for shopping with us.</p>`),
    attachInvoice: true,
  }),

  cancelled: (o) => ({
    subject: `Order #${o.ref} Has Been Cancelled`,
    text:
`Dear ${o.first_name},

Your order #${o.ref} has been successfully cancelled.

If a payment was already made, the refund will be processed according to our
refund policy.

Regards,
${STORE} Customer Support`,
    html: shell(`
      <p style="margin:0 0 14px;">Dear ${esc(o.first_name)},</p>
      <p style="margin:0 0 12px;">Your order <strong>#${esc(o.ref)}</strong> has been
         successfully cancelled.</p>
      <p style="margin:0;">If a payment was already made, the refund will be processed
         according to our refund policy.</p>`),
    attachInvoice: false,
  }),
};

/** Which order statuses trigger which message. */
export const STATUS_EMAIL = {
  placed: 'placed',
  packed: 'accepted',        // the dashboard marks a paid order "packed"
  cancelled: 'cancelled',
};

/**
 * Send one of the three messages for an order.
 * Never throws — a failed email must not undo a completed order.
 */
export async function sendOrderEmail(kind, order) {
  const make = TEMPLATES[kind];
  if (!make) return { sent: false, reason: `Unknown email type: ${kind}` };
  if (!isConfigured()) return { sent: false, reason: 'Email is not configured' };
  if (!order || !order.email) return { sent: false, reason: 'The order has no email address' };

  const draft = make(order);
  const attachments = [];
  if (draft.attachInvoice) {
    try {
      attachments.push({
        filename: `Invoice-${order.ref}.pdf`,
        type: 'application/pdf',
        content: invoicePdf(order, { store: STORE }),
      });
    } catch (e) {
      // Send the message without the invoice rather than not at all.
      console.error('[mail] invoice generation failed:', e.message);
    }
  }

  try {
    await sendMail({
      to: order.email,
      subject: draft.subject,
      text: draft.text,
      html: draft.html,
      attachments,
    });
    console.log(`[mail] ${kind} sent for ${order.ref}`);
    return { sent: true, kind, to: order.email, invoice: attachments.length > 0 };
  } catch (e) {
    console.error(`[mail] ${kind} failed for ${order.ref}:`, e.message);
    return { sent: false, reason: e.message };
  }
}

/** Render a draft without sending, for previewing in the dashboard. */
export function previewOrderEmail(kind, order) {
  const make = TEMPLATES[kind];
  if (!make) return null;
  const d = make(order);
  return { subject: d.subject, text: d.text, html: d.html, attachInvoice: d.attachInvoice };
}

export const EMAIL_KINDS = Object.keys(TEMPLATES);
