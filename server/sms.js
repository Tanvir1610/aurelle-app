/**
 * Aurelle — SMS one-time passwords, delivered through Twilio.
 *
 * Configuration, all from the environment:
 *
 *   TWILIO_ACCOUNT_SID   starts "AC…", from the Twilio console
 *   TWILIO_AUTH_TOKEN    the account's auth token — used for basic auth
 *                         unless an API key/secret pair is supplied instead
 *   TWILIO_API_KEY       optional, starts "SK…" — a scoped, revocable
 *                         credential; preferred over the auth token when set
 *   TWILIO_API_SECRET    required alongside TWILIO_API_KEY
 *   TWILIO_PHONE_NUMBER  the Twilio number messages are sent from, in
 *                         E.164 form, e.g. +91xxxxxxxxxx
 *   SMS_TEMPLATE         the message text, with {otp} and {mins} placeholders
 *   OTP_TTL_MINUTES      how long a code is valid (default 10)
 *
 * Twilio accepts either an API key/secret (scoped, can be revoked without
 * touching the main auth token) or the account SID/auth token pair. When
 * an API key is present it is used; otherwise the request falls back to
 * the account SID and auth token. Either way the account SID is required,
 * since it identifies which account the number belongs to.
 *
 * Codes are never stored in readable form — only a salted hash — so a
 * leaked database cannot be used to log in as somebody.
 */
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const API_KEY = process.env.TWILIO_API_KEY || '';
const API_SECRET = process.env.TWILIO_API_SECRET || '';
const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

const MESSAGES_URL = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;

/* API key + secret when both are set (scoped, revocable); otherwise the
   account SID + auth token. Either pair is sent as HTTP basic auth. */
const AUTH_USER = API_KEY && API_SECRET ? API_KEY : ACCOUNT_SID;
const AUTH_PASS = API_KEY && API_SECRET ? API_SECRET : AUTH_TOKEN;

/* Used to salt the OTP hash. Any of the account's secrets works — it only
   needs to be stable and not guessable from outside. */
const SALT = AUTH_TOKEN || API_SECRET || 'aurelle';

const TEMPLATE = process.env.SMS_TEMPLATE ||
  'Dear User, Your Login OTP {otp} Valid for {mins} Please do not share this OTP.';

export const TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_S = 60;
const MAX_PER_HOUR = 5;

export const isConfigured = () =>
  !!(ACCOUNT_SID && FROM_NUMBER && (AUTH_TOKEN || (API_KEY && API_SECRET)));

export function configWarning() {
  if (!isConfigured()) return null;
  if (!/^AC[a-zA-Z0-9]+$/.test(ACCOUNT_SID)) {
    return 'TWILIO_ACCOUNT_SID does not look right — it should start with "AC".';
  }
  if (API_KEY && !API_SECRET) {
    return 'TWILIO_API_KEY is set but TWILIO_API_SECRET is not — Twilio will reject the request.';
  }
  if (API_KEY && !/^SK[a-zA-Z0-9]+$/.test(API_KEY)) {
    return 'TWILIO_API_KEY does not look right — it should start with "SK".';
  }
  if (!/^\+[1-9]\d{6,14}$/.test(FROM_NUMBER)) {
    return `TWILIO_PHONE_NUMBER is "${FROM_NUMBER}". It should be in E.164 form, e.g. +91xxxxxxxxxx.`;
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
async function deliver(phone, code) {
  const message = TEMPLATE
    .replace('{otp}', code)
    .replace('{mins}', `${TTL_MINUTES} minutes`);

  const body = new URLSearchParams({
    To: `+91${phone}`,
    From: FROM_NUMBER,
    Body: message,
  });

  const auth = Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(MESSAGES_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data?.message ? `${data.message} (${data.code})` : `Twilio ${res.status}`;
      throw new Error(detail);
    }
    // queued / sending / sent are all acceptable at this point — final
    // delivery is confirmed asynchronously by Twilio, not in this response.
    if (data?.status === 'failed' || data?.status === 'undelivered') {
      throw new Error(data?.error_message || `Twilio reported "${data.status}"`);
    }
    return { delivered: true, sid: data?.sid };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Twilio request timed out');
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
    // Without Twilio configured the flow still works end to end for development.
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
    enabled: true,                 // the flow works with or without Twilio configured
    delivers: isConfigured(),      // false means codes are logged, not texted
    ttlMinutes: TTL_MINUTES,
    sender: FROM_NUMBER || null,
  };
}
