import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexPath = new URL('../../supabase/functions/ciao-v23-api/index.ts', import.meta.url);

const REQUIRED = [
  'modular_matches',
  'modular_standings',
  'modular_favorite',
  'modular_predictions',
  'modular_save_predictions',
  'modular_ranking',
  'modular_match_center',
];

test('ciao-v23-api is the closed modular backend and has no legacy core proxy chain', async () => {
  const source = await readFile(indexPath, 'utf8');
  for (const action of REQUIRED) assert.match(source, new RegExp(action));
  assert.doesNotMatch(source, /ciao-core-api-fast-v5/);
  assert.doesNotMatch(source, /ciao-core-api-fast-v4/);
  assert.doesNotMatch(source, /functions\/v1\/ciao-core-api-fast(?:["'`])/);
  assert.match(source, /ciao-web-v23-test\.ciao-web\.workers\.dev/);
});
