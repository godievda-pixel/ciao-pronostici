import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function resetProbe() {
  try { return await import('../scripts/probe-reset-contract.mjs'); }
  catch (error) { assert.fail(`reset contract probe is missing: ${error?.code || error?.message || error}`); }
}

test('v23.3 reset probe reports BLOCKED without mutating data', async () => {
  const { createResetContractReport } = await resetProbe();
  const report = createResetContractReport({
    predictionContractReport:{ status:'REQUIRES_AUTHENTICATED_SMOKE', pass:false, mutatedUserData:false },
    origin:'https://ciao-web-app-test.ciao-web.workers.dev', environment:'test', now:'2026-09-02T11:10:00Z',
  });
  assert.equal(report.pass, false);
  assert.equal(report.status, 'BLOCKED_FOR_PRODUCTION_RESET');
  assert.equal(report.dryRun, true);
  assert.equal(report.mutatedUserData, false);
  assert.equal(report.canExecuteProductionReset, false);
  assert.equal(report.requiresExplicitProductionApproval, true);
  assert.equal(report.guardedBackendResetVerified, false);
  assert.equal(report.predictionGateStatus, 'REQUIRES_AUTHENTICATED_SMOKE');
  assert.match(report.resetKey, /^v23\.3-reset-/);
  assert.deepEqual(report.requiredStages, ['predictions','points','ranking','profiles','caches']);
});

test('verified guarded TEST reset can make cutover ready but never enables Production reset', async () => {
  const { createResetContractReport } = await resetProbe();
  const report = createResetContractReport({
    predictionContractReport:{ status:'PASS', pass:true, mutatedUserData:false },
    guardedBackendResetVerified:true,
    origin:'https://ciao-web-app-test.ciao-web.workers.dev', environment:'test', now:'2026-09-02T11:20:00Z',
  });
  assert.equal(report.pass, true);
  assert.equal(report.status, 'READY_FOR_GUARDED_CUTOVER');
  assert.equal(report.guardedBackendResetVerified, true);
  assert.equal(report.canExecuteProductionReset, false);
  assert.equal(report.requiresExplicitProductionApproval, true);
  assert.equal(report.mutatedUserData, false);
});

test('v23.3 reset probe source has no destructive network path', async () => {
  const source = await readFile(new URL('../scripts/probe-reset-contract.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /\/api\/.*reset/i);
  assert.doesNotMatch(source, /DELETE\b/i);
  assert.doesNotMatch(source, /RESET_ALLOW_EXECUTE/);
});

test('Ciao TEST workflow records reset dry-run artifact without execution flag', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url), 'utf8');
  assert.match(workflow, /name: Observe v23\.3 reset contract/);
  assert.match(workflow, /node scripts\/probe-reset-contract\.mjs/);
  assert.match(workflow, /name: ciao-v23-3-reset-contract/);
  assert.match(workflow, /cloudflare-test\/artifacts\/v23-3-reset-contract\.json/);
  assert.doesNotMatch(workflow, /RESET_ALLOW_EXECUTE:\s*['\"]?1/);
  assert.doesNotMatch(workflow, /TEST_RESET_TOKEN:/);
});
