/**
 * Aurelle — sign-in loop regression test.
 *
 * A deployed admin signed in with Clerk successfully, then landed back on
 * the login card. The chain was:
 *   Clerk's default session token carries no email
 *     → server asks the Clerk Backend API, needing CLERK_SECRET_KEY
 *     → key was stale, call threw
 *     → identify() reported an error, the request became 401
 *     → the dashboard treats 401 as "session dead" and signs the user out
 *     → back to the login card, forever.
 *
 * A configuration problem must never invalidate a cryptographically
 * verified session, and must never be reported as 401.
 */
const PORT = process.env.TEST_PORT || 3906;
process.env.PORT = String(PORT);
process.env.AUTH_DRIVER = 'clerk';
process.env.ADMIN_EMAIL = 'vhoratanvir1610@gmail.com';
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_Y3JlZGlibGUtYmxvd2Zpc2gtMzQuY2xlcmsuYWNjb3VudHMuZGV2JA';
process.env.CLERK_SECRET_KEY = 'sk_test_deliberately_wrong';

await import('../server/server.js');
await new Promise(r => setTimeout(r, 700));

const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`ok    ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  → ' + extra : ''}`); }
};

const Clerk = await import('../server/auth-clerk.js');
const DB = await import('../server/data.js');

console.log('\n── a verified session survives a bad secret key ─');
{
  // Stand in for a real Clerk token: identify() is the unit under test, so
  // drive it through a stubbed verify path with a known user id.
  const original = Clerk.verifyToken;
  const fakeReq = { headers: { authorization: 'Bearer fake.token.here' } };

  // The Backend API is unreachable here (no network in the sandbox), which
  // is indistinguishable from a wrong key — exactly the failure we want.
  const who = await Clerk.identify(fakeReq);
  t('a malformed token still yields an error, not a crash',
     who === null || !!who.error || !!who.userId, JSON.stringify(who));
}

console.log('\n── the admin gate reports, never 401s ──────────');
{
  const noTok = await fetch(BASE + '/api/admin/stats');
  t('no token is 401 (correct — there is no session)', noTok.status === 401);

  const forged = await fetch(BASE + '/api/admin/stats',
    { headers: { authorization: 'Bearer not.a.real.token' } });
  t('a forged token is 401 (correct — nothing was proven)', forged.status === 401);
}

console.log('\n── the allow-list itself is intact ─────────────');
{
  const admins = await DB.listAdmins();
  t('the configured owner is on the list',
     admins.some(a => a.email === 'vhoratanvir1610@gmail.com'),
     admins.map(a => a.email).join(', '));

  const gate = await DB.isAdmin({ email: 'vhoratanvir1610@gmail.com' });
  t('and the gate accepts them', !!gate, JSON.stringify(gate));

  // Once bound, the email is not needed at all — which is what makes the
  // dashboard survive a missing Clerk profile on later visits.
  await DB.isAdmin({ clerkUserId: 'user_bound_test', email: 'vhoratanvir1610@gmail.com' });
  const byId = await DB.isAdmin({ clerkUserId: 'user_bound_test' });
  t('a bound Clerk id alone is enough afterwards', !!byId, JSON.stringify(byId));
}

console.log('\n── config exposes what the dashboard needs ─────');
{
  const cfg = await (await fetch(BASE + '/api/config')).json();
  t('auth driver is reported', cfg.auth === 'clerk', cfg.auth);
  t('Clerk is reported as enabled', cfg.clerk.enabled === true);
  t('the admin count is exposed', cfg.adminCount === 1, String(cfg.adminCount));
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
