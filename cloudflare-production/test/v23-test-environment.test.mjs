import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CURRENT_API } from '../src/modular/data/api-contract.mjs';

const wrangler = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const buildSource = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');

const PROD_REF = 'dkefzepiiudehhzbbrjn';
const TEST_ORIGIN = 'https://lcnwccnkkxaosxnfvjvr.supabase.co';

test('v23 TEST client points only at the dedicated Supabase API', () => {
  assert.equal(CURRENT_API.origin, TEST_ORIGIN);
  assert.equal(CURRENT_API.core, `${TEST_ORIGIN}/functions/v1/ciao-v23-api`);
  assert.equal(JSON.stringify(CURRENT_API).includes(PROD_REF), false);
});

test('v23 TEST Wrangler cannot deploy over Production Worker', () => {
  assert.match(wrangler, /"name"\s*:\s*"ciao-web-v23-test"/);
  assert.doesNotMatch(wrangler, /"name"\s*:\s*"ciao-web-app"/);
});

test('TEST build rewrites and rejects Production Supabase references', () => {
  assert.match(buildSource, /rewriteTestSupabaseOrigin/);
  assert.match(buildSource, /production Supabase reference remains/i);
  assert.match(buildSource, /dkefzepiiudehhzbbrjn/);
  assert.match(buildSource, /lcnwccnkkxaosxnfvjvr/);
});
