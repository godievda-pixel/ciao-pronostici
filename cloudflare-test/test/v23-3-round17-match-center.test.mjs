import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/worker.js';
import { canonicalMatchCenterSnapshot } from '../src/v23.3/match-center-snapshot.mjs';
import {
  extractBsdMatchDetails,
  fetchBsdMatchCenterSnapshot,
} from '../src/v23.2/bsd-provider.mjs';

test('Round 17 canonical Match Center snapshot keeps core match and normalizes optional detail sections', () => {
  const snapshot = canonicalMatchCenterSnapshot({
    competition:'uel',
    matchId:'uel:42',
    kickoffAt:'2026-09-10T19:00:00Z',
    status:'scheduled',
    homeTeam:{ name:'Рома', crestUrl:'roma.png' },
    awayTeam:{ name:'Арсенал', crestUrl:'arsenal.png' },
    stage:'League Stage',
    round:2,
    predictionDeadline:'2026-09-10T18:45:00Z',
  }, {
    events:[{ type:'goal', minute:31 }],
    statistics:null,
    lineups:undefined,
    venue:'Олимпико',
  });

  assert.equal(snapshot.competition, 'uel');
  assert.equal(snapshot.matchId, 'uel:42');
  assert.equal(snapshot.venue, 'Олимпико');
  assert.deepEqual(snapshot.events, [{ type:'goal', minute:31 }]);
  assert.deepEqual(snapshot.statistics, []);
  assert.deepEqual(snapshot.lineups, []);
  assert.equal(snapshot.predictionDeadline, '2026-09-10T18:45:00Z');
});

test('Round 17 malformed optional Match Center detail values are isolated instead of throwing', () => {
  assert.doesNotThrow(() => canonicalMatchCenterSnapshot({
    competition:'ucl',
    matchId:'ucl:10',
    homeTeam:{ name:'Интер' },
    awayTeam:{ name:'Арсенал' },
  }, {
    events:{ bad:true },
    statistics:'bad',
    lineups:42,
  }));
  const snapshot = canonicalMatchCenterSnapshot({ competition:'ucl', matchId:'ucl:10' }, {
    events:{ bad:true }, statistics:'bad', lineups:42,
  });
  assert.deepEqual(snapshot.events, []);
  assert.deepEqual(snapshot.statistics, []);
  assert.deepEqual(snapshot.lineups, []);
});

test('Round 17 extracts optional BSD Match Center details without making them required', () => {
  assert.deepEqual(extractBsdMatchDetails({
    venue:{ name:'Олимпико' },
    events:[{ type:'goal', minute:31 }],
    statistics:[{ name:'possession', home:52, away:48 }],
    lineups:[{ team_id:1, formation:'3-4-2-1' }],
  }), {
    venue:'Олимпико',
    events:[{ type:'goal', minute:31 }],
    statistics:[{ name:'possession', home:52, away:48 }],
    lineups:[{ team_id:1, formation:'3-4-2-1' }],
  });
  assert.deepEqual(extractBsdMatchDetails({ venue:'Олимпико', events:null }), {
    venue:'Олимпико', events:[], statistics:[], lineups:[],
  });
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers:{ 'content-type':'application/json' },
  });
}

function detailedBsdFetch(url) {
  const href = String(url);
  if (href.includes('/leagues/?')) {
    return Promise.resolve(jsonResponse({ results:[{ id:11, name:'UEFA Europa League' }] }));
  }
  if (href.includes('/leagues/11/season/')) {
    return Promise.resolve(jsonResponse({ id:21, name:'2026/27' }));
  }
  if (href.includes('/events/42/')) {
    return Promise.resolve(jsonResponse({
      id:42,
      league:{ id:11, name:'UEFA Europa League' },
      season:{ id:21, name:'2026/27' },
      event_date:'2026-09-10T19:00:00Z',
      status:'scheduled',
      round_name:'League Stage',
      round_number:2,
      venue:{ name:'Олимпико' },
      home_team:{ id:601, name:'AS Roma', country_code:'ITA' },
      away_team:{ id:602, name:'Arsenal', country_code:'ENG' },
      events:[{ type:'goal', minute:31 }],
      statistics:[{ name:'shots', home:8, away:6 }],
      lineups:[{ team_id:601, formation:'3-4-2-1' }],
    }));
  }
  return Promise.resolve(jsonResponse({ results:[] }));
}

