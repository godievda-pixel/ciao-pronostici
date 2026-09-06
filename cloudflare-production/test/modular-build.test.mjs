import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';

test('standalone build has exactly one v23 module entry and no modular overlay entry', async () => {
  const out = await mkdtemp(join(tmpdir(), 'ciao-v23-entry-build-'));
  try {
    await build({ outputDir:out, environment:'test' });
    const html = await readFile(join(out, 'index.html'), 'utf8');
    assert.equal((html.match(/src="\/v23\/app\.mjs"/g) || []).length, 1);
    assert.equal((html.match(/\/modular\//g) || []).length, 0);
    assert.equal((html.match(/data-ciao-modular/g) || []).length, 0);
  } finally {
    await rm(out, { recursive:true, force:true });
  }
});

test('standalone build copies only v23 source assets under the app namespace', async () => {
  const out = await mkdtemp(join(tmpdir(), 'ciao-v23-clean-build-'));
  try {
    await build({ outputDir:out, environment:'test' });
    const app = await readFile(join(out, 'v23/app.mjs'), 'utf8');
    const css = await readFile(join(out, 'v23/styles/base.css'), 'utf8');
    assert.doesNotMatch(`${app}\n${css}`, /legacy-surface-adapter|data-ciao-modular|round51|cw239/i);
    await assert.rejects(() => readFile(join(out, 'modular/app.mjs'), 'utf8'));
  } finally {
    await rm(out, { recursive:true, force:true });
  }
});
