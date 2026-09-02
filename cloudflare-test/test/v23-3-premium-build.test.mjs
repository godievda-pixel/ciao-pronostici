import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { copyV233Modules } from '../scripts/build.mjs';

test('v23.3 build ships premium polish runtime imported by index', async () => {
  const files = await copyV233Modules();
  assert.equal(files.includes('premium-polish-ui.mjs'), true);
  const source = await readFile(new URL('../dist/v23.3/premium-polish-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /installPremiumPolishUi/);
  assert.match(source, /cw232-tournament-card__eyebrow/);
  assert.match(source, /@media\(max-width:620px\)/);
});
