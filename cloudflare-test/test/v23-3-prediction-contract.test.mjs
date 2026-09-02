import test from 'node:test';
import assert from 'node:assert/strict';

async function contract() {
  try {
    return await import('../src/v23.3/prediction-contract.mjs');
  } catch (error) {
    assert.fail(`prediction contract module is missing: ${error?.code || error?.message || error}`);
  }
}

test('v23.3 prediction contract builds competition-aware canonical write payloads', async () => {
  const { buildPredictionWritePayload } = await contract();

  assert.deepEqual(
    buildPredictionWritePayload({
      competitionKey: 'ucl',
      predictions: [
        { match_id: 'ucl:601024', home_score: 2, away_score: 1 },
      ],
    }),
    {
      competition_key: 'ucl',
      predictions: [
        { match_id: 'ucl:601024', home_score: 2, away_score: 1 },
      ],
    },
  );

  assert.throws(
    () => buildPredictionWritePayload({
      competitionKey: 'ucl',
      predictions: [
        { match_id: 'uel:601024', home_score: 1, away_score: 0 },
      ],
    }),
    /mismatch/i,
  );

  assert.throws(
    () => buildPredictionWritePayload({
      competitionKey: 'other',
      predictions: [
        { match_id: 'other:1', home_score: 1, away_score: 0 },
      ],
    }),
    /competition/i,
  );
});

test('v23.3 prediction contract accepts only bounded integer scores', async () => {
  const { buildPredictionWritePayload } = await contract();
  const make = (home_score, away_score = 0) => buildPredictionWritePayload({
    competitionKey: 'coppa_italia',
    predictions: [{ match_id: 'coppa_italia:10', home_score, away_score }],
  });

  assert.doesNotThrow(() => make(0, 20));
  assert.throws(() => make(-1), /score/i);
  assert.throws(() => make(21), /score/i);
  assert.throws(() => make(1.5), /score/i);
  assert.throws(() => make('2'), /score/i);
});

test('v23.3 prediction contract closes exactly at kickoff minus 15 minutes', async () => {
  const { predictionDeadlineForKickoff, canSubmitPrediction } = await contract();
  const kickoffAt = '2026-09-16T19:00:00Z';

  assert.equal(
    predictionDeadlineForKickoff(kickoffAt),
    '2026-09-16T18:45:00.000Z',
  );
  assert.equal(
    canSubmitPrediction({ kickoffAt, now: '2026-09-16T18:44:59.999Z' }),
    true,
  );
  assert.equal(
    canSubmitPrediction({ kickoffAt, now: '2026-09-16T18:45:00.000Z' }),
    false,
  );
  assert.equal(
    canSubmitPrediction({ kickoffAt, now: '2026-09-16T18:45:00.001Z' }),
    false,
  );
});

test('v23.3 prediction backend gate distinguishes missing test identity from pending authenticated smoke', async () => {
  const { evaluatePredictionGate } = await contract();

  const noIdentity = evaluatePredictionGate({
    staticObservation: {
      actions: ['state', 'save_predictions'],
      competitionKeys: [],
    },
    testIdentityAvailable: false,
  });
  assert.equal(noIdentity.pass, false);
  assert.equal(noIdentity.status, 'BLOCKED_NO_TEST_IDENTITY');
  assert.equal(noIdentity.requiresAuthenticatedSmoke, true);
  assert.match(noIdentity.reasons.join(' '), /identity/i);

  const identityReady = evaluatePredictionGate({
    staticObservation: {
      actions: ['state', 'save_predictions'],
      competitionKeys: [],
    },
    testIdentityAvailable: true,
  });
  assert.equal(identityReady.pass, false);
  assert.equal(identityReady.status, 'REQUIRES_AUTHENTICATED_SMOKE');
  assert.equal(identityReady.requiresAuthenticatedSmoke, true);
});

test('v23.3 prediction backend gate cannot PASS without a complete isolated authenticated smoke', async () => {
  const { evaluatePredictionGate } = await contract();

  const incomplete = evaluatePredictionGate({
    staticObservation: {
      actions: ['state', 'save_predictions'],
      competitionKeys: ['competition_key'],
    },
    testIdentityAvailable: true,
    authenticatedSmoke: {
      performed: true,
      isolatedFixture: true,
      persistenceRoundTrip: true,
      crossCompetitionIsolation: true,
      deadlineBoundaryRejected: true,
      scoringParity: false,
      productionDataUntouched: true,
    },
  });
  assert.equal(incomplete.pass, false);
  assert.equal(incomplete.status, 'BLOCKED');
  assert.match(incomplete.reasons.join(' '), /scoring/i);

  const passed = evaluatePredictionGate({
    staticObservation: {
      actions: ['state', 'save_predictions'],
      competitionKeys: ['competition_key'],
    },
    testIdentityAvailable: true,
    authenticatedSmoke: {
      performed: true,
      isolatedFixture: true,
      persistenceRoundTrip: true,
      crossCompetitionIsolation: true,
      deadlineBoundaryRejected: true,
      scoringParity: true,
      productionDataUntouched: true,
    },
  });
  assert.equal(passed.pass, true);
  assert.equal(passed.status, 'PASS');
});
