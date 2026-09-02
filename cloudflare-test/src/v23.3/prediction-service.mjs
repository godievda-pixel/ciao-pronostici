import { buildPredictionWritePayload } from './prediction-contract.mjs';
import { resolveAuthenticatedUser } from './prediction-auth.mjs';
import {
  resolveCanonicalPredictionMatch,
  listCanonicalPredictionMatches,
  assertPredictionWritable,
} from './prediction-match-resolver.mjs';
import { predictionObjectName } from './prediction-sql.mjs';
import { resultFingerprint } from './prediction-scorer.mjs';

export class PredictionServiceError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function text(value) { return String(value ?? '').trim(); }

function mapError(error) {
  if (error instanceof PredictionServiceError) return error;
  if (error && Number.isInteger(Number(error.status)) && text(error.code)) {
    return new PredictionServiceError(text(error.code), Number(error.status));
  }
  const message = text(error?.message || error);
  if (/competition mismatch/i.test(message)) return new PredictionServiceError('competition_match_mismatch', 400);
  if (/unknown competition|competition.*required|prediction list|required|invalid prediction score/i.test(message)) {
    return new PredictionServiceError('invalid_prediction_request', 400);
  }
  return new PredictionServiceError('prediction_backend_unavailable', 503);
}

function activeStub(env) {
  if (!env?.PREDICTION_LEAGUE || typeof env.PREDICTION_LEAGUE.idFromName !== 'function') {
    throw new PredictionServiceError('prediction_backend_unavailable', 503);
  }
  const name = predictionObjectName({ environment: env.CIAO_ENV, season: env.PREDICTION_SEASON });
  const id = env.PREDICTION_LEAGUE.idFromName(name);
  return { name, stub: env.PREDICTION_LEAGUE.get(id) };
}

