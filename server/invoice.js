/**
 * Aurelle — invoice PDF.
 *
 * Writes the PDF bytes directly rather than pulling in a rendering library,
 * keeping the zero-dependency rule. A PDF is a small object graph plus an
 * offset table, and an invoice only needs text and rules — so this stays
 * short and predictable.
 *
 * Layout is A4 at 72dpi: 595 x 842 points, origin bottom-left.
 */

const W = 595, H = 842;
const M = 48;                       // page margin

const money = n => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** PDF strings are Latin-1; escape the delimiters and drop anything exotic. */
function pdfText(s) {
  return String(s == null ? '' : s)
    .replace(/[\\()]/g, m => '\\' + m)
    .replace(/[^\x20-\x7E]/g, '');    // ₹ and similar cannot be encoded in the base fonts
}

/** Accumulates a content stream in PDF operators. */
class Page {
  constructor() { this.ops = []; }

  text(x, y, str, { size = 10, font = 'F1', color = [0.1, 0.08, 0.07] } = {}) {
    this.ops.push(
      'BT',
      `${color[0]} ${color[1]} ${color[2]} rg`,
      `/${font} ${size} Tf`,
      `1 0 0 1 ${x} ${y} Tm`,
      `(${pdfText(str)}) Tj`,
      'ET');
    return this;
  }

  /** Right-aligned, using an approximate advance width per character. */
  right(xRight, y, str, opts = {}) {
    const size = opts.size || 10;
    const factor = (opts.font === 'F2') ? 0.56 : 0.5;
    return this.text(xRight - String(str).length * size * factor, y, str, opts);
  }

  line(x1, y1, x2, y2, { width = 0.5, color = [0.85, 0.82, 0.78] } = {}) {
    this.ops.push(`${color[0]} ${color[1]} ${color[2]} RG`,
                  `${width} w`, `${x1} ${y1} m`, `${x2} ${y2} l`, 'S');
    return this;
  }

  rect(x, y, w, h, color = [0.98, 0.96, 0.93]) {
    this.ops.push(`${color[0]} ${color[1]} ${color[2]} rg`, `${x} ${y} ${w} ${h} re`, 'f');
    return this;
  }

  toString() { return this.ops.join('\n'); }
}

/**
 * Build the invoice for one order.
 * @param order  a row from the orders table, with .items
 * @returns Buffer of a complete PDF
 */
