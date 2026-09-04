import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/worker.js';
import { createMatchCenterStore } from '../src/v23.3/match-center-store.mjs';
import { renderMatchCenterView } from '../src/v23.3/match-center-view.mjs';

function falseCoverage() {
  return {
    overview:false,
    stats:false,
    events:false,
    lineups:false,
    players:false,
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers:{ 'content-type':'application/json' },
  });
}

test('Round 40 summary coverage=false does not block the lazy rich overview request', async () => {
  let sectionCalls = 0;
  const store = createMatchCenterStore({
    repository:{
      base:async () => ({
        match:{
          competition:'serie_a',
          matchId:'serie_a:77',
          status:'scheduled',
          kickoffAt:'2026-09-20T18:00:00Z',
          homeTeam:{ id:'1', name:'Интер', crestUrl:'' },
          awayTeam:{ id:'2', name:'Ювентус', crestUrl:'' },
          score:{ home:null, away:null },
          coverage:falseCoverage(),
        },
      }),
      section:async (_competition, _matchId, section) => {
        sectionCalls += 1;
        return {
          section,
          available:true,
          coverage:{ ...falseCoverage(), [section]:true },
          data:{ venue:'San Siro', referee:'Orsato' },
        };
      },
    },
    documentRef:null,
  });

  await store.open({ competition:'serie_a', matchId:'serie_a:77' });
  const state = store.getState();

  assert.equal(sectionCalls, 1);
  assert.equal(state.sectionState.overview.status, 'ready');
  assert.equal(state.match.coverage.overview, true);
  assert.deepEqual(state.sections.overview, { venue:'San Siro', referee:'Orsato' });
});

test('Round 40 Serie A worker can resolve rich overview after a summary-only base response', async () => {
  const calls = [];
  const env = {
    CIAO_WEB_API:{
      fetch:async req => {
        const url = new URL(req.url);
        const body = req.method === 'POST' ? await req.clone().json() : null;
        calls.push({ path:url.pathname, body });
        if (url.pathname === '/api/ciao-match-summary-fast-v2') {
          return json({
            ok:true,
            match:{
              id:77,
              kickoff_at:'2026-09-20T18:00:00Z',
              status:'scheduled',
              home:{ id:1, name:'Интер' },
              away:{ id:2, name:'Ювентус' },
            },
          });
        }
        if (url.pathname === '/api/ciao-match-center-fast-v3') {
          return json({
            ok:true,
            match:{
              id:77,
              kickoff_at:'2026-09-20T18:00:00Z',
              status:'scheduled',
              home:{ id:1, name:'Интер' },
              away:{ id:2, name:'Ювентус' },
            },
            overview_meta:{
              venue:{ name:'San Siro' },
              referee:{ name:'Orsato' },
            },
          });
        }
        return json({ ok:false, error:'unexpected_route' }, 404);
      },
    },
  };
  const headers = { 'x-telegram-init-data':'signed-user' };

  const baseResponse = await worker.fetch(new Request(
    'https://test.local/api/v23.3/match-center?competition=serie_a&match_id=serie_a%3A77',
    { headers },
  ), env, {});
  const basePayload = await baseResponse.json();
  assert.equal(baseResponse.status, 200);
  assert.equal(basePayload.data.match.coverage.overview, false);

  const sectionResponse = await worker.fetch(new Request(
    'https://test.local/api/v23.3/match-center?competition=serie_a&match_id=serie_a%3A77&section=overview',
    { headers },
  ), env, {});
  const sectionPayload = await sectionResponse.json();
  assert.equal(sectionResponse.status, 200);
  assert.equal(sectionPayload.data.available, true);
  assert.equal(sectionPayload.data.coverage.overview, true);
  assert.equal(sectionPayload.data.data.venue.name, 'San Siro');
  assert.deepEqual(calls.map(call => call.path), [
    '/api/ciao-match-summary-fast-v2',
    '/api/ciao-match-center-fast-v3',
  ]);
});

test('Round 40 Match Center tabs are one premium segmented control themed by competition accent', () => {
  const html = renderMatchCenterView({
    open:true,
    phase:'ready',
    competition:'uel',
    matchId:'uel:77',
    activeTab:'overview',
    match:{
      competition:'uel',
      matchId:'uel:77',
      status:'scheduled',
      kickoffAt:'2026-09-20T18:00:00Z',
      homeTeam:{ name:'Рома', crestUrl:'' },
      awayTeam:{ name:'Бетис', crestUrl:'' },
      score:{ home:null, away:null },
      coverage:{ overview:true, stats:true, events:true, lineups:true, players:true },
    },
    sections:{ overview:{}, stats:null, events:null, lineups:null, players:null },
    sectionState:{
      overview:{ status:'ready', error:'' },
      stats:{ status:'idle', error:'' },
      events:{ status:'idle', error:'' },
      lineups:{ status:'idle', error:'' },
      players:{ status:'idle', error:'' },
    },
  });

  assert.match(html, /\.cw239-mc-tabs\{[^}]*padding:4px[^}]*border:1px solid var\(--mc-border\)[^}]*border-radius:16px[^}]*background:/s);
  assert.match(html, /\.cw239-mc-tab\{[^}]*border:0[^}]*border-radius:12px/s);
  assert.match(html, /\.cw239-mc-tab\.is-active\{[^}]*linear-gradient\([^)]*var\(--mc-accent\)[^)]*var\(--mc-accent-2\)[^)]*\)[^}]*box-shadow:/s);
  assert.match(html, /--mc-accent:#f06722;--mc-accent-2:#ff9b32/);
  assert.equal((html.match(/class="cw239-mc-tabs"/g) || []).length, 1);
  assert.equal((html.match(/class="cw239-mc-tab(?: is-active)?"/g) || []).length, 5);
});
