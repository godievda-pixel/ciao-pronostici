import { getCompetitionConfig, COMPETITION_KEYS } from '../v23.2/competition-config.mjs';
import { adaptSerieASchedule } from '../v23.2/serie-a-adapter.mjs';
import { fetchBsdMatchSnapshot, fetchBsdMatches } from '../v23.2/bsd-provider.mjs';
import { normalizeTeamAlias, russianTeamName } from '../v23.2/team-registry.mjs';
import { predictionDeadlineForKickoff } from './competition-data.mjs';
import { enrichSerieAMatchesWithCrests, fetchSerieACrestRegistry } from './serie-a-crest-source.mjs';

const LEGACY_CORE_API = '/api/ciao-core-api-fast-v4';
const LEGACY_SERIE_A_SCHEDULE = '/api/ciao-schedule-fast-v1';

export class PredictionMatchError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function text(value) {
  return String(value ?? '').trim();
}

export function normalizePredictionSeason(value) {
  const raw = text(value);
  const match = raw.match(/(20\d{2})[\/-](\d{2}|20\d{2})/);
  if (match) {
    const end = match[2].length === 4 ? match[2].slice(2) : match[2];
    return `${match[1]}-${end}`;
  }
  const startOnly = raw.match(/^(20\d{2})$/);
  if (startOnly) {
    const start = Number(startOnly[1]);
    const end = String((start + 1) % 100).padStart(2, '0');
    return `${startOnly[1]}-${end}`;
  }
  throw new PredictionMatchError('season_mismatch', 409);
}

function bindResolvedSeason(match, activeSeason) {
  const season = text(activeSeason);
  if (!season) throw new PredictionMatchError('season_mismatch', 409);
  const provided = text(match?.season);
  if (provided && normalizePredictionSeason(provided) !== season) {
    throw new PredictionMatchError('season_mismatch', 409);
  }
  return Object.freeze({ ...match, season });
}

export function assertPredictionWritable({ match, activeSeason, now = new Date() } = {}) {
  if (normalizePredictionSeason(match?.season) !== text(activeSeason)) {
    throw new PredictionMatchError('season_mismatch', 409);
  }
  if (['live', 'finished'].includes(text(match?.status).toLowerCase())) {
    throw new PredictionMatchError('prediction_locked', 409);
  }
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  let deadline;
  try {
    deadline = predictionDeadlineForKickoff(match?.kickoffAt);
  } catch {
    throw new PredictionMatchError('match_resolution_failed', 502);
  }
  const deadlineMs = Date.parse(deadline);
  if (!Number.isFinite(nowMs) || !Number.isFinite(deadlineMs)) {
    throw new PredictionMatchError('match_resolution_failed', 502);
  }
  if (nowMs >= deadlineMs) throw new PredictionMatchError('prediction_locked', 409);
  return deadline;
}

function validateIdentity(competition, matchId) {
  try {
    getCompetitionConfig(competition);
  } catch {
    throw new PredictionMatchError('competition_not_supported', 400);
  }
  const id = text(matchId);
  if (!id || !id.startsWith(`${competition}:`) || !id.slice(competition.length + 1)) {
    throw new PredictionMatchError('competition_match_mismatch', 400);
  }
  return id;
}

function dateText(value) {
  return value.toISOString().slice(0, 10);
}

function activeDateRange(now = new Date()) {
  const from = new Date(now);
  const to = new Date(now);
  from.setUTCDate(from.getUTCDate() - 45);
  to.setUTCDate(to.getUTCDate() + 120);
  return { from: dateText(from), to: dateText(to) };
}

function stateSchedule(payload = {}) {
  const roots = [payload, payload?.state, payload?.data, payload?.data?.state]
    .filter(item => item && typeof item === 'object');
  for (const root of roots) {
    const round = root?.round && typeof root.round === 'object' ? root.round : null;
    const matches = Array.isArray(round?.matches) ? round.matches : [];
    const number = Number(root?.selected_round ?? round?.number ?? round?.round_number);
    if (!matches.length || !Number.isFinite(number) || number <= 0) continue;
    return {
      current_round:number,
      rounds:[{ number, matches }],
    };
  }
  return null;
}

