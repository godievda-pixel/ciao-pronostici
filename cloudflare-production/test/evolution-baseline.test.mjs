import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlPath = new URL('../src/v22-5-evolution.html', import.meta.url);

test('evolution starts from the stable v22.5 no-X2 runtime', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /ciao-prod-no-x2-20260903/);
  assert.match(html, /5 \/ 3 \/ 2 \/ 0/);
  assert.match(html, /15 минут/);
});

test('evolution frontend has no second app runtime', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.doesNotMatch(html, /legacy-surface-adapter/);
  assert.doesNotMatch(html, /src\/v23\/app\.mjs/);
  assert.doesNotMatch(html, /modular\/app\.mjs/);
});
