/**
 * Aurelle — admin credential tests.
 *
 * Covers the two lockout bugs found in testing:
 *   1. A capital letter in ADMIN_EMAIL made login impossible, because the
 *      address was stored as typed but looked up lowercased.
 *   2. Changing ADMIN_EMAIL / ADMIN_PASSWORD after the first boot did
 *      nothing — the new credentials were ignored and the published
 *      defaults kept working.
 *
 * Run: node tools/auth-test.mjs
 */
import { rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`ok    ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  → ' + extra : ''}`); }
};

const dir = mkdtempSync(join(tmpdir(), 'aurelle-auth-'));
process.env.DATA_DIR = dir;

// db.js is stateful per process, so import once and drive it directly.
const DB = await import('../server/db.js');

function reset() {
  DB.db.exec('DELETE FROM admins');
}
function setDriver(d) {
  if (d === null) delete process.env.AUTH_DRIVER;
  else process.env.AUTH_DRIVER = d;
}
function setEnv(email, password) {
  if (email === null) delete process.env.ADMIN_EMAIL;
  else process.env.ADMIN_EMAIL = email;
  if (password === null) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = password;
}
/** Mirrors exactly what the login endpoint does. */
function canLogin(email, password) {
  const row = DB.db.prepare('SELECT * FROM admins WHERE email = ?')
    .get(String(email || '').toLowerCase().trim());
  return !!row && DB.verifyPassword(String(password || ''), row.pass_salt, row.pass_hash);
}

console.log('\n── bug 1: capitals in the admin email ──────────');
{
  setDriver(null);
  reset();
  setEnv('Owner@MyShop.com', 'MyPass123');
  const r = DB.ensureAdmin();
  t('account is created', r.mode === 'created', r.mode);
  t('email is stored lowercase',
     DB.listAdmins()[0].email === 'owner@myshop.com', DB.listAdmins()[0].email);
  t('sign in works typed exactly as configured', canLogin('Owner@MyShop.com', 'MyPass123'));
  t('sign in works all lowercase', canLogin('owner@myshop.com', 'MyPass123'));
  t('sign in works shouting', canLogin('OWNER@MYSHOP.COM', 'MyPass123'));
  t('surrounding spaces are tolerated', canLogin('  Owner@MyShop.com  ', 'MyPass123'));
  t('wrong password still rejected', !canLogin('owner@myshop.com', 'nope'));
}

console.log('\n── bug 2: changing credentials after first boot ─');
{
  reset();
  setEnv(null, null);
  const first = DB.ensureAdmin();
  t('defaults seed on a fresh database', first.mode === 'default');
  t('default credentials work initially', canLogin('admin@aurelle.local', 'aurelle-admin'));

  // Operator now sets real credentials and restarts.
  setEnv('owner@myshop.com', 'RealPass456');
  const second = DB.ensureAdmin();
  t('configured account is created on restart', second.mode === 'created', second.mode);
  t('new credentials work', canLogin('owner@myshop.com', 'RealPass456'));
  t('published defaults no longer work',
     !canLogin('admin@aurelle.local', 'aurelle-admin'));
  t('default account is gone', second.removedDefault === true);
  t('only the configured account remains',
     DB.listAdmins().length === 1 && DB.listAdmins()[0].email === 'owner@myshop.com');
}

console.log('\n── rotating the password ───────────────────────');
{
  reset();
  setEnv('owner@myshop.com', 'FirstPass111');
  DB.ensureAdmin();
  t('first password works', canLogin('owner@myshop.com', 'FirstPass111'));

  setEnv('owner@myshop.com', 'SecondPass222');
  const r = DB.ensureAdmin();
  t('restart applies the new password', r.mode === 'updated', r.mode);
  t('new password works', canLogin('owner@myshop.com', 'SecondPass222'));
  t('old password stops working', !canLogin('owner@myshop.com', 'FirstPass111'));
  t('no duplicate account was made', DB.listAdmins().length === 1);
}

console.log('\n── half-configured environment ─────────────────');
{
  reset();
  setEnv('owner@myshop.com', null);
  const r = DB.ensureAdmin();
  t('email without password is reported, not half-applied',
     r.mode === 'incomplete' && r.missing === 'ADMIN_PASSWORD', JSON.stringify(r));
  t('no account is created from half a config', DB.listAdmins().length === 0);

  reset();
  setEnv(null, 'JustAPassword');
  const r2 = DB.ensureAdmin();
  t('password without email is reported', r2.mode === 'incomplete' && r2.missing === 'ADMIN_EMAIL');
}

console.log('\n── restart with nothing configured ─────────────');
{
  reset();
  setEnv(null, null);
  DB.ensureAdmin();
  setEnv('owner@myshop.com', 'KeepThis789');
  DB.ensureAdmin();

  // Operator restarts without the env vars — must not be locked out.
  setEnv(null, null);
  const r = DB.ensureAdmin();
  t('existing account is left alone', r.mode === 'existing', r.mode);
  t('their password still works', canLogin('owner@myshop.com', 'KeepThis789'));
  t('defaults are not resurrected', !canLogin('admin@aurelle.local', 'aurelle-admin'));
}

