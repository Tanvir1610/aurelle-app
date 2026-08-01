/**
 * Aurelle — SMS one-time passwords, delivered through the vas.themultimedia.in
 * bulk SMS gateway (DLT-registered, India).
 *
 * Configuration, all from the environment:
 *
 *   SMS_API_KEY      the account's API key, from the gateway dashboard
 *   SMS_SENDER       the approved 6-character sender ID, e.g. ZPDEAL
 *   SMS_ENTITY_ID    DLT entity ID registered with the telecom operators
 *   SMS_TEMPLATE_ID  DLT template ID for this exact message
 *   SMS_TEMPLATE     the message text, with two {#var#} placeholders —
 *                    filled in order with the OTP, then the validity window
 *   SMS_GATEWAY_URL  the gateway endpoint (has a default, rarely changed)
 *   OTP_TTL_MINUTES  how long a code is valid (default 10)
 *
 * DLT rules are strict: carriers reject anything that doesn't match a
 * template byte-for-byte outside of its {#var#} slots, so SMS_TEMPLATE must
 * stay exactly as registered — including the sender name inside the text,
 * which does not have to match SMS_SENDER or the storefront's brand name.
 *
 * Codes are never stored in readable form — only a salted hash — so a
 * leaked database cannot be used to log in as somebody.
 */
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

const API_KEY = process.env.SMS_API_KEY || '';
const SENDER = process.env.SMS_SENDER || '';
const ENTITY_ID = process.env.SMS_ENTITY_ID || '';
const TEMPLATE_ID = process.env.SMS_TEMPLATE_ID || '';
const GATEWAY_URL = process.env.SMS_GATEWAY_URL ||
  'https://vas.themultimedia.in/domestic/sendsms/bulksms_v2.php';

/* Used to salt the OTP hash. Any of the account's secrets works — it only
   needs to be stable and not guessable from outside. */
const SALT = API_KEY || 'aurelle';

const TEMPLATE = process.env.SMS_TEMPLATE ||
  'Dear User, Your Login OTP {#var#} Valid for {#var#} Please do not share this OTP.';

export const TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_S = 60;
const MAX_PER_HOUR = 5;

export const isConfigured = () =>
  !!(API_KEY && SENDER && ENTITY_ID && TEMPLATE_ID);

export function configWarning() {
  if (!isConfigured()) return null;
  if (!/^[A-Za-z0-9]{6}$/.test(SENDER)) {
    return `SMS_SENDER is "${SENDER}". DLT sender IDs are normally exactly 6 alphanumeric characters.`;
  }
  if (!/^\d+$/.test(ENTITY_ID)) {
    return 'SMS_ENTITY_ID does not look right — it should be the numeric DLT entity ID.';
  }
  if (!/^\d+$/.test(TEMPLATE_ID)) {
    return 'SMS_TEMPLATE_ID does not look right — it should be the numeric DLT template ID.';
  }
  if ((TEMPLATE.match(/\{#var#\}/g) || []).length !== 2) {
    return 'SMS_TEMPLATE should contain exactly two {#var#} placeholders (OTP, then validity).';
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
  createHash('sha256').update(`${phone}:${code}:${SALT}`).digest('hex');

function sameHash(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ------------------------------------------------------------- send -- */
/** Fill the two {#var#} slots in order: the code, then the validity window. */
function renderMessage(code) {
  let filled = 0;
  return TEMPLATE.replace(/\{#var#\}/g, () => {
    filled += 1;
    return filled === 1 ? code : `${TTL_MINUTES} minutes`;
  });
}

async function deliver(phone, code) {
  const message = renderMessage(code);

  const params = new URLSearchParams({
    apikey: API_KEY,
    type: 'TEXT',
    sender: SENDER,
    entityId: ENTITY_ID,
    templateId: TEMPLATE_ID,
    mobile: phone,
    message,
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${GATEWAY_URL}?${params.toString()}`, {
      method: 'GET',
      signal: ctrl.signal,
    });
    const text = (await res.text()).trim();

    if (!res.ok) {
      throw new Error(`Gateway ${res.status}: ${text.slice(0, 200)}`);
    }
    // The gateway replies with plain text, not JSON — a status word or an
    // ID on success, or a message containing "error"/"fail" on rejection.
    // "Authorization Error" (code 70051 among others) means the API key,
    // sender ID, entity ID or template ID is wrong, or not linked together
    // on the gateway's dashboard.
    if (/error|fail|invalid|reject/i.test(text)) {
      throw new Error(text || 'Gateway rejected the message');
    }
    return { delivered: true, response: text };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('SMS gateway request timed out');
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
    // Without the gateway configured the flow still works end to end for development.
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
    enabled: true,                 // the flow works with or without the gateway configured
    delivers: isConfigured(),      // false means codes are logged, not texted
    ttlMinutes: TTL_MINUTES,
    sender: SENDER || null,
  };
}
