import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function probeModule() {
  try { return await import('../scripts/probe-prediction-contract.mjs'); }
  catch (error) { assert.fail(`prediction contract probe is missing: ${error?.code || error?.message || error}`); }
}

test('v23.3 prediction contract probe is static and non-destructive by default', async () => {
  const { buildStaticPredictionObservation, createPredictionContractReport } = await probeModule();
  const observedContract = { requestLiterals:{ action:['state','save_predictions'], competition_key:[] }, v233SourceHints:[] };
  const staticObservation = buildStaticPredictionObservation(observedContract);
  assert.deepEqual(staticObservation, { actions:['state','save_predictions'], competitionKeys:[] });
  const report = createPredictionContractReport({ observedContract });
  assert.equal(report.pass, false);
  assert.equal(report.status, 'REQUIRES_AUTHENTICATED_SMOKE');
  assert.equal(report.requiresAuthenticatedSmoke, true);
  assert.equal(report.mutatedUserData, false);
  assert.equal(report.authenticatedSmoke.performed, false);
});

test('authenticated prediction evidence passes only when every approved smoke signal is true', async () => {
  const { createPredictionContractReport } = await probeModule();
  const observedContract = { requestLiterals:{ action:['state'], competition_key:['ucl'] } };
  const smoke = {
    performed:true,
    isolatedFixture:true,
    persistenceRoundTrip:true,
    crossCompetitionIsolation:true,
    deadlineBoundaryRejected:true,
    scoringParity:true,
    productionDataUntouched:true,
  };
  const pass = createPredictionContractReport({ observedContract, authenticatedSmoke:smoke });
  assert.equal(pass.status, 'PASS');
  assert.equal(pass.pass, true);

  const blocked = createPredictionContractReport({
    observedContract,
    authenticatedSmoke:{ ...smoke, deadlineBoundaryRejected:false },
  });
  assert.equal(blocked.status, 'BLOCKED');
  assert.equal(blocked.pass, false);
});

test('prediction probe supports optional authenticated smoke artifact input without embedding secrets', async () => {
  const source = await readFile(new URL('../scripts/probe-prediction-contract.mjs', import.meta.url), 'utf8');
  assert.match(source, /PREDICTION_AUTH_SMOKE_INPUT/);
  assert.doesNotMatch(source, /TEST_TELEGRAM_INIT_DATA\s*=\s*['"]/);
  assert.doesNotMatch(source, /TEST_RESET_TOKEN\s*=\s*['"]/);
});

test('v23.3 API observer exposes an explicit static prediction capability summary', async () => {
  const observer = await import('../scripts/inspect-api-contract.mjs');
  assert.equal(typeof observer.predictionContractStaticSummary, 'function');
  assert.deepEqual(observer.predictionContractStaticSummary({ action:['state','save_predictions','serie_a_table'], competition_key:[] }), {
    legacyStateAction:true, legacySaveAction:true, competitionKeyLiterals:[], competitionAwareClientContractObserved:false,
  });
  assert.deepEqual(observer.predictionContractStaticSummary({ action:['state','save_predictions'], competition_key:['ucl'] }), {
    legacyStateAction:true, legacySaveAction:true, competitionKeyLiterals:['ucl'], competitionAwareClientContractObserved:true,
  });
});

test('Ciao TEST workflow records the v23.3 prediction contract without enabling writes', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url), 'utf8');
  assert.match(workflow, /name: Observe v23\.3 prediction contract/);
  assert.match(workflow, /node scripts\/probe-prediction-contract\.mjs/);
  assert.match(workflow, /name: ciao-v23-3-prediction-contract/);
  assert.match(workflow, /cloudflare-test\/artifacts\/v23-3-prediction-contract\.json/);
  assert.doesNotMatch(workflow, /PREDICTION_SMOKE_ALLOW_WRITE:\s*['\"]?1/);
  assert.doesNotMatch(workflow, /TEST_TELEGRAM_INIT_DATA:/);
});
