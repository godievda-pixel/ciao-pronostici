import test from 'node:test';
import assert from 'node:assert/strict';

async function resetContract() {
  try {
    return await import('../src/v23.3/reset-contract.mjs');
  } catch (error) {
    assert.fail(`reset contract module is missing: ${error?.code || error?.message || error}`);
  }
}

test('v23.3 reset contract rejects Production targets and defaults to dry-run', async () => {
  const {
    assertSafeResetTarget,
    createResetPlan,
  } = await resetContract();

  assert.throws(
    () => assertSafeResetTarget({
      origin: 'https://ciao-web-app.ciao-web.workers.dev',
      environment: 'production',
    }),
    /production/i,
  );
  assert.throws(
    () => assertSafeResetTarget({
      origin: 'https://ciao-web-app.ciao-web.workers.dev',
      environment: 'test',
    }),
    /production/i,
  );

  const plan = createResetPlan({
    origin: 'https://ciao-web-app-test.ciao-web.workers.dev',
    environment: 'test',
  });
  assert.equal(plan.dryRun, true);
  assert.equal(plan.executable, false);
  assert.equal(plan.mutatedUserData, false);
  assert.match(plan.resetKey, /^v23\.3-reset-/);
  assert.deepEqual(plan.requiredStages, ['predictions', 'points', 'ranking', 'profiles', 'caches']);
});

test('v23.3 reset result is overall false when any required stage fails', async () => {
  const { createResetResult } = await resetContract();

  const result = createResetResult({
    dryRun: true,
    resetKey: 'v23.3-reset-test-key',
    stages: {
      predictions: { ok: true, affected: 12 },
      points: { ok: true, affected: 12 },
      ranking: { ok: false, affected: 0 },
      profiles: { ok: true, affected: 8 },
      caches: { ok: true, affected: 3 },
    },
  });

  assert.deepEqual(result, {
    ok: false,
    dryRun: true,
    stages: {
      predictions: { ok: true, affected: 12 },
      points: { ok: true, affected: 12 },
      ranking: { ok: false, affected: 0 },
      profiles: { ok: true, affected: 8 },
      caches: { ok: true, affected: 3 },
    },
    resetKey: 'v23.3-reset-test-key',
  });
});

test('v23.3 reset capability remains blocked until guarded backend reset is verified', async () => {
  const { evaluateResetCapability } = await resetContract();

  const blocked = evaluateResetCapability({
    predictionGateStatus: 'REQUIRES_AUTHENTICATED_SMOKE',
    guardedBackendResetVerified: false,
  });
  assert.equal(blocked.pass, false);
  assert.equal(blocked.status, 'BLOCKED_FOR_PRODUCTION_RESET');
  assert.equal(blocked.canExecuteProductionReset, false);
  assert.equal(blocked.mutatedUserData, false);
  assert.match(blocked.reasons.join(' '), /prediction|backend/i);

  const ready = evaluateResetCapability({
    predictionGateStatus: 'PASS',
    guardedBackendResetVerified: true,
  });
  assert.equal(ready.pass, true);
  assert.equal(ready.status, 'READY_FOR_GUARDED_CUTOVER');
  assert.equal(ready.canExecuteProductionReset, false);
  assert.equal(ready.mutatedUserData, false);
});

test('v23.3 reset result requires every Variant B stage and a reset key', async () => {
  const { createResetResult } = await resetContract();

  assert.throws(
    () => createResetResult({
      dryRun: true,
      resetKey: '',
      stages: {
        predictions: { ok: true, affected: 0 },
        points: { ok: true, affected: 0 },
        ranking: { ok: true, affected: 0 },
        profiles: { ok: true, affected: 0 },
        caches: { ok: true, affected: 0 },
      },
    }),
    /reset key/i,
  );

  assert.throws(
    () => createResetResult({
      dryRun: true,
      resetKey: 'v23.3-reset-test-key',
      stages: {
        predictions: { ok: true, affected: 0 },
        points: { ok: true, affected: 0 },
        ranking: { ok: true, affected: 0 },
        profiles: { ok: true, affected: 0 },
      },
    }),
    /caches/i,
  );
});
