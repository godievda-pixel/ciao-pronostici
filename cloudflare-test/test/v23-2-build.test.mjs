import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  injectV232Entry,
  copyV232Modules,
} from '../scripts/build.mjs';

test('injects v23.2 core and matches UI module entries exactly once', () => {
  const html = '<html><body><div id="ciao-miniapp-root"></div></body></html>';
  const first = injectV232Entry(html);
  assert.equal(injectV232Entry(first), first);
  assert.match(
    first,
    /type="module" id="ciao-v232-core" src="\/v23\.2\/index\.mjs"/,
  );
  assert.match(
    first,
    /type="module" id="ciao-v232-matches-ui" src="\/v23\.2\/matches-ui\.mjs"/,
  );
  assert.equal((first.match(/id="ciao-v232-matches-ui"/g) || []).length, 1);
});

test('copies v23.2 browser modules to dist', async () => {
  await copyV232Modules();
  const entry = await readFile(
    new URL('../dist/v23.2/index.mjs', import.meta.url),
    'utf8',
  );
  const engine = await readFile(
    new URL('../dist/v23.2/tournament-engine.mjs', import.meta.url),
    'utf8',
  );
  const matchesUi = await readFile(
    new URL('../dist/v23.2/matches-ui.mjs', import.meta.url),
    'utf8',
  );
  assert.match(entry, /CiaoV232Core/);
  assert.match(engine, /availablePredictions/);
  assert.match(matchesUi, /createMatchesUiController/);
});
