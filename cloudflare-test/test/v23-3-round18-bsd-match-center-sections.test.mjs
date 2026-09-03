import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptBsdMatchCenterSections,
  extractBsdCoverage,
} from '../src/v23.3/bsd-match-center-adapter.mjs';
import {
  fetchBsdMatchCenterBase,
  fetchBsdMatchCenterSection,
} from '../src/v23.2/bsd-provider.mjs';

const detailedEvent = {
  id:77,
  venue:{ name:'San Siro', city:'Milano', capacity:75817 },
  referee:{ name:'Daniele Orsato' },
  form:{ home:['W','D','W'], away:['L','W'] },
  statistics:{
    home:{
      expected_goals:1.42,
      ball_possession:58,
      total_shots:13,
      shots_on_target:6,
      big_chances:4,
      corner_kicks:5,
      fouls:8,
      offsides:2,
      yellow_cards:1,
      red_cards:0,
      goalkeeper_saves:2,
      pass_accuracy_pct:89,
      interceptions:6,
      total_tackles:12,
    },
    away:{
      expected_goals:0.81,
      ball_possession:42,
      total_shots:9,
      shots_on_target:3,
      big_chances:2,
      corner_kicks:3,
      fouls:11,
      offsides:1,
      yellow_cards:2,
      red_cards:0,
      goalkeeper_saves:5,
      pass_accuracy_pct:83,
      interceptions:8,
      total_tackles:16,
    },
  },
  incidents:[
    { type:'goal', minute:23, added_time:1, is_home:true, player:'Lautaro', assist:'Barella', home_score:1, away_score:0 },
  ],
  lineups:{
    home:{ formation:'3-5-2', players:[{ id:9, short_name:'Thuram', position:'F' }], substitutes:[{ id:8, short_name:'Frattesi', position:'M' }] },
    away:{ formation:'4-3-3', players:[], substitutes:[] },
  },
  player_stats:[
    { player_id:9, short_name:'Lautaro', rating:7.8, goals:1, goal_assist:1, expected_goals:0.71, expected_assists:0.22, total_shots:4, key_pass:2, minutes_played:90 },
  ],
  momentum:[{ minute:10, home:54, away:46 }],
  shotmap:[{ x:0.72, y:0.41, xg:0.31, is_home:true }],
  prediction_split:{ home:61, draw:24, away:15 },
};

test('Round 18 BSD coverage follows provider section presence', () => {
  assert.deepEqual(extractBsdCoverage(detailedEvent), {
    overview:true,
    stats:true,
    events:true,
    lineups:true,
    players:true,
    momentum:true,
    shotmap:true,
  });
});

test('Round 18 BSD adapter maps rich details into canonical sections', () => {
  const result = adaptBsdMatchCenterSections(detailedEvent);
  assert.equal(result.overview.venue.name, 'San Siro');
  assert.equal(result.overview.venue.city, 'Milano');
  assert.equal(result.overview.referee.name, 'Daniele Orsato');
  assert.equal(result.overview.predictionSplit.home, 61);
  assert.equal(result.stats.home.xg, 1.42);
  assert.equal(result.stats.home.possession, 58);
  assert.equal(result.stats.away.shotsOnTarget, 3);
  assert.equal(result.events[0].side, 'home');
  assert.equal(result.events[0].player, 'Lautaro');
  assert.equal(result.lineups.home.formation, '3-5-2');
  assert.equal(result.lineups.home.starters[0].name, 'Thuram');
  assert.equal(result.players[0].rating, 7.8);
  assert.equal(result.players[0].assists, 1);
  assert.deepEqual(result.overview.momentum, detailedEvent.momentum);
  assert.deepEqual(result.overview.shotmap, detailedEvent.shotmap);
});

test('Round 18 BSD adapter does not fabricate missing sections', () => {
  const result = adaptBsdMatchCenterSections({ venue:{ name:'Olimpico' } });
  assert.deepEqual(result.coverage, {
    overview:true,
    stats:false,
    events:false,
    lineups:false,
    players:false,
    momentum:false,
    shotmap:false,
  });
  assert.equal(result.overview.venue.name, 'Olimpico');
  assert.equal(result.stats, null);
  assert.equal(result.events, null);
  assert.equal(result.lineups, null);
  assert.equal(result.players, null);
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers:{ 'content-type':'application/json' },
  });
}

function providerEvent(overrides = {}) {
  return {
    ...detailedEvent,
    league:{ id:10, name:'UEFA Champions League' },
    season:{ id:20, name:'2026/27' },
    event_date:'2026-09-10T19:00:00Z',
    status:'live',
    minute:37,
    round_name:'League Stage',
    round_number:1,
    home_score:1,
    away_score:0,
    home_team:{ id:501, name:'Inter', country_code:'ITA' },
    away_team:{ id:502, name:'Arsenal', country_code:'ENG' },
    ...overrides,
  };
}

function bsdFetchFor(event) {
  return async url => {
    const href = String(url);
    if (href.includes('/leagues/?')) return jsonResponse({ results:[{ id:10, name:'UEFA Champions League' }] });
    if (href.includes('/leagues/10/season/')) return jsonResponse({ id:20, name:'2026/27' });
    if (href.includes('/events/77/')) return jsonResponse(event);
    return jsonResponse({ results:[] });
  };
}

test('Round 18 BSD provider returns a canonical base with explicit coverage', async () => {
  const base = await fetchBsdMatchCenterBase({
    competition:'ucl',
    matchId:'ucl:77',
    apiKey:'test',
    fetchImpl:bsdFetchFor(providerEvent()),
  });
  assert.equal(base.competition, 'ucl');
  assert.equal(base.matchId, 'ucl:77');
  assert.equal(base.homeTeam.name, 'Интер');
  assert.equal(base.status, 'live');
  assert.equal(base.coverage.stats, true);
  assert.equal(base.coverage.players, true);
});

test('Round 18 BSD provider returns one requested canonical section', async () => {
  const stats = await fetchBsdMatchCenterSection({
    competition:'ucl',
    matchId:'ucl:77',
    section:'stats',
    apiKey:'test',
    fetchImpl:bsdFetchFor(providerEvent()),
  });
  assert.equal(stats.section, 'stats');
  assert.equal(stats.available, true);
  assert.equal(stats.data.home.xg, 1.42);
  assert.equal(stats.data.away.shotsOnTarget, 3);
});

test('Round 18 BSD provider keeps Italian eligibility on section fetches', async () => {
  await assert.rejects(
    () => fetchBsdMatchCenterSection({
      competition:'ucl',
      matchId:'ucl:77',
      section:'overview',
      apiKey:'test',
      fetchImpl:bsdFetchFor(providerEvent({
        home_team:{ id:501, name:'Barcelona', country_code:'ESP' },
        away_team:{ id:502, name:'Arsenal', country_code:'ENG' },
      })),
    }),
    error => error?.code === 'match_not_eligible',
  );
});
