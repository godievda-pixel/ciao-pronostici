import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourcePath = new URL('../../supabase/functions/ciao-core-api-fast-v6/index.ts', import.meta.url);

test('Core v6 source owns modular actions instead of proxying them to v5', async () => {
  const source = await readFile(sourcePath, 'utf8');
  assert.match(source, /createModularActionRouter/);
  assert.match(source, /createModularRuntime/);
  assert.match(source, /createBsdModularProvider/);
  assert.match(source, /isModularAction\(action\)/);
  assert.match(source, /modular_actions/);
  assert.doesNotMatch(source, /\/api\/modular\//);
});

test('Core v6 keeps legacy state and no-x2 behavior while adding modular routing', async () => {
  const source = await readFile(sourcePath, 'utf8');
  assert.match(source, /set_round_bonus/);
  assert.match(source, /bonus_removed/);
  assert.match(source, /withoutRoundBonus/);
  assert.match(source, /favorite_club_profile/);
  assert.match(source, /ciao-core-api-fast-v5/);
});
