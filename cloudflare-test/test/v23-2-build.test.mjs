import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  injectV232Entry,
  copyV232Modules,
} from '../scripts/build.mjs';

test('injects one inert v23.2 module entry', () => {
  const html = '<html><body><div id="ciao-miniapp-root"></div></body></html>';
  const first = injectV232Entry(html);
  assert.equal(injectV232Entry(first), first);
  assert.match(
    first,
    /type="module" id="ciao-v232-core" src="\/v23\.2\/index\.mjs"/,
  );
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
  assert.match(entry, /CiaoV232Core/);
  assert.match(engine, /availablePredictions/);
});
