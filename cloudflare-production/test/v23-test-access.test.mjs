import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const apiPath = new URL('../../supabase/functions/ciao-v23-api/index.ts', import.meta.url);
const migrationPath = new URL('../../supabase/migrations/20260906183000_ciao_v23_test_access.sql', import.meta.url);

test('v23 TEST backend requires an explicit private allowlist before membership/user creation', async () => {
  const source = await readFile(apiPath, 'utf8');
  assert.match(source, /cp_test_access/);
  assert.match(source, /test_access_denied/);
  const accessCheck = source.indexOf('requireTestAccess(telegramId)');
  const membershipCheck = source.indexOf('requireMembership(telegramId)');
  const userCreation = source.indexOf('ensureUser(tgUser)');
  assert.ok(accessCheck >= 0, 'missing TEST allowlist check');
  assert.ok(accessCheck < membershipCheck, 'allowlist must run before channel membership lookup');
  assert.ok(accessCheck < userCreation, 'allowlist must run before TEST user creation');
});

test('TEST allowlist table is private by default', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /create table if not exists public\.cp_test_access/i);
  assert.match(sql, /telegram_id\s+bigint\s+primary key/i);
  assert.match(sql, /enable row level security/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.cp_test_access/i, 'personal tester ids must not be committed to git');
});
