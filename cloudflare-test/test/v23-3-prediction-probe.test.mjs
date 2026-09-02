import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function probeModule() {
  try {
    return await import('../scripts/probe-prediction-contract.mjs');
  } catch (error) {
    assert.fail(`prediction contract probe is missing: ${error?.code || error?.message || error}`);
  }
}

test('v23.3 prediction contract probe is static and non-destructive by default', async () => {
  const {
    buildStaticPredictionObservation,
    createPredictionContractReport,
  } = await probeModule();

  const observedContract = {
    requestLiterals: {
      action: ['state', 'save_predictions'],
      competition_key: [],
    },
    v233SourceHints: [],
  };

  const staticObservation = buildStaticPredictionObservation(observedContract);
  assert.deepEqual(staticObservation, {
    actions: ['state', 'save_predictions'],
    competitionKeys: [],
  });

  const report = createPredictionContractReport({ observedContract });
  assert.equal(report.pass, false);
  assert.equal(report.status, 'REQUIRES_AUTHENTICATED_SMOKE');
  assert.equal(report.requiresAuthenticatedSmoke, true);
  assert.equal(report.mutatedUserData, false);
  assert.equal(report.authenticatedSmoke.performed, false);
});

test('Ciao TEST workflow records the v23.3 prediction contract without enabling writes', async () => {
  const workflow = await readFile(
    new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url),
    'utf8',
  );

  assert.match(workflow, /name: Observe v23\.3 prediction contract/);
  assert.match(workflow, /node scripts\/probe-prediction-contract\.mjs/);
  assert.match(workflow, /name: ciao-v23-3-prediction-contract/);
  assert.match(
    workflow,
    /cloudflare-test\/artifacts\/v23-3-prediction-contract\.json/,
  );
  assert.doesNotMatch(workflow, /PREDICTION_SMOKE_ALLOW_WRITE:\s*['\"]?1/);
});
