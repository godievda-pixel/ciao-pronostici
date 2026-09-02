import { getCompetitionConfig } from '../v23.2/competition-config.mjs';
import { predictionDeadlineForKickoff as canonicalPredictionDeadlineForKickoff } from './competition-data.mjs';

export const MIN_PREDICTION_SCORE = 0;
export const MAX_PREDICTION_SCORE = 20;

function text(value) {
  return String(value ?? '').trim();
}

function competitionKey(value) {
  const key = text(value);
  getCompetitionConfig(key);
  return key;
}

function canonicalMatchId(competition, value) {
  const id = text(value);
  if (!id) throw new Error('Prediction match id is required');
  if (!id.startsWith(`${competition}:`)) {
    throw new Error(`Prediction competition mismatch: ${competition} vs ${id}`);
  }
  return id;
}

function predictionScore(value) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < MIN_PREDICTION_SCORE
    || value > MAX_PREDICTION_SCORE
  ) {
    throw new Error(`Invalid prediction score: expected integer ${MIN_PREDICTION_SCORE}-${MAX_PREDICTION_SCORE}`);
  }
  return value;
}

export function predictionDeadlineForKickoff(kickoffAt) {
  return canonicalPredictionDeadlineForKickoff(kickoffAt);
}

export function canSubmitPrediction({ kickoffAt, now = new Date() } = {}) {
  const deadline = Date.parse(predictionDeadlineForKickoff(kickoffAt));
  const nowValue = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(nowValue)) throw new Error('Invalid prediction server time');
  return nowValue < deadline;
}

export function buildPredictionWritePayload({ competitionKey: rawCompetitionKey, predictions } = {}) {
  const key = competitionKey(rawCompetitionKey);
  if (!Array.isArray(predictions) || predictions.length === 0) {
    throw new Error('Prediction list is required');
  }

  const normalized = predictions.map(item => ({
    match_id: canonicalMatchId(key, item?.match_id),
    home_score: predictionScore(item?.home_score),
    away_score: predictionScore(item?.away_score),
  }));

  return Object.freeze({
    competition_key: key,
    predictions: Object.freeze(normalized.map(item => Object.freeze(item))),
  });
}

const SMOKE_CHECKS = Object.freeze([
  ['isolatedFixture', 'isolated TEST fixture was not verified'],
  ['persistenceRoundTrip', 'prediction persistence round-trip was not verified'],
  ['crossCompetitionIsolation', 'cross-competition identity isolation was not verified'],
  ['deadlineBoundaryRejected', 'server deadline boundary rejection was not verified'],
  ['scoringParity', 'scoring parity with Serie A was not verified'],
  ['productionDataUntouched', 'production-data isolation was not verified'],
]);

function staticSignals(observation = {}) {
  const actions = Array.isArray(observation?.actions) ? observation.actions.map(text) : [];
  const competitionKeys = Array.isArray(observation?.competitionKeys)
    ? observation.competitionKeys.map(text)
    : [];
  return Object.freeze({
    legacyStateAction: actions.includes('state'),
    legacySaveAction: actions.includes('save_predictions'),
    competitionKeyLiteralObserved: competitionKeys.includes('competition_key'),
  });
}

export function evaluatePredictionGate({ staticObservation = {}, authenticatedSmoke = null } = {}) {
  const signals = staticSignals(staticObservation);
  if (!authenticatedSmoke?.performed) {
    return Object.freeze({
      pass: false,
      status: 'REQUIRES_AUTHENTICATED_SMOKE',
      requiresAuthenticatedSmoke: true,
      staticSignals: signals,
      reasons: Object.freeze(['isolated authenticated TEST smoke has not been performed']),
    });
  }

  const reasons = [];
  for (const [field, reason] of SMOKE_CHECKS) {
    if (authenticatedSmoke?.[field] !== true) reasons.push(reason);
  }

  return Object.freeze({
    pass: reasons.length === 0,
    status: reasons.length === 0 ? 'PASS' : 'BLOCKED',
    requiresAuthenticatedSmoke: false,
    staticSignals: signals,
    reasons: Object.freeze(reasons),
  });
}
