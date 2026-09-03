import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_BUILD,
  PINNED_BASE_URL,
  RECOVERY_BASE_URL,
  loadBaseHtml,
} from '../scripts/build.mjs';

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
