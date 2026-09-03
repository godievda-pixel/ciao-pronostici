import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPredictionClient } from '../src/v23.3/prediction-client.mjs';
import { createPredictionService } from '../src/v23.3/prediction-service.mjs';

const request = new Request('https://ciao-web-app-test.example/api/v23.3/predictions', {
  headers:{ 'x-telegram-init-data':'tg' },
});

function authUser() {
  return { userId:'telegram:42', displayName:'Daniil', username:'danx95' };
}

function uefaMatch(id, round, status = 'scheduled', extra = {}) {
  return {
    matchId:`ucl:${id}`,
    competition:'ucl',
    season:'2026-27',
    stage:'League Stage',
    round,
    kickoffAt:`2026-09-${String(10 + round).padStart(2, '0')}T19:00:00Z`,
    status,
    homeTeam:{ id:`h${id}`, name:'Интер', crestUrl:'' },
    awayTeam:{ id:`a${id}`, name:'Арсенал', crestUrl:'' },
    homeScore:status === 'finished' ? 1 : null,
    awayScore:status === 'finished' ? 0 : null,
    rawVersion:`r${round}`,
    ...extra,
  };
}

function predictionNamespace({ reconciled = [], predictions = [] } = {}) {
  const requests = [];
  return {
    requests,
    idFromName(name) { return `id:${name}`; },
    get() {
      return {
        async fetch(req) {
          requests.push(req);
          const url = new URL(req.url);
          if (url.pathname === '/user') return Response.json({ ok:true, predictions });
          if (url.pathname === '/reconciled') return Response.json({ ok:true, match_ids:reconciled });
          if (url.pathname === '/write') {
            const body = await req.json();
            return Response.json({ ok:true, predictions:body.predictions.map((row, index) => ({ prediction_id:`p${index}`, user_id:'telegram:42', ...row })) });
          }
          if (url.pathname === '/participants') return Response.json({ ok:true, participants:[] });
          if (url.pathname === '/rankings') return Response.json({ ok:true, ranking:[] });
          if (url.pathname === '/rankings/me') return Response.json({ ok:true, ranking:null });
          if (url.pathname === '/reconcile') return Response.json({ ok:true, affected:0, skipped:0 });
          throw new Error(`unexpected ${url.pathname}`);
        },
      };
    },
  };
}

function env(ns) {
  return {
    CIAO_ENV:'test',
    PREDICTION_SEASON:'2026-27',
    PREDICTION_LEAGUE:ns,
  };
}

test('prediction client deduplicates identical in-flight GETs and serves a short-lived cache', async () => {
  let calls = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const client = createPredictionClient({
    initData:'tg',
    origin:'https://test.example',
    fetchImpl:async () => {
      calls += 1;
      await pending;
      return Response.json({ ok:true, data:{ matches:[{ matchId:'serie_a:1' }] } });
    },
  });

  const first = client.available('all');
  const second = client.available('all');
  assert.equal(calls, 1, 'identical concurrent GETs must share one request');
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(a, b);
  await client.available('all');
  assert.equal(calls, 1, 'fresh cached GET must not hit network again');
});

test('ranking GETs are cached per scope/filter and deduplicated independently', async () => {
  let calls = 0;
  const client = createPredictionClient({
    initData:'tg',
    origin:'https://test.example',
    fetchImpl:async req => {
      calls += 1;
      const scope = new URL(req.url).searchParams.get('scope');
      return Response.json({ ok:true, data:[{ user_id:`u:${scope}:${calls}`, points:1 }] });
    },
  });

  await client.rankings({ scope:'overall' });
  await client.rankings({ scope:'overall' });
  await client.rankings({ scope:'competition', competition:'ucl' });
  await client.rankings({ scope:'competition', competition:'ucl' });
  assert.equal(calls, 2);
});