async function internalJson(stub, path, { method = 'GET', body } = {}) {
  try {
    const response = await stub.fetch(new Request(`https://prediction-league.internal${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }));
    let payload;
    try { payload = await response.json(); } catch { throw new PredictionServiceError('prediction_backend_unavailable', 503); }
    if (!response.ok || !payload?.ok) {
      throw new PredictionServiceError('prediction_backend_unavailable', 503);
    }
    return payload?.data ?? payload;
  } catch (error) {
    if (error instanceof PredictionServiceError) throw error;
    throw new PredictionServiceError('prediction_backend_unavailable', 503);
  }
}

function participantFrom(user) {
  return {
    user_id: user.userId,
    display_name: user.displayName,
    username: user.username,
  };
}

function predictionState(match, activeSeason, now, deps) {
  if (text(match?.status).toLowerCase() === 'finished') return 'finished';
  try {
    deps.assertPredictionWritable({ match, activeSeason, now });
    return 'open';
  } catch (error) {
    if (error?.code === 'prediction_locked') return 'locked';
    throw error;
  }
}

export function createPredictionService({ request, env, now = new Date(), deps = {} } = {}) {
  const d = {
    buildPredictionWritePayload: deps.buildPredictionWritePayload || buildPredictionWritePayload,
    resolveAuthenticatedUser: deps.resolveAuthenticatedUser || resolveAuthenticatedUser,
    resolveCanonicalPredictionMatch: deps.resolveCanonicalPredictionMatch || resolveCanonicalPredictionMatch,
    listCanonicalPredictionMatches: deps.listCanonicalPredictionMatches || listCanonicalPredictionMatches,
    assertPredictionWritable: deps.assertPredictionWritable || assertPredictionWritable,
    resultFingerprint: deps.resultFingerprint || resultFingerprint,
  };

  async function user() {
    try { return await d.resolveAuthenticatedUser({ request, env }); }
    catch (error) { throw mapError(error); }
  }

  async function save(body) {
    try {
      const authenticated = await user();
      const input = d.buildPredictionWritePayload(body);
      const validated = [];
      for (const item of input.predictions) {
        const match = await d.resolveCanonicalPredictionMatch({
          request, env, competition: input.competition_key, matchId: item.match_id,
        });
        const lockedAt = d.assertPredictionWritable({ match, activeSeason: env.PREDICTION_SEASON, now });
        validated.push({
          match_id: item.match_id,
          competition: input.competition_key,
          predicted_home: item.home_score,
          predicted_away: item.away_score,
          locked_at: lockedAt,
        });
      }
      const { stub } = activeStub(env);
      const payload = await internalJson(stub, '/write', {
        method: 'POST',
        body: { participant: participantFrom(authenticated), season: env.PREDICTION_SEASON, predictions: validated },
      });
      return Array.isArray(payload.predictions) ? payload.predictions : [];
    } catch (error) { throw mapError(error); }
  }

  async function list(competition = 'all') {
    try {
      const authenticated = await user();
      const { stub } = activeStub(env);
      const params = new URLSearchParams({ user_id: authenticated.userId, competition: text(competition) || 'all' });
      const payload = await internalJson(stub, `/user?${params}`);
      return Array.isArray(payload.predictions) ? payload.predictions : [];
    } catch (error) { throw mapError(error); }
  }

  async function available(competition = 'all') {
    try {
      const authenticated = await user();
      const canonical = await d.listCanonicalPredictionMatches({ request, env, competition, now });
      const { stub } = activeStub(env);
      const params = new URLSearchParams({ user_id: authenticated.userId, competition: text(competition) || 'all' });
      const stored = await internalJson(stub, `/user?${params}`);
      const byMatch = new Map((stored.predictions || []).map(row => [row.match_id, row]));
      return {
        ...canonical,
        matches: canonical.matches.map(match => ({
          ...match,
          prediction: byMatch.get(match.matchId) || null,
          state: predictionState(match, env.PREDICTION_SEASON, now, d),
        })),
      };
    } catch (error) { throw mapError(error); }
  }

  async function reconcileFinishedMatches(stub) {
    const canonical = await d.listCanonicalPredictionMatches({ request, env, competition:'all', now });
    for (const match of canonical.matches) {
      if (text(match?.status).toLowerCase() !== 'finished') continue;
      const finalHome = Number(match.homeScore);
      const finalAway = Number(match.awayScore);
      if (!Number.isInteger(finalHome) || !Number.isInteger(finalAway)) continue;
      await internalJson(stub, '/reconcile', {
        method:'POST',
        body:{
          matchId:match.matchId,
          finalHome,
          finalAway,
          resultFingerprint:d.resultFingerprint({
            matchId:match.matchId, finalHome, finalAway, rawVersion:match.rawVersion || '',
          }),
          scoredAt:new Date(now).toISOString(),
        },
      });
    }
  }

  async function rankings({ scope = 'overall', competition } = {}) {
    try {
      await user();
      if (scope !== 'overall' && scope !== 'competition') throw new PredictionServiceError('invalid_ranking_scope', 400);
      if (scope === 'competition' && !text(competition)) throw new PredictionServiceError('competition_required', 400);
      const { stub } = activeStub(env);
      await reconcileFinishedMatches(stub);
      const params = new URLSearchParams({ scope });
      if (scope === 'competition') params.set('competition', competition);
      const payload = await internalJson(stub, `/rankings?${params}`);
      return Array.isArray(payload.ranking) ? payload.ranking : [];
    } catch (error) { throw mapError(error); }
  }

  async function rankingMe() {
    try {
      const authenticated = await user();
      const { stub } = activeStub(env);
      await reconcileFinishedMatches(stub);
      const params = new URLSearchParams({ user_id: authenticated.userId });
      const payload = await internalJson(stub, `/rankings/me?${params}`);
      return payload.ranking && typeof payload.ranking === 'object' ? payload.ranking : null;
    } catch (error) { throw mapError(error); }
  }

  return Object.freeze({ save, list, available, rankings, rankingMe });
}