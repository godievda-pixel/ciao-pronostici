import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalMatchCenterSnapshot } from '../src/v23.3/match-center-snapshot.mjs';

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