test('UEFA available locks the next round until every match in the previous round is reconciled', async () => {
  const ns = predictionNamespace({ reconciled:[] });
  const canonical = [uefaMatch('r1a', 1, 'finished'), uefaMatch('r2a', 2, 'scheduled')];
  const service = createPredictionService({
    request,
    env:env(ns),
    now:new Date('2026-09-05T00:00:00Z'),
    deps:{
      resolveAuthenticatedUser:async () => authUser(),
      listCanonicalPredictionMatches:async () => ({ matches:canonical, errors:{} }),
    },
  });

  const result = await service.available('ucl');
  const round2 = result.matches.find(row => row.round === 2);
  assert.equal(round2.state, 'round_locked');
  assert.equal(round2.roundLocked, true);
  assert.equal(round2.roundLockReason, 'previous_round_not_reconciled');
});

test('UEFA available opens exactly the next round after the prior round is fully reconciled', async () => {
  const round1 = uefaMatch('r1a', 1, 'finished');
  const ns = predictionNamespace({ reconciled:[round1.matchId] });
  const canonical = [round1, uefaMatch('r2a', 2, 'scheduled'), uefaMatch('r3a', 3, 'scheduled')];
  const service = createPredictionService({
    request,
    env:env(ns),
    now:new Date('2026-09-05T00:00:00Z'),
    deps:{
      resolveAuthenticatedUser:async () => authUser(),
      listCanonicalPredictionMatches:async () => ({ matches:canonical, errors:{} }),
    },
  });

  const result = await service.available('ucl');
  assert.equal(result.matches.find(row => row.round === 2).state, 'open');
  assert.equal(result.matches.find(row => row.round === 3).state, 'round_locked');
});

test('direct API save cannot bypass the UEFA future-round lock', async () => {
  const ns = predictionNamespace({ reconciled:[] });
  const round2 = uefaMatch('r2a', 2, 'scheduled');
  const canonical = [uefaMatch('r1a', 1, 'finished'), round2];
  const service = createPredictionService({
    request,
    env:env(ns),
    now:new Date('2026-09-05T00:00:00Z'),
    deps:{
      resolveAuthenticatedUser:async () => authUser(),
      resolveCanonicalPredictionMatch:async () => round2,
      listCanonicalPredictionMatches:async () => ({ matches:canonical, errors:{} }),
    },
  });

  await assert.rejects(
    service.save({ competitionKey:'ucl', predictions:[{ match_id:round2.matchId, home_score:1, away_score:0 }] }),
    error => error?.code === 'prediction_round_locked' && error?.status === 409,
  );
  assert.equal(ns.requests.some(req => new URL(req.url).pathname === '/write'), false);
});

test('Round 11 theme layer removes colored Match glow and themes Predictions Ranking and Tables', async () => {
  const source = await readFile(new URL('../src/v23.3/round11-performance-themes.mjs', import.meta.url), 'utf8');
  assert.match(source, /data-cw233-round11-theme/);
  assert.match(source, /cw233-ranking-page/);
  assert.match(source, /cw233-prediction-page/);
  assert.match(source, /cw233-tables-hub/);
  assert.match(source, /box-shadow:\s*0\s+8px\s+18px\s+rgba\(0,0,0/);
  assert.doesNotMatch(source, /box-shadow:[^;]*var\(--cw232-glow\)/);
});

test('Predictions updates score controls in place instead of full-page render for every +/- click', async () => {
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  const start = source.indexOf("const delta = event.target?.closest?.('[data-cw233-delta]')");
  const end = source.indexOf("if (event.target?.closest?.('[data-cw233-save-all]'))", start);
  const branch = source.slice(start, end);
  assert.match(source, /function updatePredictionCard/);
  assert.match(branch, /updatePredictionCard\(/);
  assert.doesNotMatch(branch, /\brender\(\)/);
});

test('Ranking keeps per-filter cached rows and does not blank the whole page on every filter switch', async () => {
  const source = await readFile(new URL('../src/v23.3/ranking-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /rankingCache/);
  assert.match(source, /renderRankingContent/);
  const start = source.indexOf('async function load');
  const end = source.indexOf('function close', start);
  const load = source.slice(start, end);
  assert.doesNotMatch(load, /loading\(\);\s*try/);
});

test('UEFA prediction navigation exposes locked future rounds with an explicit lock affordance', async () => {
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /data-cw233-pred-locked/);
  assert.match(source, /🔒|&#128274;|lock/i);
  assert.match(source, /Откроется после расчёта предыдущего тура/);
});
