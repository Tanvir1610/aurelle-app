/**
 * Aurelle — Clerk authentication.
 *
 * Verifies Clerk session tokens without the Clerk SDK, using node:crypto.
 * Clerk signs session JWTs with RS256; the public keys live at the JWKS
 * endpoint derived from your publishable key.
 *
 * Requires:
 *   CLERK_PUBLISHABLE_KEY   pk_test_... or pk_live_...  (safe in the browser)
 *   CLERK_SECRET_KEY        sk_test_... or sk_live_...  (SERVER ONLY)
 *
 * Both come from Clerk dashboard → API Keys. The secret key must never be
 * committed or shipped to a browser — anyone holding it can act as any user.
 */
import { createPublicKey, createVerify } from 'node:crypto';

const PUBLISHABLE = process.env.CLERK_PUBLISHABLE_KEY || '';
const SECRET = process.env.CLERK_SECRET_KEY || '';

/**
 * The publishable key is base64 of "<frontend-api-host>$".
 * pk_test_Y3JlZGli...  →  credible-blowfish-34.clerk.accounts.dev
 */
export function frontendApi() {
  if (!PUBLISHABLE) return null;
  const body = PUBLISHABLE.replace(/^pk_(test|live)_/, '');
  try {
    return Buffer.from(body, 'base64').toString('utf8').replace(/\$+$/, '') || null;
  } catch {
    return null;
  }
}

export const isConfigured = () => !!(PUBLISHABLE && SECRET);

/* ------------------------------------------------------------- JWKS -- */
let jwksCache = { keys: [], fetchedAt: 0 };
const JWKS_TTL = 10 * 60 * 1000;

async function getKeys(force = false) {
  const fresh = Date.now() - jwksCache.fetchedAt < JWKS_TTL;
  if (!force && fresh && jwksCache.keys.length) return jwksCache.keys;

  const host = frontendApi();
  if (!host) throw new Error('CLERK_PUBLISHABLE_KEY is missing or malformed');

  const res = await fetch(`https://${host}/.well-known/jwks.json`);
  if (!res.ok) throw new Error(`Could not fetch Clerk JWKS (${res.status})`);
  const data = await res.json();
  jwksCache = { keys: data.keys || [], fetchedAt: Date.now() };
  return jwksCache.keys;
}

/* -------------------------------------------------------------- JWT -- */
const b64urlToBuf = s =>
  Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const b64urlToJson = s => JSON.parse(b64urlToBuf(s).toString('utf8'));

/**
 * Verify a Clerk session token.
 * Returns the decoded claims, or throws with a reason.
 */
export async function verifyToken(token) {
  if (!token || token.split('.').length !== 3) throw new Error('Malformed token');
  const [headerB64, payloadB64, sigB64] = token.split('.');

  const header = b64urlToJson(headerB64);
  if (header.alg !== 'RS256') throw new Error(`Unexpected algorithm: ${header.alg}`);

  let keys = await getKeys();
  let jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) {
    // Clerk rotates keys; refetch once before giving up.
    keys = await getKeys(true);
    jwk = keys.find(k => k.kid === header.kid);
  }
  if (!jwk) throw new Error('Signing key not found');

  const pubKey = createPublicKey({ key: jwk, format: 'jwk' });
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  if (!verifier.verify(pubKey, b64urlToBuf(sigB64))) {
    throw new Error('Signature does not verify');
  }

  const claims = b64urlToJson(payloadB64);
  const now = Math.floor(Date.now() / 1000);
  const skew = 5; // tolerate small clock drift

  if (claims.exp && now > claims.exp + skew) throw new Error('Session expired');
  if (claims.nbf && now < claims.nbf - skew) throw new Error('Token not yet valid');

  const host = frontendApi();
  if (claims.iss && host && !claims.iss.includes(host.split('.')[0])) {
    throw new Error('Token issued by a different Clerk instance');
  }

  return claims;
}

/* ----------------------------------------------------- Backend API -- */
async function clerkApi(path) {
  if (!SECRET) throw new Error('CLERK_SECRET_KEY is not set');
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Clerk API ${res.status}: ${body.slice(0, 160)}`);
  }
  return res.json();
}

/** Full profile for a Clerk user id, normalised to what the shop needs. */
export async function getUser(userId) {
  const u = await clerkApi(`/users/${encodeURIComponent(userId)}`);
  const primary = (u.email_addresses || [])
    .find(e => e.id === u.primary_email_address_id) || (u.email_addresses || [])[0];
  const phone = (u.phone_numbers || [])
    .find(p => p.id === u.primary_phone_number_id) || (u.phone_numbers || [])[0];

  return {
    id: u.id,
    email: primary ? primary.email_address.toLowerCase() : null,
    emailVerified: primary ? primary.verification?.status === 'verified' : false,
    firstName: u.first_name || null,
    lastName: u.last_name || null,
    phone: phone ? phone.phone_number : null,
    phoneVerified: phone ? phone.verification?.status === 'verified' : false,
    imageUrl: u.image_url || null,
  };
}

/* Short-lived profile cache — Clerk rate-limits, and a session token is
   presented on almost every request. */
const userCache = new Map();
const USER_TTL = 60 * 1000;

export async function getUserCached(userId) {
  const hit = userCache.get(userId);
  if (hit && Date.now() - hit.at < USER_TTL) return hit.user;
  const user = await getUser(userId);
  userCache.set(userId, { user, at: Date.now() });
  if (userCache.size > 500) userCache.clear();
  return user;
}

/**
 * Resolve the caller from an Authorization header.
 * Returns null when there is no valid session — never throws for
 * ordinary "not signed in" cases.
 */
export async function identify(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return null;

  try {
    const claims = await verifyToken(token);
    const userId = claims.sub;
    if (!userId) return null;

    // Claims may carry the email already; fall back to the Backend API.
    let email = claims.email || null;
    let firstName = claims.first_name || null;
    let lastName = claims.last_name || null;
    let phone = claims.phone_number || null;

    /* Clerk's default session token carries no email, so we ask the Backend
       API. That needs CLERK_SECRET_KEY — but a bad key must NOT invalidate a
       session we have already cryptographically verified. Return what the
       token proves, and report why the profile is missing. */
    let profileError = null;
    if (!email) {
      try {
        const u = await getUserCached(userId);
        email = u.email;
        firstName = u.firstName;
        lastName = u.lastName;
        phone = u.phone;
      } catch (e) {
        profileError = e.message;
      }
    }

    return { userId, email: email ? email.toLowerCase() : null,
             firstName, lastName, phone, profileError, claims };
  } catch (e) {
    return { error: e.message };
  }
}

/** Config the browser needs. Publishable key only — never the secret. */
export function publicConfig() {
  return {
    enabled: isConfigured(),
    publishableKey: PUBLISHABLE || null,
    frontendApi: frontendApi(),
  };
}
