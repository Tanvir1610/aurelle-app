/**
 * Aurelle — SMTP mailer.
 *
 * Speaks SMTP directly over node:net + node:tls, so there is still no npm
 * dependency. Supports Gmail's two routes:
 *
 *   port 587  plain connect, then STARTTLS  (default)
 *   port 465  implicit TLS from the first byte
 *
 * Configuration, from the environment only:
 *
 *   SMTP_HOST      smtp.gmail.com
 *   SMTP_PORT      587 (or 465)
 *   SMTP_USER      the mailbox address
 *   SMTP_PASS      a Google App Password, not the account password
 *   MAIL_FROM      optional display address, defaults to SMTP_USER
 *   STORE_NAME     appears in subjects and signatures
 *
 * An App Password grants send access to that mailbox. It belongs in your
 * host's environment settings and nowhere else — not in source, not in a
 * repository, not in a chat message.
 */
import net from 'node:net';
import tls from 'node:tls';
import { randomUUID } from 'node:crypto';

const HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const PORT = Number(process.env.SMTP_PORT || 587);
const USER = process.env.SMTP_USER || '';
const PASS = (process.env.SMTP_PASS || '').replace(/\s+/g, ''); // Google prints it in groups of four
const FROM = process.env.MAIL_FROM || USER;
export const STORE = process.env.STORE_NAME || 'Aurelle';

export const isConfigured = () => !!(USER && PASS);

/* ----------------------------------------------------------- plumbing -- */
/** Read one complete SMTP reply, which may span several lines. */
function readReply(sock) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const onData = (d) => {
      buf += d.toString('utf8');
      // The final line of a reply has a space after the code, not a hyphen.
      const lines = buf.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1];
      if (last && /^\d{3} /.test(last)) {
        cleanup();
        resolve({ code: Number(last.slice(0, 3)), text: buf.trim() });
      }
    };
    const onErr = (e) => { cleanup(); reject(e); };
    const timer = setTimeout(() => onErr(new Error('SMTP read timed out')), 20000);
    function cleanup() {
      clearTimeout(timer);
      sock.removeListener('data', onData);
      sock.removeListener('error', onErr);
    }
    sock.on('data', onData);
    sock.on('error', onErr);
  });
}

async function say(sock, line, expect) {
  if (line !== null) sock.write(line + '\r\n');
  const reply = await readReply(sock);
  if (expect && !expect.includes(reply.code)) {
    // Never echo the password back in an error, even indirectly.
    const safe = reply.text.replace(new RegExp(PASS, 'g'), '***');
    throw new Error(`SMTP ${reply.code}: ${safe.split('\n')[0]}`);
  }
  return reply;
}

const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');

