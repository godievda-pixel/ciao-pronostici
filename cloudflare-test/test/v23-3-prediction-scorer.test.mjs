import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePrediction, resultFingerprint } from '../src/v23.3/prediction-scorer.mjs';

// Mirrors public.cp_apply_match_scoring: exact -> same outcome+goal difference -> same outcome -> miss.
function legacyScorePrediction({ predictedHome, predictedAway, finalHome, finalAway }) {
  if (predictedHome === finalHome && predictedAway === finalAway) {
    return { points: 5, resultType: 'exact' };
  }
  const predictedDiff = predictedHome - predictedAway;
  const finalDiff = finalHome - finalAway;
  if (Math.sign(predictedDiff) === Math.sign(finalDiff) && predictedDiff === finalDiff) {
    return { points: 3, resultType: 'goal_difference' };
  }
  if (Math.sign(predictedDiff) === Math.sign(finalDiff)) {
    return { points: 2, resultType: 'outcome' };
  }
  return { points: 0, resultType: 'miss' };
}

test('new scorer is exhaustive-parity with current Serie A scorer for practical scores 0..8', () => {
  for (let ph = 0; ph <= 8; ph += 1) {
    for (let pa = 0; pa <= 8; pa += 1) {
      for (let fh = 0; fh <= 8; fh += 1) {
        for (let fa = 0; fa <= 8; fa += 1) {
          assert.deepEqual(
            scorePrediction({ predictedHome: ph, predictedAway: pa, finalHome: fh, finalAway: fa }),
            legacyScorePrediction({ predictedHome: ph, predictedAway: pa, finalHome: fh, finalAway: fa }),
            `${ph}:${pa} vs ${fh}:${fa}`,
          );
        }
      }
    }
  }
});

test('scorer rejects invalid score inputs', () => {
  for (const input of [-1, 21, 1.5, '2', NaN]) {
    assert.throws(
      () => scorePrediction({ predictedHome: input, predictedAway: 0, finalHome: 1, finalAway: 0 }),
      /score/i,
    );
  }
});

test('result fingerprint is stable and changes on corrected final score/version', () => {
  const base = resultFingerprint({ matchId:'ucl:1', finalHome:2, finalAway:1, rawVersion:'v1' });
  assert.equal(base, resultFingerprint({ matchId:'ucl:1', finalHome:2, finalAway:1, rawVersion:'v1' }));
  assert.notEqual(base, resultFingerprint({ matchId:'ucl:1', finalHome:2, finalAway:2, rawVersion:'v1' }));
  assert.notEqual(base, resultFingerprint({ matchId:'ucl:1', finalHome:2, finalAway:1, rawVersion:'v2' }));
});
