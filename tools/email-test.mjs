/**
 * Aurelle — order email and invoice tests.
 *
 * SMTP is unreachable from this environment, so these cover everything up to
 * the wire: that drafts render with the right details, that a mail failure
 * cannot break an order, and that the invoice PDF is structurally valid.
 */
import { previewOrderEmail, sendOrderEmail, EMAIL_KINDS } from '../server/order-emails.js';
import { invoicePdf } from '../server/invoice.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; console.log(`ok    ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${e ? '  → ' + e : ''}`); } };

const dir = mkdtempSync(join(tmpdir(), 'aurelle-mail-'));
process.env.DATA_DIR = dir;
process.env.STORE_NAME = 'Aurelle';
const DB = await import('../server/db.js');
DB.seedIfEmpty();

const order = DB.createOrder({
  firstName: 'Tanvir', lastName: 'Vhora', email: 'buyer@example.com',
  phone: '9876543210', address: '204 Sunrise Arcade, CG Road, Navrangpura',
  city: 'Ahmedabad', pincode: '380009', payment: 'Online',
  items: [{ slug: 'ad-solitaire-radiance', qty: 2, finish: 'Silver' },
          { slug: 'ad-heart-amara', qty: 1 }],
});

console.log('\n── all three drafts exist ──────────────────────');
{
  t('placed, accepted and cancelled', EMAIL_KINDS.length === 3, EMAIL_KINDS.join(', '));
  for (const k of EMAIL_KINDS) t(`  ${k} renders`, !!previewOrderEmail(k, order));
}

console.log('\n── subjects match the specified wording ────────');
{
  t('order placed', previewOrderEmail('placed', order).subject ===
     `Order Confirmation – Order #${order.ref}`);
  t('order accepted', previewOrderEmail('accepted', order).subject ===
     `Your Order #${order.ref} Has Been Confirmed`);
  t('order cancelled', previewOrderEmail('cancelled', order).subject ===
     `Order #${order.ref} Has Been Cancelled`);
}

console.log('\n── the details are actually in the message ─────');
{
  const d = previewOrderEmail('placed', order);
  t('addresses the customer by name', d.text.includes('Dear Tanvir'));
  t('quotes the order reference', d.text.includes(order.ref));
  t('states the total', d.text.includes('3,397'), d.text.match(/₹[\d,]+/g)?.join(' '));
  t('lists every item', order.items.every(i => d.text.includes(i.name)));
  t('shows the delivery address', d.text.includes('380009'));
  t('has an HTML part as well as plain text', d.html.includes('<html') && d.text.length > 100);
}

console.log('\n── the invoice is attached where it should be ──');
{
  t('placed carries the invoice', previewOrderEmail('placed', order).attachInvoice === true);
  t('accepted carries the invoice', previewOrderEmail('accepted', order).attachInvoice === true);
  t('cancelled does not', previewOrderEmail('cancelled', order).attachInvoice === false);
}

console.log('\n── the invoice PDF is well formed ─────────────');
{
  const pdf = invoicePdf(order, { store: 'Aurelle' });
  const raw = pdf.toString('latin1');
  t('it is a PDF', raw.startsWith('%PDF-'));
  t('it terminates properly', raw.trimEnd().endsWith('%%EOF'));
  t('it has a cross-reference table', raw.includes('xref') && raw.includes('startxref'));
  t('it declares its fonts', raw.includes('Helvetica') && raw.includes('Helvetica-Bold'));
  t('the reference appears on it', raw.includes(order.ref));
  t('the customer appears on it', raw.includes('Tanvir'));
  t('the total appears on it', raw.includes('3,397'));
  t('it is a sensible size', pdf.length > 1500 && pdf.length < 200000, String(pdf.length));
}

console.log('\n── a mail failure cannot break an order ───────');
{
  // No SMTP configured here, so this exercises the failure path.
  const r = await sendOrderEmail('placed', order);
  t('it reports failure rather than throwing', r.sent === false && !!r.reason, JSON.stringify(r));
  t('the order is untouched', !!DB.getOrder(order.ref));

  const unknown = await sendOrderEmail('nonsense', order);
  t('an unknown template is refused safely', unknown.sent === false);

  const noEmail = await sendOrderEmail('placed', { ...order, email: null });
  t('a missing address is refused safely', noEmail.sent === false);
}

console.log('\n── odd data does not break rendering ──────────');
{
  const awkward = { ...order, first_name: 'A"<>&', address: 'x'.repeat(300),
                    items: [{ name: 'Piece (50% off) \\ test', qty: 1, unit_price: 1, line_total: 1 }] };
  let threw = null;
  try { invoicePdf(awkward, { store: 'Aurelle' }); } catch (e) { threw = e.message; }
  t('a long address and odd characters are handled', threw === null, threw || '');

  const d = previewOrderEmail('placed', awkward);
  t('HTML special characters are escaped', !d.html.includes('A"<>&'), 'unescaped input reached the HTML');
}

rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
