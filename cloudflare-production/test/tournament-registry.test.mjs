import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPETITION_IDS, getTournament, tournamentTheme } from '../src/modular/core/tournament-registry.mjs';

test('Tournament Registry defines all five competitions and table participation', () => {
  assert.deepEqual(COMPETITION_IDS,['serie_a','coppa_italia','ucl','uel','uecl']);
  assert.equal(getTournament('serie_a').title,'Серия А');
  assert.equal(getTournament('coppa_italia').tables,false);
  assert.equal(getTournament('ucl').tables,true);
  assert.equal(getTournament('uel').tables,true);
  assert.equal(getTournament('uecl').tables,true);
});

test('Tournament Registry resolves distinct premium theme tokens', () => {
  assert.equal(tournamentTheme('serie_a').key,'serie-a');
  assert.equal(tournamentTheme('coppa_italia').key,'coppa');
  assert.equal(tournamentTheme('ucl').key,'champions');
  assert.equal(tournamentTheme('uel').key,'europa');
  assert.equal(tournamentTheme('uecl').key,'conference');
  assert.throws(()=>getTournament('unknown'),/unknown_competition/);
});
