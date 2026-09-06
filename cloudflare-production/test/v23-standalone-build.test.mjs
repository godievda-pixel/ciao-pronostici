import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const buildUrl = new URL('../scripts/build.mjs', import.meta.url);
const indexUrl = new URL('../src/v23/index.html', import.meta.url);
const TEST_API = 'https://lcnwccnkkxaosxnfvjvr.supabase.co/functions/v1/ciao-v23-api';

const sha256 = value => createHash('sha256').update(value).digest('hex');

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

test('only index config changes between TEST and production-like standalone builds', async () => {
  const { build } = await import(buildUrl);
  const testDir = await mkdtemp(join(tmpdir(), 'ciao-v23-test-build-'));
  const otherDir = await mkdtemp(join(tmpdir(), 'ciao-v23-other-build-'));
  try {
    await build({ apiUrl:TEST_API, outputDir:testDir, environment:'test' });
    await build({ apiUrl:'https://example.invalid/functions/v1/ciao-v23-api', outputDir:otherDir, environment:'production' });

    const testHtml = await readFile(join(testDir, 'index.html'), 'utf8');
    const otherHtml = await readFile(join(otherDir, 'index.html'), 'utf8');
    assert.match(testHtml, new RegExp(TEST_API.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(otherHtml, /https:\/\/example\.invalid\/functions\/v1\/ciao-v23-api/);

    const testApp = await readFile(join(testDir, 'v23/app.mjs'));
    const otherApp = await readFile(join(otherDir, 'v23/app.mjs'));
    assert.equal(sha256(testApp), sha256(otherApp));
  } finally {
    await rm(testDir, { recursive:true, force:true });
    await rm(otherDir, { recursive:true, force:true });
  }
});
