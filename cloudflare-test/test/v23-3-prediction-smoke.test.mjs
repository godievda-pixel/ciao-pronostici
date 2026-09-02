import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertSmokeOrigin,
  proveScoringParity,
  runAuthenticatedPredictionSmoke,
} from '../scripts/smoke-prediction-backend.mjs';

const TEST_ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev';

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

test('prediction smoke origin is TEST-only except explicit localhost unit-test origins', () => {
  assert.equal(assertSmokeOrigin(TEST_ORIGIN).origin, TEST_ORIGIN);
  assert.equal(assertSmokeOrigin('http://127.0.0.1:8787', { allowLocal:true }).local, true);
  assert.throws(() => assertSmokeOrigin('https://ciao-web-app.ciao-web.workers.dev'), /TEST origin/i);
  assert.throws(() => assertSmokeOrigin('https://example.com', { allowLocal:true }), /TEST origin/i);
});

test('prediction smoke proves exhaustive current scorer parity', () => {
  assert.equal(proveScoringParity(), true);
});

test('authenticated smoke proves persistence isolation lock rejection and never emits secrets', async () => {
  const stored = new Map();
  let nextId = 1;
  const requests = [];
  const available = [
    { matchId:'ucl:1', competition:'ucl', state:'open', prediction:null },
    { matchId:'serie_a:2', competition:'serie_a', state:'open', prediction:null },
    { matchId:'uel:3', competition:'uel', state:'locked', prediction:null },
  ];

  const fetchImpl = async (input, init = {}) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request);
    const url = new URL(request.url);
    assert.equal(request.headers.get('x-telegram-init-data') || '', url.pathname === '/healthz' ? '' : 'super-secret-init');

    if (url.pathname === '/healthz') {
      return json({
        ok:true,
        service:'ciao-web-app-test',
        build:'ciao-web-v23-3-test',
        prediction_backend:'durable-object-sqlite',
        prediction_environment:'test',
        prediction_season:'2026-27',
        prediction_do_configured:true,
      });
    }
    if (url.pathname === '/api/v23.3/predictions/available') {
      return json({ ok:true, data:{ matches:available } });
    }
    if (url.pathname === '/api/v23.3/predictions' && request.method === 'POST') {
      const body = await request.json();
      const item = body.predictions[0];
      if (item.match_id === 'uel:3') return json({ ok:false, error:'prediction_locked' }, 409);
      const previous = stored.get(item.match_id);
      const row = {
        prediction_id:previous?.prediction_id || `p${nextId++}`,
        match_id:item.match_id,
        competition:body.competition_key,
        predicted_home:item.home_score,
        predicted_away:item.away_score,
      };
      stored.set(item.match_id, row);
      return json({ ok:true, data:[row] });
    }
    if (url.pathname === '/api/v23.3/predictions' && request.method === 'GET') {
      const competition = url.searchParams.get('competition') || 'all';
      const rows = [...stored.values()].filter(row => competition === 'all' || row.competition === competition);
      return json({ ok:true, data:rows });
    }
    throw new Error(`unexpected ${request.method} ${url.pathname}`);
  };

  const report = await runAuthenticatedPredictionSmoke({
    origin:TEST_ORIGIN,
    initData:'super-secret-init',
    fixtureA:'ucl:1',
    fixtureB:'serie_a:2',
    fetchImpl,
  });

  assert.equal(report.performed, true);
  assert.equal(report.isolatedFixture, true);
  assert.equal(report.persistenceRoundTrip, true);
  assert.equal(report.crossCompetitionIsolation, true);
  assert.equal(report.deadlineBoundaryRejected, true);
  assert.equal(report.scoringParity, true);
  assert.equal(report.productionDataUntouched, true);
  assert.equal(report.fixtureA, 'ucl:1');
  assert.equal(report.fixtureB, 'serie_a:2');
  assert.equal(report.lockedFixture, 'uel:3');
  assert.equal(JSON.stringify(report).includes('super-secret-init'), false);
  assert.equal(requests.every(request => new URL(request.url).origin === TEST_ORIGIN), true);
});

test('package exposes explicit smoke and non-destructive contract probe commands', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['smoke:predictions'], 'node scripts/smoke-prediction-backend.mjs');
  assert.equal(pkg.scripts['probe:predictions'], 'node scripts/probe-prediction-contract.mjs');
  assert.equal(pkg.scripts['probe:reset'], 'node scripts/probe-reset-contract.mjs');
});

test('Ciao TEST CI validates Wrangler bundling after build without deploying', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url), 'utf8');
  assert.match(workflow, /name: Validate TEST Worker bundle/);
  assert.match(workflow, /npx wrangler deploy --dry-run/);
  assert.doesNotMatch(workflow, /run:\s*npx wrangler deploy\s*$/m);
});
