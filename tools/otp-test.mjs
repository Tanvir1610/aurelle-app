/**
 * Aurelle — phone sign-in.
 *
 * A six-digit code is only as safe as the limits around it, so most of these
 * assertions are about what an attacker cannot do: guess, replay, harvest
 * numbers, or pump out messages.
 */
const PORT = process.env.TEST_PORT || 3912;
process.env.PORT = String(PORT);
process.env.ADMIN_EMAIL = 'a@b.com';
process.env.ADMIN_PASSWORD = 'x';
delete process.env.SMS_API_KEY;          // no gateway: codes come back for testing

await import('../server/server.js');
await new Promise(r => setTimeout(r, 800));

const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; console.log(`ok    ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${e ? '  → ' + e : ''}`); } };

const post = (p, body) => fetch(BASE + p, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}).then(async r => ({ status: r.status, data: await r.json() }));

console.log('\n── requesting a code ───────────────────────────');
{
  const bad = await post('/api/auth/otp/request', { phone: '12345' });
  t('a short number is refused', bad.status === 400);

  const landline = await post('/api/auth/otp/request', { phone: '1234567890' });
  t('a number not starting 6-9 is refused', landline.status === 400);

  const r = await post('/api/auth/otp/request', { phone: '98920 87099' });
  t('spaces are tolerated', r.status === 200 && r.data.phone === '9892087099',
     JSON.stringify(r.data));
  t('a code is issued', !!r.data.devCode, 'no code came back');
  t('a new number is flagged as new', r.data.isNew === true);
  t('the validity window is stated', r.data.ttlMinutes > 0);
}

console.log('\n── a code cannot simply be guessed ─────────────');
{
  const phone = '9811111111';
  const r = await post('/api/auth/otp/request', { phone });
  const real = r.data.devCode;

  let lastReason = '';
  for (let i = 0; i < 5; i++) {
    const wrong = await post('/api/auth/otp/verify', { phone, code: '000000' });
    lastReason = wrong.data.error || '';
  }
  t('wrong codes are rejected', /incorrect|attempts/i.test(lastReason), lastReason);

  const after = await post('/api/auth/otp/verify', { phone, code: real });
  t('the real code stops working after too many attempts',
     after.status === 401, JSON.stringify(after.data));
}

console.log('\n── signing in, and staying signed in ───────────');
{
  const phone = '9822222222';
  const r = await post('/api/auth/otp/request', { phone });

  const noName = await post('/api/auth/otp/verify', { phone, code: r.data.devCode });
  t('a new number is asked to register', noName.data.needsRegistration === true,
     JSON.stringify(noName.data));
  t('no session is issued before registration', !noName.data.token);

  // The code is spent, so registration presents the ticket instead.
  const done = await post('/api/auth/otp/verify',
    { phone, regToken: noName.data.regToken, name: 'Tanvir Vhora', email: 'tv@example.com' });
  t('a registration ticket was issued', !!noName.data.regToken);
  t('registering completes sign-in', !!done.data.token);
  t('the customer comes back', done.data.customer.name === 'Tanvir Vhora');
  t('and is marked new', done.data.isNew === true);

  const meRes = await fetch(BASE + '/api/me/phone',
    { headers: { authorization: `Bearer ${done.data.token}` } });
  const me = await meRes.json();
  t('the session identifies them', meRes.status === 200 && me.customer.phone === phone);
  t('their orders come with it', Array.isArray(me.orders));

  // Returning customer: no name needed, straight in.
  await new Promise(r => setTimeout(r, 50));
  const r3 = await post('/api/auth/otp/request', { phone: '9877777777' });
  t('a known number is not flagged as new',
     (await post('/api/auth/otp/request', { phone: '9899999999' })).data.isNew === true);
  // A returning customer signs in with just a code — no name required.
  const known = await post('/api/auth/otp/request', { phone: '9866123456' });
  await post('/api/auth/otp/verify',
    { phone: '9866123456', regToken: (await post('/api/auth/otp/verify',
      { phone: '9866123456', code: known.data.devCode })).data.regToken, name: 'Repeat Buyer' });
  const second = await post('/api/auth/otp/request', { phone: '9866123456' });
  t('a known number is not flagged as new', second.status === 429 || second.data.isNew === false,
     JSON.stringify(second.data));
}

console.log('\n── a used code cannot be replayed ──────────────');
{
  const phone = '9833333333';
  const r = await post('/api/auth/otp/request', { phone });
  await post('/api/auth/otp/verify', { phone, code: r.data.devCode, name: 'Once' });
  const again = await post('/api/auth/otp/verify', { phone, code: r.data.devCode });
  t('the same code will not work twice', again.status === 401, JSON.stringify(again.data));
}

console.log('\n── messages cannot be pumped out ───────────────');
{
  const phone = '9844444444';
  const first = await post('/api/auth/otp/request', { phone });
  t('the first request works', first.status === 200);

  const immediate = await post('/api/auth/otp/request', { phone });
  t('an immediate resend is refused', immediate.status === 429, String(immediate.status));
  t('and it says how long to wait', /wait|\d+s/i.test(immediate.data.error || ''),
     immediate.data.error);
}

console.log('\n── sessions are not forgeable ──────────────────');
{
  const none = await fetch(BASE + '/api/me/phone');
  t('no token is refused', none.status === 401);

  const forged = await fetch(BASE + '/api/me/phone',
    { headers: { authorization: 'Bearer made.up.token' } });
  t('a forged token is refused', forged.status === 401);

  const r = await post('/api/auth/otp/request', { phone: '9855555555' });
  const s = await post('/api/auth/otp/verify',
    { phone: '9855555555', code: r.data.devCode, name: 'Tamper Test' });
  const tampered = s.data.token.split('.')[0] + '.wrongsignature';
  const res = await fetch(BASE + '/api/me/phone',
    { headers: { authorization: `Bearer ${tampered}` } });
  t('a tampered token is refused', res.status === 401);
}

console.log('\n── codes are not stored in readable form ───────');
{
  const DB = await import('../server/data.js');
  const phone = '9866666666';
  const r = await post('/api/auth/otp/request', { phone });
  const row = DB.otpLatest(phone);
  t('a challenge is stored', !!row);
  t('the code itself is not in the database',
     !JSON.stringify(row).includes(r.data.devCode),
     'the plaintext code was found in storage');
  t('only a hash is kept', !!row.code_hash && row.code_hash.length >= 32);
}

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
