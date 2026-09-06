import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scorePrediction,
  predictionDeadlineIso,
  rankingCompetitions,
  normalizeCanonicalMatchId,
  isExternalPredictionCompetition,
} from '../../supabase/functions/ciao-core-api-fast-v6/modular-domain.mjs';

test('external prediction scorer keeps current 5/3/2/0 semantics',()=>{
  assert.deepEqual(scorePrediction({predictedHome:2,predictedAway:1,finalHome:2,finalAway:1}),{points:5,resultType:'exact'});
  assert.deepEqual(scorePrediction({predictedHome:2,predictedAway:0,finalHome:3,finalAway:1}),{points:3,resultType:'goal_difference'});
  assert.deepEqual(scorePrediction({predictedHome:1,predictedAway:0,finalHome:4,finalAway:1}),{points:2,resultType:'outcome'});
  assert.deepEqual(scorePrediction({predictedHome:0,predictedAway:1,finalHome:2,finalAway:1}),{points:0,resultType:'miss'});
});

test('prediction deadline remains exactly 15 minutes before kickoff',()=>{
  assert.equal(predictionDeadlineIso('2026-09-20T19:00:00Z'),'2026-09-20T18:45:00.000Z');
});

test('ranking scopes map exactly to approved competition groups',()=>{
  assert.deepEqual(rankingCompetitions('all'),['serie_a','coppa_italia','ucl','uel','uecl']);
  assert.deepEqual(rankingCompetitions('italy'),['serie_a','coppa_italia']);
  assert.deepEqual(rankingCompetitions('europe'),['ucl','uel','uecl']);
});

test('external identity is canonical and cannot collide across competitions',()=>{
  assert.equal(normalizeCanonicalMatchId('ucl','601024'),'ucl:601024');
  assert.equal(normalizeCanonicalMatchId('uel','uel:601024'),'uel:601024');
  assert.throws(()=>normalizeCanonicalMatchId('ucl','uel:601024'),/competition_mismatch/);
  assert.equal(isExternalPredictionCompetition('serie_a'),false);
  assert.equal(isExternalPredictionCompetition('coppa_italia'),true);
});