async function fetchLegacySerieAJson({ request, env, path, body }) {
  const initData = text(request?.headers?.get?.('x-telegram-init-data'));
  const upstream = await env.CIAO_WEB_API.fetch(new Request(
    new URL(path, request.url),
    {
      method:'POST',
      headers:{
        'content-type':'application/json',
        'x-telegram-init-data':initData,
      },
      body:JSON.stringify(body),
    },
  ));
  let payload;
  try {
    payload = await upstream.json();
  } catch {
    throw new PredictionMatchError('match_resolution_failed', 502);
  }
  if (!upstream.ok || payload?.ok === false) {
    throw new PredictionMatchError('match_resolution_failed', 502);
  }
  return payload;
}

function canonicalTeamName(team = {}) {
  const raw = text(team?.rawName || team?.name);
  return raw ? normalizeTeamAlias(russianTeamName(raw)) : '';
}

function sameTeam(left = {}, right = {}) {
  const leftId = text(left?.id);
  const rightId = text(right?.id);
  if (leftId && rightId && leftId === rightId) return true;
  const leftName = canonicalTeamName(left);
  const rightName = canonicalTeamName(right);
  return Boolean(leftName && rightName && leftName === rightName);
}

function sameFixture(left = {}, right = {}) {
  return sameTeam(left?.homeTeam, right?.homeTeam) && sameTeam(left?.awayTeam, right?.awayTeam);
}

function mergeTeamCrest(primary = {}, source = {}) {
  if (text(primary?.crestUrl) || !text(source?.crestUrl) || !sameTeam(primary, source)) return primary;
  return Object.freeze({ ...primary, crestUrl:source.crestUrl });
}

function enrichSerieACrests(primarySchedule, crestSchedule) {
  const primary = Array.isArray(primarySchedule?.matches) ? primarySchedule.matches : [];
  const crestMatches = Array.isArray(crestSchedule?.matches) ? crestSchedule.matches : [];
  if (!primary.length || !crestMatches.length) return primarySchedule;
  const byId = new Map(crestMatches.map(match => [text(match?.matchId), match]));
  return Object.freeze({
    ...primarySchedule,
    matches:Object.freeze(primary.map(match => {
      const source = byId.get(text(match?.matchId)) || crestMatches.find(item => sameFixture(match, item));
      if (!source) return match;
      return Object.freeze({
        ...match,
        homeTeam:mergeTeamCrest(match.homeTeam, source.homeTeam),
        awayTeam:mergeTeamCrest(match.awayTeam, source.awayTeam),
      });
    })),
  });
}

async function enrichSerieAWithBsd(schedule, env, fetchRegistry = fetchSerieACrestRegistry) {
  const apiKey = text(env?.BSD_API_KEY);
  if (!apiKey || !Array.isArray(schedule?.matches) || !schedule.matches.length) return schedule;
  try {
    const registry = await fetchRegistry({ apiKey });
    return Object.freeze({
      ...schedule,
      matches:Object.freeze(enrichSerieAMatchesWithCrests(schedule.matches, registry)),
    });
  } catch {
    return schedule;
  }
}

async function loadSerieA({ request, env, adapt = adaptSerieASchedule, fetchRegistry = fetchSerieACrestRegistry }) {
  if (!env?.CIAO_WEB_API || typeof env.CIAO_WEB_API.fetch !== 'function') {
    throw new PredictionMatchError('match_resolution_failed', 502);
  }

  try {
    const statePayload = await fetchLegacySerieAJson({
      request,
      env,
      path:LEGACY_CORE_API,
      body:{ action:'state' },
    });
    const stableRound = stateSchedule(statePayload);
    if (stableRound) {
      const adapted = adapt(stableRound);
      if (Array.isArray(adapted?.matches) && adapted.matches.length) {
        let enriched = adapted;
        try {
          const schedulePayload = await fetchLegacySerieAJson({
            request,
            env,
            path:LEGACY_SERIE_A_SCHEDULE,
            body:{},
          });
          enriched = enrichSerieACrests(adapted, adapt(schedulePayload));
        } catch {}
        return enrichSerieAWithBsd(enriched, env, fetchRegistry);
      }
    }
  } catch {}

  const schedulePayload = await fetchLegacySerieAJson({
    request,
    env,
    path:LEGACY_SERIE_A_SCHEDULE,
    body:{},
  });
  return enrichSerieAWithBsd(adapt(schedulePayload), env, fetchRegistry);
}