test('Round 17 BSD detailed resolver returns the canonical Match Center snapshot', async () => {
  const snapshot = await fetchBsdMatchCenterSnapshot({
    competition:'uel',
    matchId:'uel:42',
    apiKey:'test',
    fetchImpl:detailedBsdFetch,
  });
  assert.equal(snapshot.competition, 'uel');
  assert.equal(snapshot.matchId, 'uel:42');
  assert.equal(snapshot.homeTeam.name, 'Рома');
  assert.equal(snapshot.venue, 'Олимпико');
  assert.deepEqual(snapshot.events, [{ type:'goal', minute:31 }]);
  assert.deepEqual(snapshot.statistics, [{ name:'shots', home:8, away:6 }]);
  assert.deepEqual(snapshot.lineups, [{ team_id:601, formation:'3-4-2-1' }]);
});

test('Round 17 Worker Match Center resolves Serie A through the same canonical endpoint', async () => {
  let upstreamRequest = null;
  const env = {
    CIAO_WEB_API:{
      fetch:async request => {
        upstreamRequest = request;
        assert.equal(new URL(request.url).pathname, '/api/ciao-match-summary-fast-v2');
        return jsonResponse({
          ok:true,
          match:{
            id:123,
            kickoff_at:'2026-09-06T18:45:00Z',
            status:'scheduled',
            home:{ id:1, name:'Inter', logo_url:'inter.png' },
            away:{ id:2, name:'Milan', logo_url:'milan.png' },
          },
          overview_meta:{ venue:{ name:'San Siro' } },
          stats:{ stats:{ home:{}, away:{} } },
          incidents:{ incidents:[] },
          lineups:{ lineups:{ home:{ starters:[] }, away:{ starters:[] } } },
          player_stats:{ player_stats:[] },
        });
      },
    },
  };
  const response = await worker.fetch(new Request(
    'https://ciao-web-app-test.ciao-web.workers.dev/api/v23.3/match-center?competition=serie_a&match_id=serie_a%3A123',
    { headers:{ 'x-telegram-init-data':'signed-test-user' } },
  ), env, {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.data.match.competition, 'serie_a');
  assert.equal(payload.data.match.matchId, 'serie_a:123');
  assert.equal(payload.data.match.homeTeam.name, 'Inter');
  assert.deepEqual(JSON.parse(await upstreamRequest.text()), { match_id:123 });
});

test('Round 17 Worker maps filtered external Match Center requests to controlled 404', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const href = String(url);
    if (href.includes('/leagues/?')) return jsonResponse({ results:[{ id:10, name:'UEFA Champions League' }] });
    if (href.includes('/leagues/10/season/')) return jsonResponse({ id:20, name:'2026/27' });
    if (href.includes('/events/99/')) return jsonResponse({
      id:99,
      league:{ id:10, name:'UEFA Champions League' },
      season:{ id:20, name:'2026/27' },
      event_date:'2026-09-10T19:00:00Z',
      status:'scheduled',
      round_name:'League Stage',
      round_number:1,
      home_team:{ id:501, name:'Barcelona', country_code:'ESP' },
      away_team:{ id:502, name:'Arsenal', country_code:'ENG' },
    });
    return jsonResponse({ results:[] });
  };
  try {
    const response = await worker.fetch(new Request(
      'https://ciao-web-app-test.ciao-web.workers.dev/api/v23.3/match-center?competition=ucl&match_id=ucl%3A99',
      { headers:{ 'x-telegram-init-data':'signed-test-user' } },
    ), { BSD_API_KEY:'test' }, {});
    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.error, 'match_not_eligible');
    assert.equal(payload.competition, 'ucl');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
