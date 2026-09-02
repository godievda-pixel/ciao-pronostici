import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePredictionSeason,
  assertPredictionWritable,
  resolveCanonicalPredictionMatch,
  listCanonicalPredictionMatches,
} from '../src/v23.3/prediction-match-resolver.mjs';

test('season normalization produces canonical storage keys', () => {
  assert.equal(normalizePredictionSeason('2026/27'), '2026-27');
  assert.equal(normalizePredictionSeason('Champions League 2026/27'), '2026-27');
  assert.equal(normalizePredictionSeason('2026-27'), '2026-27');
  assert.equal(normalizePredictionSeason('2025/26'), '2025-26');
  assert.throws(() => normalizePredictionSeason('season unknown'), error => error.code === 'season_mismatch');
});

test('write guard closes exactly at canonical kickoff minus 15 minutes', () => {
  const match = {
    matchId: 'ucl:601024', competition: 'ucl', season: '2026/27',
    kickoffAt: '2026-09-16T19:00:00Z', status: 'scheduled',
  };
  assert.equal(assertPredictionWritable({
    match, activeSeason: '2026-27', now: '2026-09-16T18:44:59.999Z',
  }), '2026-09-16T18:45:00.000Z');
  assert.throws(() => assertPredictionWritable({
    match, activeSeason: '2026-27', now: '2026-09-16T18:45:00.000Z',
  }), error => error.code === 'prediction_locked' && error.status === 409);
});

test('write guard rejects wrong season plus live and finished matches', () => {
  const base = { matchId:'ucl:1', competition:'ucl', season:'2026/27', kickoffAt:'2099-01-01T00:00:00Z', status:'scheduled' };
  assert.throws(() => assertPredictionWritable({ match:{...base,season:'2025/26'}, activeSeason:'2026-27', now:'2026-09-02T00:00:00Z' }), error => error.code === 'season_mismatch');
  for (const status of ['live','finished']) {
    assert.throws(() => assertPredictionWritable({ match:{...base,status}, activeSeason:'2026-27', now:'2026-09-02T00:00:00Z' }), error => error.code === 'prediction_locked');
  }
});

test('resolver rejects competition/match mismatch before provider I/O', async () => {
  let calls = 0;
  await assert.rejects(
    resolveCanonicalPredictionMatch({
      request:new Request('https://test/api', {headers:{'x-telegram-init-data':'tg'}}),
      env:{PREDICTION_SEASON:'2026-27',BSD_API_KEY:'secret',CIAO_WEB_API:{fetch:async()=>{calls+=1;}}},
      competition:'ucl', matchId:'uel:1',
      deps:{ fetchBsdMatchSnapshot: async()=>{calls+=1;} },
    }),
    error => error.code === 'competition_match_mismatch' && error.status === 400,
  );
  assert.equal(calls, 0);
});

test('Serie A resolver forwards Telegram init data only to ciao-web-api and finds exact match', async () => {
  let upstreamRequest;
  const request = new Request('https://ciao-web-app-test.example/api/v23.3/predictions', {headers:{'x-telegram-init-data':'tg-signed'}});
  const match = await resolveCanonicalPredictionMatch({
    request,
    env:{PREDICTION_SEASON:'2026-27',CIAO_WEB_API:{fetch:async req=>{
      upstreamRequest=req;
      return Response.json({ok:true,matches:[{matchId:'serie_a:10',competition:'serie_a',season:'2026/27',kickoffAt:'2026-09-10T19:00:00Z',status:'scheduled'}]});
    }}},
    competition:'serie_a',matchId:'serie_a:10',
    deps:{ adaptSerieASchedule: payload => ({matches:payload.matches}) },
  });
  assert.equal(new URL(upstreamRequest.url).pathname, '/api/ciao-schedule-fast-v1');
  assert.equal(upstreamRequest.headers.get('x-telegram-init-data'),'tg-signed');
  assert.deepEqual(JSON.parse(await upstreamRequest.text()), {});
  assert.equal(match.matchId,'serie_a:10');
});

test('external resolver uses only server BSD API key and rejects season mismatch', async () => {
  let received;
  const request = new Request('https://test/api',{headers:{'x-telegram-init-data':'do-not-forward'}});
  const match = await resolveCanonicalPredictionMatch({
    request,
    env:{PREDICTION_SEASON:'2026-27',BSD_API_KEY:'bsd-secret'},
    competition:'ucl',matchId:'ucl:601024',
    deps:{fetchBsdMatchSnapshot:async args=>{
      received=args;
      return {matchId:'ucl:601024',competition:'ucl',season:'2026/27',kickoffAt:'2026-09-16T19:00:00Z',status:'scheduled'};
    }},
  });
  assert.equal(received.apiKey,'bsd-secret');
  assert.equal('initData' in received,false);
  assert.equal(match.matchId,'ucl:601024');

  await assert.rejects(
    resolveCanonicalPredictionMatch({
      request,env:{PREDICTION_SEASON:'2026-27',BSD_API_KEY:'bsd-secret'},competition:'ucl',matchId:'ucl:2',
      deps:{fetchBsdMatchSnapshot:async()=>({matchId:'ucl:2',competition:'ucl',season:'2025/26',kickoffAt:'2026-09-16T19:00:00Z',status:'scheduled'})},
    }),
    error => error.code === 'season_mismatch' && error.status === 409,
  );
});

test('list all competitions keeps successful active-season matches and structured errors', async () => {
  const result = await listCanonicalPredictionMatches({
    request:new Request('https://test/api',{headers:{'x-telegram-init-data':'tg'}}),
    env:{PREDICTION_SEASON:'2026-27',BSD_API_KEY:'secret',CIAO_WEB_API:{fetch:async()=>Response.json({ok:true,matches:[{matchId:'serie_a:1',competition:'serie_a',season:'2026/27',kickoffAt:'2026-09-01T00:00:00Z',status:'scheduled'}]})}},
    competition:'all',
    deps:{
      adaptSerieASchedule:p=>({matches:p.matches}),
      fetchBsdMatches:async({competition})=>{
        if(competition==='uel') throw new Error('upstream down');
        return [{matchId:`${competition}:1`,competition,season:competition==='uecl'?'2025/26':'2026/27',kickoffAt:'2026-09-01T00:00:00Z',status:'scheduled'}];
      },
    },
  });
  assert.equal(result.matches.some(m=>m.competition==='serie_a'),true);
  assert.equal(result.matches.some(m=>m.competition==='ucl'),true);
  assert.equal(result.matches.some(m=>m.competition==='uecl'),false);
  assert.equal(result.errors.uel,'match_resolution_failed');
});