export function invoicePdf(order, opts = {}) {
  const store = opts.store || 'Aurelle';
  const p = new Page();
  let y = H - M;

  /* ------------------------------------------------------------ head -- */
  p.text(M, y - 16, store.toUpperCase(), { size: 22, font: 'F2', color: [0.1, 0.08, 0.07] });
  p.text(M, y - 30, 'FINE FASHION JEWELLERY', { size: 7, color: [0.55, 0.5, 0.45] });
  p.right(W - M, y - 16, 'TAX INVOICE', { size: 13, font: 'F2' });
  p.right(W - M, y - 32, `Invoice ${order.ref}`, { size: 9, color: [0.45, 0.42, 0.38] });

  y -= 52;
  p.line(M, y, W - M, y, { width: 1, color: [0.72, 0.58, 0.35] });
  y -= 26;

  /* ------------------------------------------------------- addressee -- */
  const placed = String(order.created_at || '').slice(0, 10);
  p.text(M, y, 'BILLED TO', { size: 7.5, font: 'F2', color: [0.55, 0.5, 0.45] });
  p.right(W - M, y, 'ORDER DETAILS', { size: 7.5, font: 'F2', color: [0.55, 0.5, 0.45] });
  y -= 15;

  p.text(M, y, `${order.first_name} ${order.last_name}`, { size: 10.5, font: 'F2' });
  p.right(W - M, y, `Date: ${placed}`, { size: 9 });
  y -= 13;

  const addr = String(order.address || '');
  // Wrap the street address rather than letting it run off the page.
  const lines = [];
  let cur = '';
  for (const word of addr.split(/\s+/)) {
    if ((cur + ' ' + word).trim().length > 46) { lines.push(cur.trim()); cur = word; }
    else cur += ' ' + word;
  }
  if (cur.trim()) lines.push(cur.trim());

  for (const l of lines.slice(0, 3)) {
    p.text(M, y, l, { size: 9, color: [0.35, 0.32, 0.29] });
    y -= 12;
  }
  p.text(M, y, `${order.city} ${order.pincode}`, { size: 9, color: [0.35, 0.32, 0.29] });
  p.right(W - M, y + 25, `Payment: ${order.payment}`, { size: 9 });
  p.right(W - M, y + 12, `Status: ${order.status}`, { size: 9 });
  y -= 12;
  p.text(M, y, order.email, { size: 9, color: [0.35, 0.32, 0.29] });
  y -= 12;
  p.text(M, y, order.phone, { size: 9, color: [0.35, 0.32, 0.29] });

  /* ----------------------------------------------------------- items -- */
  y -= 30;
  p.rect(M, y - 6, W - M * 2, 22);
  p.text(M + 8, y + 3, 'ITEM', { size: 7.5, font: 'F2', color: [0.45, 0.42, 0.38] });
  p.right(W - M - 168, y + 3, 'QTY', { size: 7.5, font: 'F2', color: [0.45, 0.42, 0.38] });
  p.right(W - M - 88, y + 3, 'PRICE', { size: 7.5, font: 'F2', color: [0.45, 0.42, 0.38] });
  p.right(W - M - 8, y + 3, 'TOTAL', { size: 7.5, font: 'F2', color: [0.45, 0.42, 0.38] });
  y -= 14;

  for (const it of (order.items || [])) {
    y -= 20;
    const name = String(it.name).slice(0, 42);
    p.text(M + 8, y, name, { size: 9.5 });
    if (it.finish) {
      p.text(M + 8, y - 10, String(it.finish), { size: 7.5, color: [0.55, 0.5, 0.45] });
      y -= 6;
    }
    p.right(W - M - 168, y, String(it.qty), { size: 9.5 });
    p.right(W - M - 88, y, money(it.unit_price), { size: 9.5 });
    p.right(W - M - 8, y, money(it.line_total), { size: 9.5 });
    y -= 6;
    p.line(M, y - 4, W - M, y - 4);
  }

  /* ---------------------------------------------------------- totals -- */
  y -= 26;
  const label = (t, v, bold) => {
    p.right(W - M - 88, y, t, { size: bold ? 10 : 9,
      font: bold ? 'F2' : 'F1', color: bold ? [0.1, 0.08, 0.07] : [0.4, 0.37, 0.34] });
    p.right(W - M - 8, y, v, { size: bold ? 11 : 9, font: bold ? 'F2' : 'F1' });
    y -= 16;
  };
  label('Subtotal', money(order.subtotal));
  label('Shipping', order.shipping === 0 ? 'Free' : money(order.shipping));
  const extras = Number(order.total) - Number(order.subtotal) - Number(order.shipping);
  if (extras > 0) label('Handling', money(extras));

  p.line(W - M - 210, y + 10, W - M, y + 10, { width: 0.8, color: [0.72, 0.58, 0.35] });
  y -= 4;
  label('Total paid', money(order.total), true);

  /* ----------------------------------------------------------- foot -- */
  p.line(M, M + 54, W - M, M + 54);
  p.text(M, M + 38, 'Inclusive of all taxes. Returns accepted within 7 days of delivery,',
    { size: 8, color: [0.5, 0.46, 0.42] });
  p.text(M, M + 27, 'unworn and in original packaging.', { size: 8, color: [0.5, 0.46, 0.42] });
  p.right(W - M, M + 38, `Thank you for shopping with ${store}.`,
    { size: 8.5, font: 'F2', color: [0.55, 0.44, 0.26] });

  return assemble(p.toString());
}

/* --------------------------------------------------------- assemble -- */
/** Wrap a content stream in the minimum object graph a PDF reader needs. */
function assemble(content) {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
      '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });

  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
}
