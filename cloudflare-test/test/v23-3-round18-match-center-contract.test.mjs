import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalCoverage,
  canonicalMatchCenterBase,
  canonicalOverviewSection,
  canonicalStatsSection,
  canonicalEventsSection,
  canonicalLineupsSection,
  canonicalPlayersSection,
} from '../src/v23.3/match-center-sections.mjs';

test('Round 18 exposes explicit section coverage', () => {
  assert.deepEqual(canonicalCoverage({ stats:true, events:false }), {
    overview:false,
    stats:true,
    events:false,
    lineups:false,
    players:false,
    momentum:false,
    shotmap:false,
  });
});

test('Round 18 base snapshot carries stable match identity and coverage', () => {
  const base = canonicalMatchCenterBase({
    competition:'ucl',
    matchId:'ucl:77',
    status:'live',
    homeTeam:{ name:'Интер' },
    awayTeam:{ name:'Арсенал' },
  }, { overview:true, stats:true });
  assert.equal(base.matchId, 'ucl:77');
  assert.equal(base.coverage.overview, true);
  assert.equal(base.coverage.players, false);
});

test('Round 18 normalizes overview metadata without inventing optional blocks', () => {
  const overview = canonicalOverviewSection({
    venue:{ name:'San Siro', city:'Milano', capacity:75817 },
    referee:{ name:'Daniele Orsato' },
    form:{ home:['W','D'], away:['L'] },
  });
  assert.deepEqual(overview.venue, { name:'San Siro', city:'Milano', capacity:75817 });
  assert.equal(overview.referee.name, 'Daniele Orsato');
  assert.deepEqual(overview.form.home, ['W','D']);
  assert.equal(overview.momentum, null);
  assert.equal(overview.shotmap, null);
});

test('Round 18 normalizes the canonical statistics surface', () => {
  const stats = canonicalStatsSection({
    home:{ xg:1.4, possession:58, shots:13, shotsOnTarget:6 },
    away:{ xg:0.8, possession:42, shots:9, shotsOnTarget:3 },
  });
  assert.equal(stats.home.xg, 1.4);
  assert.equal(stats.away.xg, 0.8);
  assert.equal(stats.home.possession, 58);
  assert.equal(stats.away.shotsOnTarget, 3);
});

test('Round 18 normalizes event chronology data defensively', () => {
  const events = canonicalEventsSection([
    { type:'goal', minute:23, addedTime:1, side:'home', player:'Lautaro', homeScore:1, awayScore:0 },
    null,
  ]);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    type:'goal', minute:23, addedTime:1, side:'home', player:'Lautaro', assist:'', reason:'',
    playerIn:'', playerOut:'', homeScore:1, awayScore:0, text:'',
  });
});

test('Round 18 keeps formation, starters and substitutes in canonical lineups', () => {
  const lineups = canonicalLineupsSection({
    home:{ formation:'3-5-2', starters:[{ playerId:9, name:'Thuram', position:'F' }], substitutes:[{ playerId:8, name:'Frattesi' }] },
    away:{ formation:'4-3-3', starters:[] },
  });
  assert.equal(lineups.home.formation, '3-5-2');
  assert.equal(lineups.home.starters[0].playerId, 9);
  assert.equal(lineups.home.substitutes[0].name, 'Frattesi');
  assert.equal(lineups.away.formation, '4-3-3');
});

test('Round 18 normalizes player ratings and performance metrics', () => {
  const players = canonicalPlayersSection([
    { playerId:9, name:'Lautaro', rating:7.8, goals:1, assists:1, xg:0.71, xa:0.22, shots:4, keyPasses:2, minutes:90 },
  ]);
  assert.equal(players.length, 1);
  assert.equal(players[0].playerId, 9);
  assert.equal(players[0].rating, 7.8);
  assert.equal(players[0].goals, 1);
  assert.equal(players[0].xg, 0.71);
  assert.equal(players[0].minutes, 90);
});
