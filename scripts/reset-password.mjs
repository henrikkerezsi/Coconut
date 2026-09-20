#!/usr/bin/env node
// Reset a user's Supabase (Coconut) password via the GoTrue admin API.
//
// Usage:
//   node scripts/reset-password.mjs                       (prompts for everything)
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/reset-password.mjs user@example.com
//   npm run reset-password
//
// Credentials come from env vars or interactive prompts; the URL and key come
// from Supabase Dashboard -> Settings -> API. The service_role key is the most
// powerful secret in the project (full read/write on auth and all tables), so
// keep it off any shared machine and never edit the app to use it. This script
// refuses to run with the anon/publishable key that the app itself uses.

import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const rl = createInterface({ input, output });

function ask(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function askPassword(prompt) {
  let quiet = false;
  try {
    execSync('stty -echo');
    quiet = true;
  } catch {
    // Not a TTY: keep typing visible rather than failing.
  }
  try {
    const value = await ask(prompt);
    output.write('\n');
    return value;
  } finally {
    if (quiet) {
      execSync('stty echo');
    }
  }
}

function keyRole(key) {
  const payload = key.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(json).role ?? null;
  } catch {
    return null;
  }
}

async function findUser(supabase, target) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)) {
    const { data, error } = await supabase.auth.admin.getUserById(target);
    if (error) {
      throw new Error(`User lookup failed: ${error.message}`);
    }
    return data.user;
  }
  const wanted = target.toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw new Error(`Listing users failed: ${error.message}`);
    }
    const match = data.users.find((user) => (user.email ?? '').toLowerCase() === wanted);
    if (match) {
      return match;
    }
    if (data.nextPage == null) {
      return null;
    }
    page = data.nextPage;
  }
}

async function main() {
  const url = (process.env.SUPABASE_URL ?? (await ask('Supabase project URL: '))).trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? (await ask('Service role key: '))).trim();
  const target =
    (process.argv[2] ?? (await ask('User email or UUID: '))).trim();
  if (!url || !key || !target) {
    throw new Error('URL, service role key and user are all required.');
  }

  const role = keyRole(key);
  if (role !== 'service_role') {
    throw new Error(
      `Key role "${role ?? 'unknown'}" is not service_role — copy the SERVICE ROLE key from ` +
        `Supabase Dashboard -> Settings -> API. The anon/publishable key cannot perform admin actions.`
    );
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const user = await findUser(supabase, target);
  if (!user) {
    throw new Error(`No user found for "${target}".`);
  }

  console.log(`\nTarget user: ${user.email ?? '(no email)'}  (${user.id})`);
  if (!user.email_confirmed_at) {
    console.log('Warning: this account is not email-confirmed; the password will apply once it is.');
  }

  const password = await askPassword('\nNew password: ');
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  const repeat = await askPassword('Repeat new password: ');
  if (password !== repeat) {
    throw new Error('Passwords do not match; nothing was changed.');
  }

  const ok = await ask(
    `\nSet a new password for ${user.email ?? user.id}? ` +
      `This signs the user out of any active sessions. Type "yes" to continue: `
  );
  if (ok.trim().toLowerCase() !== 'yes') {
    throw new Error('Aborted; nothing was changed.');
  }

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (error) {
    throw new Error(`Password reset failed: ${error.message}`);
  }
  console.log(
    `\nPassword reset for ${data.user.email ?? data.user.id}. ` +
      `Tell them to sign in with the new password.`
  );
}

main()
  .catch((err) => {
    console.error(`\n${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => rl.close());