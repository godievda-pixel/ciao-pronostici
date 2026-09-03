import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptBsdMatchCenterSections,
  extractBsdCoverage,
} from '../src/v23.3/bsd-match-center-adapter.mjs';

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