/* ------------------------------------------------------------- encode -- */
/** RFC 2047 for non-ASCII in headers (₹ in a subject, for instance). */
function encodeHeader(value) {
  const s = String(value);
  return /^[\x20-\x7E]*$/.test(s)
    ? s
    : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

/** Split base64 into 76-char lines, as the format requires. */
const wrap76 = (s) => s.replace(/(.{76})/g, '$1\r\n');

/** A line consisting only of a dot would end the message early. */
const dotStuff = (s) => s.replace(/\r?\n\./g, '\r\n..');

function buildMessage({ to, subject, text, html, attachments = [] }) {
  const boundary = `aurelle_${randomUUID()}`;
  const altBoundary = `alt_${randomUUID()}`;
  const headers = [
    `From: ${encodeHeader(STORE)} <${FROM}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Message-ID: <${randomUUID()}@aurelle>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
  ];

  let body = '';
  if (attachments.length) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    body += `--${boundary}\r\n`;
  }

  // A plain-text alternative alongside the HTML, so every client renders it.
  body += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
  body += `--${altBoundary}\r\n`;
  body += 'Content-Type: text/plain; charset=UTF-8\r\n';
  body += 'Content-Transfer-Encoding: base64\r\n\r\n';
  body += wrap76(Buffer.from(text || '', 'utf8').toString('base64')) + '\r\n\r\n';
  body += `--${altBoundary}\r\n`;
  body += 'Content-Type: text/html; charset=UTF-8\r\n';
  body += 'Content-Transfer-Encoding: base64\r\n\r\n';
  body += wrap76(Buffer.from(html || text || '', 'utf8').toString('base64')) + '\r\n\r\n';
  body += `--${altBoundary}--\r\n`;

  for (const a of attachments) {
    body += `\r\n--${boundary}\r\n`;
    body += `Content-Type: ${a.type || 'application/octet-stream'}; name="${a.filename}"\r\n`;
    body += 'Content-Transfer-Encoding: base64\r\n';
    body += `Content-Disposition: attachment; filename="${a.filename}"\r\n\r\n`;
    body += wrap76(Buffer.from(a.content).toString('base64')) + '\r\n';
  }
  if (attachments.length) body += `\r\n--${boundary}--\r\n`;

  return headers.join('\r\n') + '\r\n\r\n' + dotStuff(body);
}

/* --------------------------------------------------------------- send -- */
export async function sendMail({ to, subject, text, html, attachments }) {
  if (!isConfigured()) throw new Error('Email is not configured on this server');
  if (!to) throw new Error('A recipient is required');

  let sock = PORT === 465
    ? tls.connect({ host: HOST, port: PORT, servername: HOST })
    : net.connect({ host: HOST, port: PORT });

  sock.setTimeout(25000);

  try {
    await new Promise((res, rej) => {
      sock.once(PORT === 465 ? 'secureConnect' : 'connect', res);
      sock.once('error', rej);
      sock.once('timeout', () => rej(new Error('Could not reach the mail server')));
    });

    await say(sock, null, [220]);                       // greeting
    await say(sock, `EHLO aurelle`, [250]);

    if (PORT !== 465) {
      await say(sock, 'STARTTLS', [220]);
      sock = tls.connect({ socket: sock, servername: HOST });
      await new Promise((res, rej) => {
        sock.once('secureConnect', res);
        sock.once('error', rej);
      });
      await say(sock, `EHLO aurelle`, [250]);           // re-introduce, now encrypted
    }

    await say(sock, 'AUTH LOGIN', [334]);
    await say(sock, b64(USER), [334]);
    await say(sock, b64(PASS), [235]);

    await say(sock, `MAIL FROM:<${FROM}>`, [250]);
    await say(sock, `RCPT TO:<${to}>`, [250, 251]);
    await say(sock, 'DATA', [354]);

    sock.write(buildMessage({ to, subject, text, html, attachments }) + '\r\n.\r\n');
    const done = await readReply(sock);
    if (done.code !== 250) throw new Error(`Message refused: ${done.text.split('\n')[0]}`);

    try { await say(sock, 'QUIT', [221]); } catch (e) { /* the send already succeeded */ }
    return { sent: true, to };
  } finally {
    try { sock.destroy(); } catch (e) {}
  }
}

/** Prove the credentials work without sending anything. */
export async function verifyConnection() {
  if (!isConfigured()) return { ok: false, reason: 'SMTP_USER and SMTP_PASS are not set' };
  let sock = PORT === 465
    ? tls.connect({ host: HOST, port: PORT, servername: HOST })
    : net.connect({ host: HOST, port: PORT });
  sock.setTimeout(15000);
  try {
    await new Promise((res, rej) => {
      sock.once(PORT === 465 ? 'secureConnect' : 'connect', res);
      sock.once('error', rej);
      sock.once('timeout', () => rej(new Error('timed out')));
    });
    await say(sock, null, [220]);
    await say(sock, 'EHLO aurelle', [250]);
    if (PORT !== 465) {
      await say(sock, 'STARTTLS', [220]);
      sock = tls.connect({ socket: sock, servername: HOST });
      await new Promise((res, rej) => { sock.once('secureConnect', res); sock.once('error', rej); });
      await say(sock, 'EHLO aurelle', [250]);
    }
    await say(sock, 'AUTH LOGIN', [334]);
    await say(sock, b64(USER), [334]);
    await say(sock, b64(PASS), [235]);
    await say(sock, 'QUIT', [221]);
    return { ok: true, host: HOST, port: PORT, user: USER };
  } catch (e) {
    return { ok: false, reason: e.message };
  } finally {
    try { sock.destroy(); } catch (e) {}
  }
}

export function publicConfig() {
  return { enabled: isConfigured(), host: HOST, port: PORT, store: STORE };
}
