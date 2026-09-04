import { buildPredictionWritePayload } from './prediction-contract.mjs';
import { resolveAuthenticatedUser } from './prediction-auth.mjs';
import {
  resolveCanonicalPredictionMatch,
  listCanonicalPredictionMatches,
  assertPredictionWritable,
} from './prediction-match-resolver.mjs';
import { predictionObjectName } from './prediction-sql.mjs';
import { resultFingerprint } from './prediction-scorer.mjs';

const UEFA_COMPETITIONS = new Set(['ucl','uel','uecl']);

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
    if (!response.ok || !payload?.ok) throw new PredictionServiceError('prediction_backend_unavailable', 503);
    return payload?.data ?? payload;
  } catch (error) {
    if (error instanceof PredictionServiceError) throw error;
    throw new PredictionServiceError('prediction_backend_unavailable', 503);
  }
}

function participantFrom(user) {
  return { user_id:user.userId, display_name:user.displayName, username:user.username };
}

function participantRoster(authenticated) {
  const byId = new Map();
  const legacy = Array.isArray(authenticated?.participants) ? authenticated.participants : [];
  for (const participant of legacy) {
    if (!text(participant?.userId)) continue;
    byId.set(participant.userId, participantFrom(participant));
  }
  const current = participantFrom(authenticated);
  byId.delete(current.user_id);
  return [current, ...byId.values()];
}

