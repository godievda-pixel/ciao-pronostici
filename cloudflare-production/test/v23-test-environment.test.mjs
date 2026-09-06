import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PROD_SUPABASE_REF, TEST_API_URL } from '../scripts/build.mjs';

const wrangler = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const buildSource = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
const TEST_ORIGIN = 'https://lcnwccnkkxaosxnfvjvr.supabase.co';

test('v23 TEST build config points only at the dedicated standalone API', () => {
  assert.equal(TEST_API_URL, `${TEST_ORIGIN}/functions/v1/ciao-v23-api`);
  assert.equal(TEST_API_URL.includes(PROD_SUPABASE_REF), false);
});

test('v23 TEST Wrangler cannot deploy over Production Worker', () => {
  assert.match(wrangler, /"name"\s*:\s*"ciao-web-v23-test"/);
  assert.doesNotMatch(wrangler, /"name"\s*:\s*"ciao-web-app"/);
});

test('TEST build injects config into the standalone shell and rejects production references', () => {
  assert.match(buildSource, /TEST_API_URL/);
  assert.match(buildSource, /assertTestIsolation/);
  assert.match(buildSource, /production Supabase reference in TEST build/i);
  assert.match(buildSource, /ciao-api-url/);
  assert.match(buildSource, /dkefzepiiudehhzbbrjn/);
  assert.match(buildSource, /lcnwccnkkxaosxnfvjvr/);
  assert.doesNotMatch(buildSource, /rewriteTestSupabaseOrigin|RELEASE_SOURCE_URL/);
});
