import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scorePrediction,
  predictionDeadlineIso,
  predictionIsOpen,
} from '../../supabase/functions/ciao-v23-api/domain/scoring.mjs';

test('v23 scoring preserves exact 5/3/2/0 semantics', () => {
  assert.deepEqual(
    scorePrediction({predictedHome:2,predictedAway:1,finalHome:2,finalAway:1}),
    {points:5,resultType:'exact'},
  );
  assert.deepEqual(
    scorePrediction({predictedHome:3,predictedAway:1,finalHome:2,finalAway:0}),
    {points:3,resultType:'goal_difference'},
  );
  assert.deepEqual(
    scorePrediction({predictedHome:1,predictedAway:0,finalHome:3,finalAway:1}),
    {points:2,resultType:'outcome'},
  );
  assert.deepEqual(
    scorePrediction({predictedHome:0,predictedAway:1,finalHome:2,finalAway:0}),
    {points:0,resultType:'miss'},
  );
});

test('prediction deadline is exactly 15 minutes before absolute UTC kickoff', () => {
  assert.equal(
    predictionDeadlineIso('2026-09-12T18:45:00Z'),
    '2026-09-12T18:30:00.000Z',
  );
  assert.equal(
    predictionIsOpen('2026-09-12T18:45:00Z', Date.parse('2026-09-12T18:29:59Z')),
    true,
  );
  assert.equal(
    predictionIsOpen('2026-09-12T18:45:00Z', Date.parse('2026-09-12T18:30:00Z')),
    false,
  );
});

test('score inputs must be integer values from 0 through 20', () => {
  assert.throws(
    () => scorePrediction({predictedHome:-1,predictedAway:0,finalHome:0,finalAway:0}),
    /invalid_score/,
  );
  assert.throws(
    () => scorePrediction({predictedHome:21,predictedAway:0,finalHome:0,finalAway:0}),
    /invalid_score/,
  );
  assert.throws(
    () => scorePrediction({predictedHome:1.5,predictedAway:0,finalHome:0,finalAway:0}),
    /invalid_score/,
  );
});
