import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Round 51.2 Home cutover imports successfully without the historical catch wrapper', async () => {
  const module = await import('../src/v23.3/home-integration.mjs');
  assert.equal(typeof module.renderHomeTodaySection, 'function');
  assert.equal(typeof module.createHomeRuntime, 'function');
});

test('Round 51.2 Home cutover preserves the historical canonical installer build marker while importing the new router', async () => {
  const source = await readFile(new URL('../src/v23.3/home-integration.mjs', import.meta.url), 'utf8');
  assert.match(source, /installCanonicalMatchLinks/);
  assert.match(source, /round51-2-match-center-links\.mjs/);
  assert.doesNotMatch(source, /from ['"]\.\/match-center-links\.mjs['"]/);
});
