import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import { canonicalOverviewSection } from '../src/v23.3/match-center-sections.mjs';

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function predictionNamespace(rows = []) {
  return {
    idFromName(name) { return `id:${name}`; },
    get() {
      return {
        fetch: async request => {
          const url = new URL(request.url);
          if (url.pathname === '/user') return json({ ok:true, predictions:rows });
          return json({ ok:true });
        },
      };
    },
  };
}

function serieAFixture() {
  return {
    match:{
      id:77,
      kickoff_at:'2026-09-20T18:00:00Z',
      status:'scheduled',
      home:{ id:1, name:'Фиорентина', logo_url:'https://img/fiorentina.png' },
      away:{ id:2, name:'Торино', logo_url:'https://img/torino.png' },
    },
    overview_meta:{
      venue:{ name:'Stadio Artemio Franchi', city:'Florence', capacity:43147 },
      referee:{ name:'Davide Massa' },
      form:{
        home:[[{ result:'W' }], { outcome:'D' }, { code:'L' }, { status:'WIN' }, 'D'],
        away:[{ result:'L' }, [{ result:'W' }], { status:'DRAW' }, { outcome:'LOSS' }, 'W'],
      },
    },
    prediction:{ home_score:0, away_score:0 },
    prediction_split:{ home:42, draw:43, away:15, total:67 },
    capabilities:{ overview:true, stats:false, events:false, lineups:false, players:false },
  };
}

function serieAEnv(savedPredictions = []) {
  const fixture = serieAFixture();
  return {
    CIAO_ENV:'test',
    PREDICTION_SEASON:'2026-27',
    PREDICTION_LEAGUE:predictionNamespace(savedPredictions),
    CIAO_WEB_API:{
      fetch:async request => {
        const url = new URL(request.url);
        const body = await request.clone().json().catch(() => ({}));
        if (body.action === 'state') {
          return json({ ok:true, user:{ id:42, first_name:'Daniil', username:'danyx95' } });
        }
        if (url.pathname === '/api/ciao-match-summary-fast-v2') return json({ ok:true, ...fixture });
        if (url.pathname === '/api/ciao-match-center-fast-v3') return json({ ok:true, ...fixture });
        return json({ ok:false, error:'unexpected_route' }, 404);
      },
    },
  };
}

function overviewRequest() {
  return new Request('https://test.local/api/v23.3/match-center?competition=serie_a&match_id=serie_a%3A77&section=overview', {
    headers:{ 'x-telegram-init-data':'signed-user' },
  });
}

test('Round 45 canonical overview preserves structured five-match form as W/D/L tokens', () => {
  const overview = canonicalOverviewSection({
    form:{
      home:[[{ result:'W' }], { outcome:'D' }, { code:'L' }, { status:'WIN' }, 'D'],
      away:[{ result:'L' }, [{ result:'W' }], { status:'DRAW' }, { outcome:'LOSS' }, 'W'],
    },
  });

  assert.deepEqual(overview.form.home, ['W','D','L','W','D']);
  assert.deepEqual(overview.form.away, ['L','W','D','L','W']);
});

test('Round 45 Match Center does not present legacy model 0:0 as the authenticated user prediction', async () => {
  const response = await worker.fetch(overviewRequest(), serieAEnv([]), {});
  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(payload.data.section, 'overview');
  assert.equal(payload.data.data.prediction, null);
  assert.deepEqual(payload.data.data.predictionSplit, { home:42, draw:43, away:15, total:67 });
});

test('Round 45 Match Center uses the authenticated saved prediction instead of a legacy model score', async () => {
  const saved = [{
    prediction_id:'p77',
    user_id:'telegram:42',
    match_id:'serie_a:77',
    predicted_home:2,
    predicted_away:1,
  }];
  const response = await worker.fetch(overviewRequest(), serieAEnv(saved), {});
  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.deepEqual(payload.data.data.prediction, {
    homeScore:2,
    awayScore:1,
    kind:'user',
  });
  assert.equal(payload.data.data.predictionSplit.total, 67);
});