function assertActiveSeason(match, activeSeason) {
  return bindResolvedSeason(match, activeSeason);
}

export async function resolveCanonicalPredictionMatch({
  request,
  env,
  competition,
  matchId,
  deps = {},
} = {}) {
  const key = text(competition);
  const id = validateIdentity(key, matchId);
  const adapt = deps.adaptSerieASchedule || adaptSerieASchedule;
  const fetchExternal = deps.fetchBsdMatchSnapshot || fetchBsdMatchSnapshot;

  try {
    let match;
    if (key === 'serie_a') {
      const schedule = await loadSerieA({ request, env, adapt, fetchRegistry:deps.fetchSerieACrestRegistry || fetchSerieACrestRegistry });
      match = (Array.isArray(schedule?.matches) ? schedule.matches : []).find(item => item?.matchId === id) || null;
    } else {
      const apiKey = text(env?.BSD_API_KEY);
      if (!apiKey) throw new PredictionMatchError('match_resolution_failed', 502);
      match = await fetchExternal({ competition: key, matchId: id, apiKey });
    }
    if (!match) throw new PredictionMatchError('match_not_found', 404);
    if (text(match.competition) !== key || text(match.matchId) !== id) {
      throw new PredictionMatchError('match_resolution_failed', 502);
    }
    return assertActiveSeason(match, env?.PREDICTION_SEASON);
  } catch (error) {
    if (error instanceof PredictionMatchError) throw error;
    throw new PredictionMatchError('match_resolution_failed', 502);
  }
}

async function listOne({ request, env, competition, deps, range }) {
  if (competition === 'serie_a') {
    const schedule = await loadSerieA({
      request,
      env,
      adapt: deps.adaptSerieASchedule || adaptSerieASchedule,
      fetchRegistry:deps.fetchSerieACrestRegistry || fetchSerieACrestRegistry,
    });
    return Array.isArray(schedule?.matches) ? schedule.matches : [];
  }
  const apiKey = text(env?.BSD_API_KEY);
  if (!apiKey) throw new PredictionMatchError('match_resolution_failed', 502);
  const fetchExternal = deps.fetchBsdMatches || fetchBsdMatches;
  return fetchExternal({ competition, from: range.from, to: range.to, apiKey });
}

export async function listCanonicalPredictionMatches({
  request,
  env,
  competition = 'all',
  now = new Date(),
  deps = {},
} = {}) {
  const requested = text(competition) || 'all';
  const keys = requested === 'all' ? [...COMPETITION_KEYS] : [requested];
  for (const key of keys) {
    try {
      getCompetitionConfig(key);
    } catch {
      throw new PredictionMatchError('competition_not_supported', 400);
    }
  }
  const range = activeDateRange(now);
  const settled = await Promise.allSettled(
    keys.map(key => listOne({ request, env, competition:key, deps, range })),
  );
  const matches = [];
  const errors = {};
  settled.forEach((result, index) => {
    const key = keys[index];
    if (result.status === 'rejected') {
      const error = result.reason;
      errors[key] = error instanceof PredictionMatchError ? error.code : 'match_resolution_failed';
      return;
    }
    for (const match of Array.isArray(result.value) ? result.value : []) {
      try {
        if (text(match?.competition) !== key) continue;
        matches.push(bindResolvedSeason(match, env?.PREDICTION_SEASON));
      } catch {}
    }
  });

  if (requested !== 'all' && errors[requested]) {
    throw new PredictionMatchError(
      errors[requested],
      errors[requested] === 'season_mismatch' ? 409 : 502,
    );
  }
  matches.sort((a, b) => (
    Date.parse(a?.kickoffAt || '') - Date.parse(b?.kickoffAt || '')
    || text(a?.matchId).localeCompare(text(b?.matchId))
  ));
  return Object.freeze({
    matches:Object.freeze(matches),
    errors:Object.freeze(errors),
    from:range.from,
    to:range.to,
  });
}
