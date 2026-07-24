#!/usr/bin/env node
/**
 * Aurelle — admin password tool.
 *
 * Use when you are locked out and cannot restart with new environment
 * variables (a running production box, or Render's Shell tab).
 *
 *   node tools/set-password.mjs                          list admin accounts
 *   node tools/set-password.mjs you@shop.com NewPass123  set a password
 *
 * Creates the account if that email does not exist yet.
 */
import * as DB from '../server/db.js';

const [, , email, password] = process.argv;

if (!email) {
  const admins = DB.listAdmins();
  console.log(`\nDatabase: ${DB.DB_PATH}`);
  if (!admins.length) {
    console.log('\nNo admin accounts exist. Create one:');
    console.log('  node tools/set-password.mjs you@shop.com YourPassword\n');
  } else {
    console.log(`\n${admins.length} admin account${admins.length === 1 ? '' : 's'}:`);
    admins.forEach(a => console.log(`  ${a.email}   (created ${a.created_at})`));
    console.log('\nReset one:');
    console.log('  node tools/set-password.mjs <email> <new-password>\n');
  }
  process.exit(0);
}

if (!password) {
  console.error('\nA password is required:\n  node tools/set-password.mjs <email> <new-password>\n');
  process.exit(1);
}

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`\n"${email}" is not a valid email address.\n`);
  process.exit(1);
}

if (password.length < 8) {
  console.error('\nUse at least 8 characters. This guards your whole shop.\n');
  process.exit(1);
}

const result = DB.setAdminPassword(email, password);
const normalised = email.toLowerCase().trim();

console.log(`\n${result.created ? 'Created' : 'Updated'} admin account: ${normalised}`);
if (normalised !== email) {
  console.log(`(stored lowercase — sign in with ${normalised})`);
}
console.log(`\nSign in at /admin/ with that email and the new password.`);
console.log(`Note: if ADMIN_EMAIL and ADMIN_PASSWORD are still set in your`);
console.log(`environment, the next restart re-applies those instead.\n`);
