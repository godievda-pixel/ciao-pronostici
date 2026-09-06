import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rootHtmlFor, injectModularAssets, copyModularAssets } from '../scripts/build.mjs';

test('modular build injects exactly one inert module and stylesheet while preserving baseline', () => {
  const release = '<!doctype html><html><head><meta name="ciao-build" content="ciao-prod-no-x2-20260903"></head><body><div id="ciao-miniapp-root"></div></body></html>';
  const html = rootHtmlFor({ release });
  const injected = injectModularAssets(html);
  assert.match(injected, /ciao-prod-no-x2-20260903/);
  assert.equal((injected.match(/data-ciao-modular="main-v1"/g) || []).length, 2);
  assert.equal((injected.match(/href="\/modular\/app\.css"/g) || []).length, 1);
  assert.equal((injected.match(/src="\/modular\/app\.mjs"/g) || []).length, 1);
  assert.doesNotMatch(injected, /round51|round50|cw239|ciao-web-app-test/i);
});

test('modular build copies inert assets to dist/modular', async () => {
  const target = await mkdtemp(join(tmpdir(), 'ciao-modular-'));
  await copyModularAssets({
    sourceDir: new URL('../src/modular/', import.meta.url),
    distDir: target,
  });
  const js = await readFile(join(target, 'app.mjs'), 'utf8');
  const css = await readFile(join(target, 'app.css'), 'utf8');
  assert.match(js, /main-modular-v1/);
  assert.equal(css.trim(), '');
  assert.doesNotMatch(js + css, /round51|round50|cw239|ciao-web-app-test/i);
});
