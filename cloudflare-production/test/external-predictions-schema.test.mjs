import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const path = new URL('../../supabase/migrations/20260907_ciao_external_predictions.sql', import.meta.url);
const cronPath = new URL('../../supabase/migrations/20260907_ciao_external_predictions_cron.sql', import.meta.url);

test('external prediction migration defines isolated RLS-protected storage and unified view', async () => {
  const sql = await readFile(path, 'utf8');
  for (const fragment of [
    'create table public.cp_external_matches',
    'create table public.cp_external_predictions',
    'unique (competition, provider_event_id)',
    'unique (user_id, external_match_id)',
    'enable row level security',
    'create or replace view public.cp_prediction_results_unified',
    "'external_predictions_v1'",
  ]) assert.ok(sql.toLowerCase().includes(fragment.toLowerCase()), fragment);
});

test('external prediction cron settles in background only while feature flag is enabled', async () => {
  const sql = await readFile(cronPath, 'utf8');
  for (const fragment of [
    'create or replace function public.ciao_external_cron_token()',
    "'ciao-external-predictions-sync'",
    "'*/5 * * * *'",
    "'x-ciao-cron-token'",
    '"action":"sync_due"',
    "key = 'external_predictions_v1'",
    'enabled = true',
  ]) assert.ok(sql.toLowerCase().includes(fragment.toLowerCase()), fragment);
});