function favoriteTeamMap(authenticated) {
  const byId = new Map();
  const currentId = text(authenticated?.userId);
  if (currentId) byId.set(currentId, authenticated?.favoriteTeam || null);
  for (const participant of Array.isArray(authenticated?.participants) ? authenticated.participants : []) {
    const userId = text(participant?.userId);
    if (userId) byId.set(userId, participant?.favoriteTeam || null);
  }
  return byId;
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

function numericRound(match) {
  const direct = Number(match?.round);
  if (Number.isInteger(direct) && direct > 0) return direct;
  const source = text(match?.stage);
  const parsed = source.match(/(?:round|matchday|тур)\s*[-–—:]?\s*(\d+)/i) || source.match(/\b(\d+)\b/);
  const value = Number(parsed?.[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function uefaCompetitionsNeedingGate(matches = []) {
  const rounds = new Map();
  for (const match of matches) {
    const competition = text(match?.competition);
    if (!UEFA_COMPETITIONS.has(competition)) continue;
    const round = numericRound(match);
    if (!round) continue;
    if (!rounds.has(competition)) rounds.set(competition, new Set());
    rounds.get(competition).add(round);
  }
  return new Set([...rounds].filter(([, values]) => values.size > 1).map(([competition]) => competition));
}

function buildUefaRoundGate(matches = [], reconciledIds = new Set()) {
  const gate = new Map();
  const byCompetition = new Map();
  for (const match of matches) {
    const competition = text(match?.competition);
    const round = numericRound(match);
    if (!UEFA_COMPETITIONS.has(competition) || !round) continue;
    if (!byCompetition.has(competition)) byCompetition.set(competition, new Map());
    const rounds = byCompetition.get(competition);
    if (!rounds.has(round)) rounds.set(round, []);
    rounds.get(round).push(match);
  }

  for (const [competition, rounds] of byCompetition) {
    const ordered = [...rounds.keys()].sort((a, b) => a - b);
    if (ordered.length < 2) continue;
    const fullyReconciled = round => rounds.get(round).every(match => (
      text(match?.status).toLowerCase() === 'finished' && reconciledIds.has(text(match?.matchId))
    ));
    const eligibleRound = ordered.find(round => !fullyReconciled(round));
    if (!eligibleRound) continue;
    for (const round of ordered) {
      for (const match of rounds.get(round)) {
        if (round > eligibleRound) {
          gate.set(text(match.matchId), Object.freeze({
            competition,
            round,
            eligibleRound,
            locked:true,
            reason:'previous_round_not_reconciled',
          }));
        }
      }
    }
  }
  return gate;
}

export function createPredictionService({ request, env, now = new Date(), deps = {}, scheduleBackground } = {}) {
  const d = {
    buildPredictionWritePayload: deps.buildPredictionWritePayload || buildPredictionWritePayload,
    resolveAuthenticatedUser: deps.resolveAuthenticatedUser || resolveAuthenticatedUser,
    resolveCanonicalPredictionMatch: deps.resolveCanonicalPredictionMatch || resolveCanonicalPredictionMatch,
    listCanonicalPredictionMatches: deps.listCanonicalPredictionMatches || listCanonicalPredictionMatches,
    assertPredictionWritable: deps.assertPredictionWritable || assertPredictionWritable,
    resultFingerprint: deps.resultFingerprint || resultFingerprint,
  };
  const background = typeof scheduleBackground === 'function'
    ? scheduleBackground
    : promise => { Promise.resolve(promise).catch(() => {}); };

  async function user() {
    try { return await d.resolveAuthenticatedUser({ request, env }); }
    catch (error) { throw mapError(error); }
  }

  async function registerParticipants(stub, authenticated) {
    const participants = participantRoster(authenticated);
    await internalJson(stub, '/participants', {
      method:'POST', body:{ season:env.PREDICTION_SEASON, participants },
    });
    return participants;
  }

  async function reconciledSet(stub, competition = '') {
    const params = new URLSearchParams();
    if (competition) params.set('competition', competition);
    const suffix = params.size ? `?${params}` : '';
    const payload = await internalJson(stub, `/reconciled${suffix}`);
    return new Set(Array.isArray(payload.match_ids) ? payload.match_ids.map(text).filter(Boolean) : []);
  }

  async function gateForCanonical(stub, canonicalMatches) {
    const needingGate = uefaCompetitionsNeedingGate(canonicalMatches);
    if (!needingGate.size) return new Map();
    const reconciled = await reconciledSet(stub);
    return buildUefaRoundGate(canonicalMatches, reconciled);
  }

  async function save(body) {
    try {
      const authenticated = await user();
      const input = d.buildPredictionWritePayload(body);
      const resolved = [];

      for (const item of input.predictions) {
        const match = await d.resolveCanonicalPredictionMatch({
          request, env, competition:input.competition_key, matchId:item.match_id,
        });
        const lockedAt = d.assertPredictionWritable({ match, activeSeason:env.PREDICTION_SEASON, now });
        resolved.push({ item, match, lockedAt });
      }

      let stub = null;
      if (
        UEFA_COMPETITIONS.has(input.competition_key)
        && resolved.some(({ match }) => (numericRound(match) || 0) > 1)
      ) {
        const canonical = await d.listCanonicalPredictionMatches({
          request, env, competition:input.competition_key, now,
        });
        stub = activeStub(env).stub;
        const roundGate = await gateForCanonical(stub, canonical.matches || []);
        for (const { item } of resolved) {
          if (roundGate.get(text(item.match_id))?.locked) {
            throw new PredictionServiceError('prediction_round_locked', 409);
          }
        }
      }

      if (!stub) stub = activeStub(env).stub;
      const validated = resolved.map(({ item, lockedAt }) => ({
        match_id:item.match_id,
        competition:input.competition_key,
        predicted_home:item.home_score,
        predicted_away:item.away_score,
        locked_at:lockedAt,
      }));
      const payload = await internalJson(stub, '/write', {
        method:'POST',
        body:{ participant:participantFrom(authenticated), season:env.PREDICTION_SEASON, predictions:validated },
      });
      return Array.isArray(payload.predictions) ? payload.predictions : [];
    } catch (error) { throw mapError(error); }
  }

  async function list(competition = 'all') {
    try {
      const authenticated = await user();
      const { stub } = activeStub(env);
      const params = new URLSearchParams({ user_id:authenticated.userId, competition:text(competition) || 'all' });
      const payload = await internalJson(stub, `/user?${params}`);
      return Array.isArray(payload.predictions) ? payload.predictions : [];
    } catch (error) { throw mapError(error); }
  }

  async function available(competition = 'all') {
    try {
      const authenticated = await user();
      const canonical = await d.listCanonicalPredictionMatches({ request, env, competition, now });
      const { stub } = activeStub(env);
      const params = new URLSearchParams({ user_id:authenticated.userId, competition:text(competition) || 'all' });
      const [stored, roundGate] = await Promise.all([
        internalJson(stub, `/user?${params}`),
        gateForCanonical(stub, canonical.matches || []),
      ]);
      const byMatch = new Map((stored.predictions || []).map(row => [row.match_id, row]));
      return {
        ...canonical,
        participant:participantFrom(authenticated),
        matches:canonical.matches.map(match => {
          const roundLock = roundGate.get(text(match.matchId));
          return {
            ...match,
            prediction:byMatch.get(match.matchId) || null,
            state:roundLock?.locked ? 'round_locked' : predictionState(match, env.PREDICTION_SEASON, now, d),
            roundLocked:Boolean(roundLock?.locked),
            roundLockReason:roundLock?.reason || null,
            eligibleRound:roundLock?.eligibleRound || null,
          };
        }),
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

  function reconcileInBackground(stub) {
    background(reconcileFinishedMatches(stub).catch(() => {}));
  }

  async function rankings({ scope = 'overall', competition } = {}) {
    try {
      const authenticated = await user();
      if (scope !== 'overall' && scope !== 'competition') throw new PredictionServiceError('invalid_ranking_scope', 400);
      if (scope === 'competition' && !text(competition)) throw new PredictionServiceError('competition_required', 400);
      const { stub } = activeStub(env);
      await registerParticipants(stub, authenticated);
      reconcileInBackground(stub);
      const params = new URLSearchParams({ scope });
      if (scope === 'competition') params.set('competition', competition);
      const payload = await internalJson(stub, `/rankings?${params}`);
      const ranking = Array.isArray(payload.ranking) ? payload.ranking : [];
      const clubs = favoriteTeamMap(authenticated);
      return ranking.map(row => ({
        ...row,
        favorite_team: clubs.get(text(row?.user_id)) || null,
        is_current:text(row?.user_id) === authenticated.userId,
      }));
    } catch (error) { throw mapError(error); }
  }

  async function rankingMe() {
    try {
      const authenticated = await user();
      const { stub } = activeStub(env);
      await registerParticipants(stub, authenticated);
      reconcileInBackground(stub);
      const params = new URLSearchParams({ user_id:authenticated.userId });
      const payload = await internalJson(stub, `/rankings/me?${params}`);
      if (!payload.ranking || typeof payload.ranking !== 'object') return null;
      return { ...payload.ranking, favorite_team:authenticated.favoriteTeam || null };
    } catch (error) { throw mapError(error); }
  }

  return Object.freeze({ save, list, available, rankings, rankingMe });
}
