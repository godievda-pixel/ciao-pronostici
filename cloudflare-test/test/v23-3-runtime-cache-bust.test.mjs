import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function buildModule() {
  return import('../scripts/build.mjs');
}

test('v23.3 TEST entry supports a content-addressed runtime base so Telegram cannot reuse stale modules', async () => {
  const { injectV233Entry } = await buildModule();
  const base = '<html><head></head><body><main>app</main></body></html>';
  const html = injectV233Entry(base, '/v23.3-runtime-deadbeefcafe');
  assert.match(html, /src="\/v23\.3-runtime-deadbeefcafe\/index\.mjs"/);
  assert.doesNotMatch(html, /src="\/v23\.3\/index\.mjs"/);
});

test('build can copy the whole v23.3 ESM graph to one content-addressed directory', async () => {
  const { copyVersionedV233Modules } = await buildModule();
  assert.equal(typeof copyVersionedV233Modules, 'function');
  const result = await copyVersionedV233Modules();
  assert.match(result.runtimeBase, /^\/v23\.3-runtime-[0-9a-f]{12}$/);
  assert.equal(result.files.includes('index.mjs'), true);
  assert.equal(result.files.includes('profile-rating-ui.mjs'), true);

  const runtimeDir = result.runtimeBase.slice(1);
  const index = await readFile(new URL(`../dist/${runtimeDir}/index.mjs`, import.meta.url), 'utf8');
  const profile = await readFile(new URL(`../dist/${runtimeDir}/profile-rating-ui.mjs`, import.meta.url), 'utf8');
  assert.match(index, /profile-rating-ui\.mjs/);
  assert.match(profile, /USER_FEEDBACK_ROUND15_PROFILE_BUILD/);
});

test('main build injects the content-addressed v23.3 runtime rather than the legacy stable module URL', async () => {
  const source = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  assert.match(source, /copyVersionedV233Modules\s*\(/);
  assert.match(source, /injectV233Entry\([\s\S]*runtimeBase/);
});
