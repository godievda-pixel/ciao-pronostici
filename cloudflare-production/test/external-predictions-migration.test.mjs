import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const path = new URL('../../supabase/migrations/20260906150000_ciao_competition_predictions.sql', import.meta.url);

test('external predictions use an additive table and do not mutate legacy cp_predictions', async () => {
  const sql = await readFile(path, 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.cp_competition_predictions/i);
  assert.match(sql, /user_id\s+bigint\s+NOT NULL\s+REFERENCES public\.cp_users\(id\)/i);
  assert.match(sql, /match_id\s+text\s+NOT NULL/i);
  assert.match(sql, /competition\s+text\s+NOT NULL\s+CHECK\s*\(competition IN \('coppa_italia','ucl','uel','uecl'\)\)/i);
  assert.match(sql, /UNIQUE\s*\(user_id,\s*match_id\)/i);
  assert.match(sql, /predicted_home\s+smallint\s+NOT NULL\s+CHECK\s*\(predicted_home BETWEEN 0 AND 20\)/i);
  assert.match(sql, /predicted_away\s+smallint\s+NOT NULL\s+CHECK\s*\(predicted_away BETWEEN 0 AND 20\)/i);
  assert.match(sql, /locked_at\s+timestamp with time zone\s+NOT NULL/i);
  assert.match(sql, /result_fingerprint\s+text/i);
  assert.doesNotMatch(sql, /ALTER\s+TABLE\s+(?:public\.)?cp_predictions/i);
  assert.doesNotMatch(sql, /DROP\s+TABLE/i);
});
