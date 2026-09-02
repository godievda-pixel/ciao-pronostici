export const RESET_STAGES = Object.freeze([
  'predictions',
  'points',
  'ranking',
  'caches',
]);

const TEST_HOST = 'ciao-web-app-test.ciao-web.workers.dev';

function text(value) {
  return String(value ?? '').trim();
}

function normalizedOrigin(origin) {
  let url;
  try {
    url = new URL(text(origin));
  } catch {
    throw new Error('Invalid reset target origin');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Reset tooling requires a secure TEST origin');
  }
  return url;
}

export function assertSafeResetTarget({ origin, environment } = {}) {
  const env = text(environment).toLowerCase();
  const url = normalizedOrigin(origin);
  const host = url.hostname.toLowerCase();

  if (env === 'production' || env === 'prod' || host !== TEST_HOST) {
    throw new Error('Production reset target is forbidden during TEST work');
  }
  if (env !== 'test') {
    throw new Error('Reset tooling is TEST dry-run only');
  }

  return Object.freeze({
    origin: url.origin,
    environment: 'test',
  });
}

function resetKey(now = new Date()) {
  const value = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(value.getTime())) throw new Error('Invalid reset plan time');
  return `v23.3-reset-${value.toISOString().replace(/[:.]/g, '-')}`;
}

export function createResetPlan({ origin, environment, now = new Date() } = {}) {
  const target = assertSafeResetTarget({ origin, environment });
  return Object.freeze({
    dryRun: true,
    executable: false,
    mutatedUserData: false,
    resetKey: resetKey(now),
    requiredStages: RESET_STAGES,
    target,
  });
}

function normalizeStage(name, stage) {
  if (!stage || typeof stage.ok !== 'boolean') {
    throw new Error(`Reset stage ${name} requires boolean ok`);
  }
  const affected = Number(stage.affected);
  if (!Number.isInteger(affected) || affected < 0) {
    throw new Error(`Reset stage ${name} requires non-negative integer affected`);
  }
  return Object.freeze({ ok: stage.ok, affected });
}

export function createResetResult({ dryRun = true, resetKey: rawResetKey, stages } = {}) {
  const key = text(rawResetKey);
  if (!key) throw new Error('Reset key is required');
  if (!stages || typeof stages !== 'object') throw new Error('Reset stages are required');

  const normalizedStages = {};
  for (const name of RESET_STAGES) {
    if (!(name in stages)) throw new Error(`Reset stage ${name} is required`);
    normalizedStages[name] = normalizeStage(name, stages[name]);
  }

  const resultStages = Object.freeze(normalizedStages);
  return Object.freeze({
    ok: RESET_STAGES.every(name => resultStages[name].ok === true),
    dryRun: Boolean(dryRun),
    stages: resultStages,
    resetKey: key,
  });
}

export function evaluateResetCapability({
  predictionGateStatus,
  guardedBackendResetVerified = false,
} = {}) {
  const reasons = [];
  if (text(predictionGateStatus) !== 'PASS') {
    reasons.push('prediction backend contract has not passed isolated authenticated TEST smoke');
  }
  if (guardedBackendResetVerified !== true) {
    reasons.push('guarded backend reset capability has not been verified');
  }

  const pass = reasons.length === 0;
  return Object.freeze({
    pass,
    status: pass ? 'READY_FOR_GUARDED_CUTOVER' : 'BLOCKED_FOR_PRODUCTION_RESET',
    canExecuteProductionReset: false,
    mutatedUserData: false,
    requiresExplicitProductionApproval: true,
    reasons: Object.freeze(reasons),
  });
}
