import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('TEST deployment probe verifies the exact round7 regression runtime', async () => {
  const source = await readFile(new URL('../scripts/probe-test-deployment-v233.mjs', import.meta.url), 'utf8');
  assert.match(source, /'\/v23\.3\/round7-regression-fixes\.mjs'/);
  assert.match(source, /hasRound7Runtime/);
  assert.match(source, /USER_FEEDBACK_ROUND7_BUILD/);
  assert.match(source, /cw232-serie-a-back/);
  assert.match(source, /z-index:80!important/);
  assert.match(source, /min-width:660px!important/);
  assert.match(source, /round7Module\?\.hasRound7Runtime/);
});
