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

test('v23.3 prediction contract probe is non-destructive and reports missing test identity explicitly', async () => {
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

  const report = createPredictionContractReport({
    observedContract,
    authenticationCapability: {
      performed: false,
      authenticated: false,
      status: 'BLOCKED_NO_TEST_IDENTITY',
      readOnly: true,
      mutatedUserData: false,
    },
  });
  assert.equal(report.pass, false);
  assert.equal(report.status, 'BLOCKED_NO_TEST_IDENTITY');
  assert.equal(report.requiresAuthenticatedSmoke, true);
  assert.equal(report.mutatedUserData, false);
  assert.equal(report.authenticatedSmoke.performed, false);
  assert.equal(report.authenticationCapability.readOnly, true);
  assert.equal(report.authenticationCapability.mutatedUserData, false);
});

test('v23.3 API observer exposes an explicit static prediction capability summary', async () => {
  const observer = await import('../scripts/inspect-api-contract.mjs');
  assert.equal(typeof observer.predictionContractStaticSummary, 'function');

  assert.deepEqual(
    observer.predictionContractStaticSummary({
      action: ['state', 'save_predictions', 'serie_a_table'],
      competition_key: [],
    }),
    {
      legacyStateAction: true,
      legacySaveAction: true,
      competitionKeyLiterals: [],
      competitionAwareClientContractObserved: false,
    },
  );

  assert.deepEqual(
    observer.predictionContractStaticSummary({
      action: ['state', 'save_predictions'],
      competition_key: ['ucl'],
    }),
    {
      legacyStateAction: true,
      legacySaveAction: true,
      competitionKeyLiterals: ['ucl'],
      competitionAwareClientContractObserved: true,
    },
  );
});

test('Ciao TEST workflow exposes optional Telegram test identity only to the read-only prediction contract probe', async () => {
  const workflow = await readFile(
    new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url),
    'utf8',
  );

  assert.match(workflow, /name: Observe v23\.3 prediction contract/);
  assert.match(workflow, /node scripts\/probe-prediction-contract\.mjs/);
  assert.match(workflow, /CIAO_TEST_TELEGRAM_INIT_DATA:\s*\$\{\{ secrets\.CIAO_TEST_TELEGRAM_INIT_DATA \}\}/);
  assert.match(workflow, /name: ciao-v23-3-prediction-contract/);
  assert.match(
    workflow,
    /cloudflare-test\/artifacts\/v23-3-prediction-contract\.json/,
  );
  assert.doesNotMatch(workflow, /PREDICTION_SMOKE_ALLOW_WRITE:\s*['\"]?1/);
});
