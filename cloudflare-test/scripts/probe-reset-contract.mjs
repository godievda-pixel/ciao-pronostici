import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createResetPlan,
  evaluateResetCapability,
} from '../src/v23.3/reset-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultInputPath = resolve(root, 'artifacts/v23-3-prediction-contract.json');
const defaultOutputPath = resolve(root, 'artifacts/v23-3-reset-contract.json');
const DEFAULT_TEST_ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev';

export function createResetContractReport({
  predictionContractReport = {},
  guardedBackendResetVerified = false,
  origin = DEFAULT_TEST_ORIGIN,
  environment = 'test',
  now = new Date(),
} = {}) {
  const plan = createResetPlan({ origin, environment, now });
  const predictionGateStatus = String(predictionContractReport?.status || '').trim() || 'UNKNOWN';
  const capability = evaluateResetCapability({
    predictionGateStatus,
    guardedBackendResetVerified: guardedBackendResetVerified === true,
  });

  return Object.freeze({
    observedAt: (now instanceof Date ? now : new Date(now)).toISOString(),
    pass: capability.pass,
    status: capability.status,
    dryRun: plan.dryRun,
    mutatedUserData: false,
    canExecuteProductionReset: false,
    requiresExplicitProductionApproval: capability.requiresExplicitProductionApproval,
    guardedBackendResetVerified: guardedBackendResetVerified === true,
    predictionGateStatus,
    resetKey: plan.resetKey,
    requiredStages: plan.requiredStages,
    reasons: capability.reasons,
  });
}

export async function main({
  inputPath = process.env.RESET_CONTRACT_INPUT || defaultInputPath,
  outputPath = process.env.RESET_CONTRACT_OUTPUT || defaultOutputPath,
} = {}) {
  const raw = await readFile(inputPath, 'utf8');
  const predictionContractReport = JSON.parse(raw);
  const report = createResetContractReport({ predictionContractReport });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    pass: report.pass,
    status: report.status,
    dryRun: report.dryRun,
    mutatedUserData: report.mutatedUserData,
    canExecuteProductionReset: report.canExecuteProductionReset,
    output: outputPath,
  }));

  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
