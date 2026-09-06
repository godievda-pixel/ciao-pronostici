import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const buildUrl = new URL('../scripts/build.mjs', import.meta.url);
const indexUrl = new URL('../src/v23/index.html', import.meta.url);

test('v23 build source is standalone and contains no v22.5/modular-overlay pipeline', async () => {
  const source = await readFile(buildUrl, 'utf8');
  assert.doesNotMatch(source, /RELEASE_SOURCE_URL|v22-5|injectModularAssets|legacy-surface-adapter/);
  assert.match(source, /src\/v23/);
  assert.match(source, /ciao-api-url/);
});

test('v23 owns a minimal standalone HTML shell', async () => {
  const html = await readFile(indexUrl, 'utf8');
  assert.match(html, /<html\s+lang=["']ru["']/i);
  assert.match(html, /data-ciao-app=["']v23["']/);
  assert.match(html, /meta\s+name=["']ciao-api-url["']/);
  assert.match(html, /src=["']\/v23\/app\.mjs["']/);
  assert.doesNotMatch(html, /releases\/v22-5|data-ciao-modular|legacy-surface-adapter/);
});
