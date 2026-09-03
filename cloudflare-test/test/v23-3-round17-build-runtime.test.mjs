import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { copyV233Modules } from '../scripts/build.mjs';

test('Round 17 build ships the routed Match Center facade and its core module together', async () => {
  const files = await copyV233Modules();
  assert.equal(files.includes('match-center.mjs'), true);
  assert.equal(files.includes('match-center-core.mjs'), true);
  assert.equal(files.includes('match-center-links.mjs'), true);

  const facade = await readFile(new URL('../dist/v23.3/match-center.mjs', import.meta.url), 'utf8');
  const core = await readFile(new URL('../dist/v23.3/match-center-core.mjs', import.meta.url), 'utf8');
  assert.match(facade, /match-center-core\.mjs/);
  assert.match(core, /createMatchCenterController/);
});
