import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalCoverage,
  canonicalMatchCenterBase,
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
