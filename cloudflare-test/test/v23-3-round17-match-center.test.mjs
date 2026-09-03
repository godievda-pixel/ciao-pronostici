import test from 'node:test';
import assert from 'node:assert/strict';

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
