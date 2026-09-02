import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluatePredictionGate } from '../src/v23.3/prediction-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultInputPath = resolve(root, 'artifacts/api-contract-observed.json');
const defaultOutputPath = resolve(root, 'artifacts/v23-3-prediction-contract.json');

function strings(values) {
  return Array.isArray(values)
    ? values.map(value => String(value ?? '').trim()).filter(Boolean)
    : [];
}

export function buildStaticPredictionObservation(observedContract = {}) {
  const literals = observedContract?.requestLiterals || {};
  return Object.freeze({
    actions: Object.freeze(strings(literals.action)),
    competitionKeys: Object.freeze(strings(literals.competition_key)),
  });
}

function emptyAuthenticatedSmoke() {
  return Object.freeze({
    performed: false,
    isolatedFixture: false,
    persistenceRoundTrip: false,
    crossCompetitionIsolation: false,
    deadlineBoundaryRejected: false,
    scoringParity: false,
    productionDataUntouched: true,
  });
}

export function createPredictionContractReport({
  observedContract = {},
  authenticatedSmoke = null,
  observedAt = new Date().toISOString(),
} = {}) {
  const staticObservation = buildStaticPredictionObservation(observedContract);
  const smoke = authenticatedSmoke?.performed
    ? Object.freeze({ ...authenticatedSmoke })
    : emptyAuthenticatedSmoke();
  const gate = evaluatePredictionGate({
    staticObservation,
    authenticatedSmoke: smoke.performed ? smoke : null,
  });

  return Object.freeze({
    observedAt,
    pass: gate.pass,
    status: gate.status,
    requiresAuthenticatedSmoke: gate.requiresAuthenticatedSmoke,
    mutatedUserData: false,
    staticObservation,
    staticSignals: gate.staticSignals,
    authenticatedSmoke: smoke,
    reasons: gate.reasons,
  });
}

export async function main({
  inputPath = process.env.PREDICTION_CONTRACT_INPUT || defaultInputPath,
  outputPath = process.env.PREDICTION_CONTRACT_OUTPUT || defaultOutputPath,
} = {}) {
  const raw = await readFile(inputPath, 'utf8');
  const observedContract = JSON.parse(raw);
  const report = createPredictionContractReport({ observedContract });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    pass: report.pass,
    status: report.status,
    requiresAuthenticatedSmoke: report.requiresAuthenticatedSmoke,
    mutatedUserData: report.mutatedUserData,
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
