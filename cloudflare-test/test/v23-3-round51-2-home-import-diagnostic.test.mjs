import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Round 51.2 Home cutover imports successfully without the historical catch wrapper', async () => {
  const module = await import('../src/v23.3/home-integration.mjs');
  assert.equal(typeof module.renderHomeTodaySection, 'function');
  assert.equal(typeof module.createHomeRuntime, 'function');
});

test('Round 51.2 Home uses the canonical facade while that facade delegates to the new drawer router', async () => {
  const [home, links] = await Promise.all([
    readFile(new URL('../src/v23.3/home-integration.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/v23.3/match-center-links.mjs', import.meta.url), 'utf8'),
  ]);

  assert.match(home, /from ['"]\.\/match-center-links\.mjs['"]/);
  assert.match(home, /installCanonicalMatchLinks\(globalThis\.document\)/);
  assert.match(links, /round51-2-match-center-links\.mjs/);
  assert.match(links, /round51-2-match-center-runtime\.mjs/);
  assert.match(links, /CiaoV233MatchCenterLifecycle\?\.capture/);
  assert.doesNotMatch(links, /suspendMatchSource|restoreMatchSource|\.suspend\?\.|\.restore\?\./);
});
