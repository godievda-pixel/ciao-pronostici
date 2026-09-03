import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BASE_BUILD,
  PINNED_BASE_URL,
  RECOVERY_BASE_URL,
  loadBaseHtml,
} from '../scripts/test-baseline.mjs';

const validBase = `<!doctype html><html><head><meta name="build" content="${BASE_BUILD}"></head><body></body></html>`;

test('TEST build prefers pinned baseline and falls back to current TEST root when pinned baseline is not created yet', async () => {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(String(url));
    if (String(url) === PINNED_BASE_URL) return new Response('missing', { status:404 });
    if (String(url) === RECOVERY_BASE_URL) return new Response(validBase, { status:200 });
    return new Response('missing', { status:404 });
  };

  const result = await loadBaseHtml({ fetchImpl, includeLegacyBase:false });

  assert.equal(result.html, validBase);
  assert.equal(result.sourceUrl, RECOVERY_BASE_URL);
  assert.deepEqual(calls, [PINNED_BASE_URL, RECOVERY_BASE_URL]);
});

test('TEST baseline recovery rejects a successful response without the expected v23.1 base marker', async () => {
  const fetchImpl = async url => {
    if (String(url) === PINNED_BASE_URL) return new Response('missing', { status:404 });
    return new Response('<html><body>wrong base</body></html>', { status:200 });
  };

  await assert.rejects(
    () => loadBaseHtml({ fetchImpl, includeLegacyBase:false }),
    /base build marker missing/,
  );
});

test('npm build uses the TEST baseline wrapper instead of the mutable Production base directly', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts.build, 'node scripts/build-with-test-baseline.mjs');
});

test('API contract inspector reuses the TEST baseline loader instead of the retired Production v23.1 URL', async () => {
  const source = await readFile(new URL('../scripts/inspect-api-contract.mjs', import.meta.url), 'utf8');
  assert.match(source, /from '\.\/test-baseline\.mjs'/);
  assert.match(source, /loadBaseHtml\(\{\s*includeLegacyBase:false\s*\}\)/);
  assert.doesNotMatch(source, /ciao-web-app\.ciao-web\.workers\.dev\/releases\/v23\.1/);
});
