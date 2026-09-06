import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build, TEST_API_URL } from '../scripts/build.mjs';

test('default TEST build emits a standalone root configured for dedicated v23 API', async () => {
  const out = await mkdtemp(join(tmpdir(), 'ciao-v23-build-'));
  try {
    const result = await build({ outputDir:out, environment:'test' });
    assert.equal(result.ok, true);
    assert.equal(result.apiUrl, TEST_API_URL);
    const html = await readFile(join(out, 'index.html'), 'utf8');
    assert.match(html, /data-ciao-app="v23"/);
    assert.match(html, /\/v23\/app\.mjs/);
    assert.match(html, new RegExp(TEST_API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    await rm(out, { recursive:true, force:true });
  }
});

test('production-like build requires an explicit API URL', async () => {
  const out = await mkdtemp(join(tmpdir(), 'ciao-v23-production-build-'));
  const previous = process.env.CIAO_API_URL;
  delete process.env.CIAO_API_URL;
  try {
    await assert.rejects(
      () => build({ outputDir:out, environment:'production' }),
      /CIAO_API_URL is required outside TEST/,
    );
  } finally {
    if (previous === undefined) delete process.env.CIAO_API_URL;
    else process.env.CIAO_API_URL = previous;
    await rm(out, { recursive:true, force:true });
  }
});

test('standalone build copies the local v23 module/style tree without a release fetch', async () => {
  const out = await mkdtemp(join(tmpdir(), 'ciao-v23-tree-build-'));
  try {
    await build({ outputDir:out, environment:'test' });
    assert.match(await readFile(join(out, 'v23/app.mjs'), 'utf8'), /app-shell/);
    assert.match(await readFile(join(out, 'v23/styles/tokens.css'), 'utf8'), /--bg:/);
    await assert.rejects(() => readFile(join(out, 'releases/v22-5.html'), 'utf8'));
  } finally {
    await rm(out, { recursive:true, force:true });
  }
});
