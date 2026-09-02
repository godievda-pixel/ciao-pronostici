import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { probeRound5Deployment } from '../scripts/probe-round5-deployment.mjs';

function response(text, status = 200) {
  return new Response(text, { status, headers:{ 'content-type':'text/javascript' } });
}

test('round5 deployment probe requires ranking isolation and stable Serie A crest bridge on live static modules', async () => {
  const seen = [];
  const result = await probeRound5Deployment({
    fetchImpl:async url => {
      const path = new URL(url).pathname;
      seen.push(path);
      if (path === '/v23.3/index.mjs') {
        return response("import './serie-a-legacy-bridge.mjs';\nexport const CiaoV233={};");
      }
      if (path === '/v23.3/ranking-ui.mjs') {
        return response("export const USER_FEEDBACK_ROUND5_BUILD='2026-09-02-r5'; const html='cw233-ranking-position-value cw233-ranking-name cw233-ranking-points-value cw233-ranking-points-unit';");
      }
      if (path === '/v23.3/serie-a-legacy-bridge.mjs') {
        return response("const LEGACY_CORE_API='/api/ciao-core-api-fast-v4'; const body={action:'state'}; const marker='cw233-table-logo-fallback';");
      }
      throw new Error(`unexpected ${path}`);
    },
    origin:'https://test.example/',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(seen.sort(), [
    '/v23.3/index.mjs',
    '/v23.3/ranking-ui.mjs',
    '/v23.3/serie-a-legacy-bridge.mjs',
  ].sort());
});

test('round5 deployment probe rejects old ranking or missing crest bridge', async () => {
  await assert.rejects(
    () => probeRound5Deployment({
      fetchImpl:async url => {
        const path = new URL(url).pathname;
        if (path === '/v23.3/index.mjs') return response("export const CiaoV233={};");
        if (path === '/v23.3/ranking-ui.mjs') return response("const old='class=\\\"pos\\\"';");
        return response('not found', 404);
      },
      origin:'https://test.example/',
    }),
    /round5_deployment_incomplete/,
  );
});

test('TEST workflow runs the dedicated round5 live probe after the general deployed marker probe', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url), 'utf8');
  const general = workflow.indexOf('node scripts/probe-test-deployment-v233.mjs');
  const round5 = workflow.indexOf('node scripts/probe-round5-deployment.mjs');
  assert.ok(general >= 0);
  assert.ok(round5 > general);
});
