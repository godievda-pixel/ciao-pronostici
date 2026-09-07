import assert from 'node:assert/strict';
import test from 'node:test';
import { rewriteLegacyFunctionEndpoints } from '../scripts/build-evolution.mjs';

const PROD = 'dkefzepiiudehhzbbrjn';
const TEST = 'lcnwccnkkxaosxnfvjvr';

test('stable v22.5 function endpoints are rewritten to one TEST ciao-v23-api with legacy slug suffix', () => {
  const input = [
    `https://${PROD}.supabase.co/functions/v1/ciao-core-api-fast-v4`,
    `https://${PROD}.supabase.co/functions/v1/ciao-match-center-fast-v3`,
    `https://${PROD}.supabase.co/functions/v1/ciao-schedule-fast-v1`,
  ].join('\n');
  const out = rewriteLegacyFunctionEndpoints(input);
  assert.match(out, new RegExp(`https://${TEST}\\.supabase\\.co/functions/v1/ciao-v23-api/ciao-core-api-fast-v4`));
  assert.match(out, new RegExp(`https://${TEST}\\.supabase\\.co/functions/v1/ciao-v23-api/ciao-match-center-fast-v3`));
  assert.match(out, new RegExp(`https://${TEST}\\.supabase\\.co/functions/v1/ciao-v23-api/ciao-schedule-fast-v1`));
  assert.doesNotMatch(out, new RegExp(`${PROD}\\.supabase\\.co/functions/v1/`));
});

test('query strings appended by v22.5 remain valid after path-suffix rewrite', () => {
  const input = `const API='https://${PROD}.supabase.co/functions/v1/ciao-core-api-fast-v4'; const url=API+'?asset=emoji&id=1';`;
  const out = rewriteLegacyFunctionEndpoints(input);
  assert.match(out, /ciao-v23-api\/ciao-core-api-fast-v4'; const url=API\+'\?asset=emoji/);
});
