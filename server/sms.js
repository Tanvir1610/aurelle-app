/**
 * Aurelle — SMS one-time passwords.
 *
 * Configuration, all from the environment:
 *
 *   SMS_API_KEY      the gateway's apikey value
 *   SMS_SENDER       6-character DLT sender ID  (e.g. AURELE)
 *   SMS_ENTITY_ID    your DLT entity registration
 *   SMS_TEMPLATE_ID  the registered template for this message
 *   SMS_TEMPLATE     the message text, with {otp} and {mins} placeholders
 *   SMS_BASE_URL     gateway endpoint
 *   OTP_TTL_MINUTES  how long a code is valid (default 10)
 *
 * On DLT: an Indian transactional SMS template is registered against one
 * entity and one sender ID, and the delivered text must match the registered
 * template exactly. Sending Aurelle's OTPs through a sender registered to a
 * different business means customers see that business's name, and the
 * traffic is attributed to them. Register your own sender and template, then
 * set the four variables above.
 *
 * Codes are never stored in readable form — only a salted hash — so a leaked
 * database cannot be used to log in as somebody.
 */
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

const API_KEY = process.env.SMS_API_KEY || '';
const SENDER = process.env.SMS_SENDER || '';
const ENTITY_ID = process.env.SMS_ENTITY_ID || '';
const TEMPLATE_ID = process.env.SMS_TEMPLATE_ID || '';
const BASE_URL = process.env.SMS_BASE_URL ||
  'https://vas.themultimedia.in/domestic/sendsms/bulksms_v2.php';

/* The delivered text must match the DLT-registered template exactly, so it
   lives in configuration rather than in code. */
const TEMPLATE = process.env.SMS_TEMPLATE ||
  'Dear User, Your Login OTP {otp} Valid for {mins} Please do not share this OTP.';

export const TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_S = 60;
const MAX_PER_HOUR = 5;

export const isConfigured = () => !!(API_KEY && SENDER);

export function configWarning() {
  if (!isConfigured()) return null;
  if (!ENTITY_ID || !TEMPLATE_ID) {
    return 'SMS_ENTITY_ID and SMS_TEMPLATE_ID are not set. Indian gateways ' +
           'reject transactional SMS without a DLT entity and template.';
  }
  if (SENDER.length !== 6) {
    return `SMS_SENDER is "${SENDER}". DLT sender IDs are exactly 6 characters.`;
  }
  return null;
}

/* ---------------------------------------------------------- helpers -- */
/** Indian mobile numbers: ten digits starting 6-9. */
export function normalisePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

const hashCode = (phone, code) =>
  createHash('sha256').update(`${phone}:${code}:${API_KEY || 'aurelle'}`).digest('hex');

function sameHash(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ------------------------------------------------------------- send -- */
async function deliver(phone, code) {
  const message = TEMPLATE
    .replace('{otp}', code)
    .replace('{mins}', `${TTL_MINUTES} minutes`);

  const url = `${BASE_URL}?apikey=${encodeURIComponent(API_KEY)}` +
    `&type=TEXT&sender=${encodeURIComponent(SENDER)}` +
    (ENTITY_ID ? `&entityId=${encodeURIComponent(ENTITY_ID)}` : '') +
    (TEMPLATE_ID ? `&templateId=${encodeURIComponent(TEMPLATE_ID)}` : '') +
    `&mobile=${encodeURIComponent(phone)}` +
    `&message=${encodeURIComponent(message)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const body = (await res.text()).trim();
    if (!res.ok) throw new Error(`SMS gateway ${res.status}`);
    // Gateways vary; treat an explicit failure word as a failure.
    if (/error|invalid|fail/i.test(body) && !/success/i.test(body)) {
      throw new Error(`SMS gateway refused: ${body.slice(0, 120)}`);
    }
    return { delivered: true, response: body.slice(0, 200) };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('SMS gateway timed out');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------- lifecycle -- */
/**
 * Issue a code for a phone number.
 * `db` is the driver, so storage lives with the rest of the data.
 */
export async function requestOtp(db, rawPhone, { ip } = {}) {
  const phone = normalisePhone(rawPhone);
  if (!phone) return { ok: false, reason: 'Enter a valid 10-digit mobile number' };

  const now = Date.now();

  // Do not let one number be used to pump out messages.
  const recent = db.otpRecent(phone, 3600);
  if (recent.length >= MAX_PER_HOUR) {
    return { ok: false, reason: 'Too many codes requested. Try again in an hour.', retryAfter: 3600 };
  }
  const last = recent[0];
  if (last && now - new Date(last.created_at + 'Z').getTime() < RESEND_COOLDOWN_S * 1000) {
    const wait = Math.ceil(RESEND_COOLDOWN_S -
      (now - new Date(last.created_at + 'Z').getTime()) / 1000);
    return { ok: false, reason: `Please wait ${wait}s before asking for another code.`,
             retryAfter: wait };
  }

  const code = String(randomInt(100000, 999999));
  const id = randomUUID();
  db.otpCreate({
    id, phone,
    code_hash: hashCode(phone, code),
    expires_at: new Date(now + TTL_MINUTES * 60000).toISOString(),
    ip: ip || null,
  });

  if (!isConfigured()) {
    // Without a gateway the flow still works end to end for development.
    console.log(`[sms] not configured — OTP for ${phone} is ${code}`);
    return { ok: true, id, devCode: code, delivered: false };
  }

  try {
    await deliver(phone, code);
    return { ok: true, id, delivered: true };
  } catch (e) {
    db.otpConsume(id);              // do not leave a live code behind
    console.error('[sms] send failed:', e.message);
    return { ok: false, reason: e.message };
  }
}

/**
 * Check a code. Returns the phone number on success.
 * Wrong codes count against a limited number of attempts, so a six-digit
 * code cannot simply be guessed.
 */
export function verifyOtp(db, rawPhone, code) {
  const phone = normalisePhone(rawPhone);
  if (!phone) return { ok: false, reason: 'Enter a valid 10-digit mobile number' };
  if (!/^\d{6}$/.test(String(code || ''))) {
    return { ok: false, reason: 'Enter the 6-digit code' };
  }

  const row = db.otpLatest(phone);
  if (!row) return { ok: false, reason: 'Ask for a code first' };

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.otpConsume(row.id);
    return { ok: false, reason: 'That code has expired. Ask for a new one.' };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    db.otpConsume(row.id);
    return { ok: false, reason: 'Too many wrong attempts. Ask for a new code.' };
  }

  if (!sameHash(row.code_hash, hashCode(phone, code))) {
    db.otpAttempt(row.id);
    const left = MAX_ATTEMPTS - (row.attempts + 1);
    return { ok: false,
             reason: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`
                              : 'Too many wrong attempts. Ask for a new code.' };
  }

  db.otpConsume(row.id);
  return { ok: true, phone };
}

export function publicConfig() {
  return {
    enabled: true,                 // the flow works with or without a gateway
    delivers: isConfigured(),      // false means codes are logged, not texted
    ttlMinutes: TTL_MINUTES,
    sender: SENDER || null,
  };
}