console.log('\n── Clerk mode: the dashboard allow-list ────────');
{
  // The live bug: with AUTH_DRIVER=clerk there is no password, so no admin
  // row was ever created and every sign-in was refused with 403.
  reset();
  setDriver('clerk');
  setEnv('vhoratanvir1610@gmail.com', null);

  const r = DB.ensureAdmin();
  t('email alone is enough under Clerk', r.mode === 'created', JSON.stringify(r));
  t('the account is on the list',
     DB.listAdmins().some(a => a.email === 'vhoratanvir1610@gmail.com'));

  const found = DB.isAdmin({ email: 'vhoratanvir1610@gmail.com' });
  t('lookup by email succeeds', !!found, JSON.stringify(found));
  t('the role is owner', found && found.role === 'owner');
  t('capitals do not matter', !!DB.isAdmin({ email: 'VhoraTanvir1610@Gmail.com' }));

  // First sign-in binds the Clerk id so later checks skip the email.
  DB.isAdmin({ clerkUserId: 'user_2abc', email: 'vhoratanvir1610@gmail.com' });
  t('the Clerk id is bound on first sign-in', !!DB.isAdmin({ clerkUserId: 'user_2abc' }));

  t('a stranger is refused', DB.isAdmin({ email: 'random@example.com' }) === null);
  t('an unknown Clerk id is refused', DB.isAdmin({ clerkUserId: 'user_nope' }) === null);
  t('no arguments is refused', DB.isAdmin({}) === null);
}

console.log('\n── Clerk mode: the published default is removed ─');
{
  reset();
  setDriver(null);
  setEnv(null, null);
  DB.ensureAdmin();  // seeds admin@aurelle.local
  t('default exists first', !!DB.isAdmin({ email: 'admin@aurelle.local' }));

  setDriver('clerk');
  setEnv('vhoratanvir1610@gmail.com', null);
  const r = DB.ensureAdmin();
  t('default is deleted once a real admin is set', r.removedDefault === true);
  t('default can no longer reach the dashboard',
     DB.isAdmin({ email: 'admin@aurelle.local' }) === null);
}

console.log('\n── Clerk mode: adding a second administrator ───');
{
  reset();
  setDriver('clerk');
  setEnv('vhoratanvir1610@gmail.com', null);
  DB.ensureAdmin();

  DB.addAdmin({ email: 'Manager@Shop.com', name: 'Shop manager' });
  t('second admin is added lowercase', !!DB.isAdmin({ email: 'manager@shop.com' }));
  t('their role defaults to manager',
     DB.isAdmin({ email: 'manager@shop.com' }).role === 'manager');
  t('the owner is unaffected', !!DB.isAdmin({ email: 'vhoratanvir1610@gmail.com' }));
  t('both are listed', DB.listAdmins().length === 2);

  DB.ensureAdmin();
  t('a restart keeps both', DB.listAdmins().length === 2);
}

console.log('\n── Clerk on, but no ADMIN_EMAIL ────────────────');
{
  // Seeding the local default here would create an account nobody can ever
  // sign into, while making the shop look like it has an administrator.
  reset();
  setDriver('clerk');
  setEnv(null, null);

  const r = DB.ensureAdmin();
  t('the situation is reported as none', r.mode === 'none', JSON.stringify(r));
  t('no phantom admin is created', DB.listAdmins().length === 0);
  t('the published default is not seeded',
     DB.isAdmin({ email: 'admin@aurelle.local' }) === null);

  // Setting it later must work without wiping anything.
  setEnv('vhoratanvir1610@gmail.com', null);
  const r2 = DB.ensureAdmin();
  t('setting it afterwards creates the admin', r2.mode === 'created');
  t('and that account can now be found',
     !!DB.isAdmin({ email: 'vhoratanvir1610@gmail.com' }));
}

console.log('\n── the manual reset tool ───────────────────────');
{
  setDriver(null);
  reset();
  setEnv(null, null);
  DB.ensureAdmin();

  const r = DB.setAdminPassword('Locked@Out.com', 'RescuePass999');
  t('reset tool creates a missing account', r.created === true);
  t('reset tool lowercases the email', r.email === 'locked@out.com');
  t('rescued credentials work', canLogin('Locked@Out.com', 'RescuePass999'));

  const r2 = DB.setAdminPassword('locked@out.com', 'AnotherPass000');
  t('reset tool updates an existing account', r2.updated === true);
  t('the newest password works', canLogin('locked@out.com', 'AnotherPass000'));
  t('the previous one does not', !canLogin('locked@out.com', 'RescuePass999'));
}

console.log('\n── two admins can coexist ──────────────────────');
{
  setDriver(null);   // back to local password auth for this block
  reset();
  setEnv('owner@myshop.com', 'OwnerPass123');
  DB.ensureAdmin();
  DB.setAdminPassword('manager@myshop.com', 'ManagerPass123');
  t('both accounts exist', DB.listAdmins().length === 2);
  t('owner can sign in', canLogin('owner@myshop.com', 'OwnerPass123'));
  t('manager can sign in', canLogin('manager@myshop.com', 'ManagerPass123'));

  // Restarting with the owner configured must not delete the manager.
  DB.ensureAdmin();
  t('restart keeps the second admin', DB.listAdmins().length === 2);
}

rmSync(dir, { recursive: true, force: true });

console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
