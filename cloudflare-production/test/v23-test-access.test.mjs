import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20260906183000_ciao_v23_test_access.sql', import.meta.url);

test('v23 TEST access is enforced by a private Telegram-id allowlist', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /create table if not exists public\.cp_test_access/i);
  assert.match(sql, /telegram_id\s+bigint\s+primary key/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /foreign key\s*\(telegram_id\)\s*references\s+public\.cp_test_access\s*\(telegram_id\)/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.cp_test_access/i, 'personal tester ids must not be committed to git');
});
