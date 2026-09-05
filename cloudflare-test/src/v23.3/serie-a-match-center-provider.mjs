import { createPredictionService } from './prediction-service.mjs';
import { adaptSerieALegacyMatchCenter } from './serie-a-match-center-adapter.mjs';
import { normalizeSerieALegacyMatchCenter } from './serie-a-match-center-legacy-normalizer.mjs';

export const SERIE_A_MATCH_SUMMARY_PATH = '/api/ciao-match-summary-fast-v2';
export const SERIE_A_MATCH_CENTER_PATH = '/api/ciao-match-center-fast-v3';

export const SERIE_A_SECTION_REQUESTS = Object.freeze({
  overview:Object.freeze(['detail','stats','lineups','overview_meta','player_stats','incidents']),
  stats:Object.freeze(['stats','overview_meta']),
  events:Object.freeze(['incidents','lineups']),
  lineups:Object.freeze(['lineups']),
  players:Object.freeze(['player_stats']),
});

const OVERVIEW_EVENT_TYPES = new Set([
  'goal',
  'yellow_card',
  'red_card',
  'card',
  'substitution',
  'var',
]);

function providerError(code, status = 502) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function numericSerieAMatchId(matchId) {
  const text = String(matchId || '').trim();
  if (!text.startsWith('serie_a:')) throw providerError('competition_match_mismatch', 400);
  const value = Number(text.slice('serie_a:'.length));
  if (!Number.isFinite(value) || value <= 0) throw providerError('competition_match_mismatch', 400);
  return value;
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function integerOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function savedPredictionForMatch(rows, matchId) {
  const row = (Array.isArray(rows) ? rows : []).find(item => String(item?.match_id || '') === matchId);
  if (!row) return null;
  const homeScore = integerOrNull(row.predicted_home ?? row.home_score);
  const awayScore = integerOrNull(row.predicted_away ?? row.away_score);
  if (homeScore === null || awayScore === null) return null;
  return Object.freeze({ homeScore, awayScore, kind:'user' });
}

async function authoritativeUserPrediction({ request, env, matchId }) {
  if (!env?.PREDICTION_LEAGUE) return null;
  try {
    const service = createPredictionService({ request, env, now:new Date() });
    const rows = await service.list('serie_a');
    return savedPredictionForMatch(rows, matchId);
  } catch {
    return null;
  }
}

export function unwrapSerieAMatchCenterPayload(payload) {
  const root = object(payload) || {};
  const candidates = [
    root.match_center,
    root.matchCenter,
    root.data?.match_center,
    root.data?.matchCenter,
    root.state?.match_center,
    root.state?.matchCenter,
    root.data,
    root,
  ];
  return candidates.map(object).find(candidate => candidate && (
    object(candidate.match)
    || object(candidate.overview_meta)
    || object(candidate.stats)
    || Array.isArray(candidate.incidents)
    || object(candidate.incidents)
    || object(candidate.lineups)
    || Array.isArray(candidate.player_stats)
    || object(candidate.player_stats)
  )) || root;
}

async function postStable({ request, env, initData, path, body }) {
  if (!env?.CIAO_WEB_API?.fetch) throw providerError('ciao_web_api_unavailable', 503);
  const upstream = await env.CIAO_WEB_API.fetch(new Request(new URL(path, request.url), {
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-telegram-init-data':String(initData || ''),
    },
    body:JSON.stringify(body),
  }));
  let payload;
  try {
    payload = await upstream.json();
  } catch {
    throw providerError('invalid_upstream_json', 502);
  }
  if (!upstream.ok || payload?.ok === false) {
    throw providerError(String(payload?.error || 'serie_a_match_center_upstream_failed'), upstream.status || 502);
  }
  return unwrapSerieAMatchCenterPayload(payload);
}

function mergeSerieALegacyPayload(summaryRaw, richRaw) {
  const summary = object(summaryRaw) || {};
  const rich = object(richRaw) || {};
  const summaryMatch = object(summary.match) || {};
  const richMatch = object(rich.match) || {};
  const prediction = richMatch.prediction ?? summaryMatch.prediction;
  const predictionSplit = rich.prediction_split
    ?? rich.predictionSplit
    ?? summary.prediction_split
    ?? summary.predictionSplit;
  return {
    ...summary,
    ...rich,
    match:{
      ...summaryMatch,
      ...richMatch,
      ...(prediction !== undefined ? { prediction } : {}),
    },
    ...(predictionSplit !== undefined ? { prediction_split:predictionSplit } : {}),
  };
}

function adaptLegacy(raw) {
  return adaptSerieALegacyMatchCenter(normalizeSerieALegacyMatchCenter(raw));
}

function richEnoughBase(adapted) {
  const home = String(adapted?.base?.homeTeam?.name || '').trim();
  const away = String(adapted?.base?.awayTeam?.name || '').trim();
  return Boolean(home && away && home !== '—' && away !== '—');
}

function scorerCount(adapted) {
  const home = Array.isArray(adapted?.base?.goals?.home) ? adapted.base.goals.home.length : 0;
  const away = Array.isArray(adapted?.base?.goals?.away) ? adapted.base.goals.away.length : 0;
  return home + away;
}

function needsHeroGoalEnrichment(adapted) {
  const status = String(adapted?.base?.status || '').trim().toLowerCase();
  if (status !== 'live' && status !== 'finished') return false;
  const homeScore = Number(adapted?.base?.homeScore);
  const awayScore = Number(adapted?.base?.awayScore);
  const scored = (Number.isFinite(homeScore) ? homeScore : 0) + (Number.isFinite(awayScore) ? awayScore : 0);
  return scored > 0 && scorerCount(adapted) < scored;
}

function canonicalBaseFromAdapted(adapted) {
  return {
    ...adapted.base,
    venue:adapted.overview?.venue ?? null,
    referee:adapted.overview?.referee ?? null,
    coverage:adapted.coverage,
  };
}

function numericRating(player) {
  if (player?.rating === null || player?.rating === undefined || player?.rating === '') return null;
  const rating = Number(player.rating);
  return Number.isFinite(rating) ? rating : null;
}

function bestRatedPlayer(players) {
  let best = null;
  let bestRating = null;
  for (const player of Array.isArray(players) ? players : []) {
    const rating = numericRating(player);
    if (rating === null || (bestRating !== null && rating <= bestRating)) continue;
    best = player;
    bestRating = rating;
  }
  return best;
}

function eventClockValue(event = {}) {
  const minute = Number(event?.minute);
  const addedTime = Number(event?.addedTime);
  const safeMinute = Number.isFinite(minute) ? minute : -1;
  const safeAddedTime = Number.isFinite(addedTime) ? addedTime : 0;
  return safeMinute * 100 + safeAddedTime;
}

function latestOverviewEvents(events) {
  return (Array.isArray(events) ? events : [])
    .filter(event => OVERVIEW_EVENT_TYPES.has(String(event?.type || '').trim().toLowerCase()))
    .slice()
    .sort((left, right) => eventClockValue(left) - eventClockValue(right))
    .slice(-4);
}

function canonicalSectionPayload(adapted, section) {
  if (section !== 'overview') {
    return {
      available:adapted.coverage?.[section] === true,
      coverage:adapted.coverage,
      data:adapted[section] ?? null,
    };
  }

  const available = adapted.coverage?.overview === true || adapted.coverage?.stats === true;
  const coverage = Object.freeze({ ...adapted.coverage, overview:available });
  const data = Object.freeze({
    ...adapted.overview,
    summaryStats:adapted.coverage?.stats === true ? adapted.stats : null,
    bestPlayer:bestRatedPlayer(adapted.players),
    recentEvents:Object.freeze(latestOverviewEvents(adapted.events)),
  });
  return { available, coverage, data };
}

export async function loadSerieAMatchCenterBase({ request, env, initData, matchId }) {
  const id = numericSerieAMatchId(matchId);
  const summaryRaw = await postStable({
    request,
    env,
    initData,
    path:SERIE_A_MATCH_SUMMARY_PATH,
    body:{ match_id:id },
  });
  let mergedRaw = summaryRaw;
  let adapted = adaptLegacy(mergedRaw);
  if (!richEnoughBase(adapted)) {
    const fullRaw = await postStable({
      request,
      env,
      initData,
      path:SERIE_A_MATCH_CENTER_PATH,
      body:{ match_id:id, sections:[], include_split:false },
    });
    mergedRaw = mergeSerieALegacyPayload(mergedRaw, fullRaw);
    adapted = adaptLegacy(mergedRaw);
  }
  if (!richEnoughBase(adapted)) throw providerError('match_not_found', 404);

  if (needsHeroGoalEnrichment(adapted)) {
    const incidentRaw = await postStable({
      request,
      env,
      initData,
      path:SERIE_A_MATCH_CENTER_PATH,
      body:{ match_id:id, sections:['incidents'], include_split:false },
    });
    mergedRaw = mergeSerieALegacyPayload(mergedRaw, incidentRaw);
    adapted = adaptLegacy(mergedRaw);
  }

  return { match:canonicalBaseFromAdapted(adapted) };
}

export async function loadSerieAMatchCenterSection({ request, env, initData, matchId, section }) {
  const id = numericSerieAMatchId(matchId);
  const sections = SERIE_A_SECTION_REQUESTS[section];
  if (!sections) throw providerError('invalid_match_center_section', 400);

  const richPromise = postStable({
    request,
    env,
    initData,
    path:SERIE_A_MATCH_CENTER_PATH,
    body:{ match_id:id, sections:[...sections], include_split:false },
  });

  let raw;
  if (section === 'overview') {
    const summaryPromise = postStable({
      request,
      env,
      initData,
      path:SERIE_A_MATCH_SUMMARY_PATH,
      body:{ match_id:id },
    }).catch(() => null);
    const [summaryRaw, richRaw] = await Promise.all([summaryPromise, richPromise]);
    raw = mergeSerieALegacyPayload(summaryRaw, richRaw);
  } else {
    raw = await richPromise;
  }

  const payload = canonicalSectionPayload(adaptLegacy(raw), section);
  if (section !== 'overview' || !env?.PREDICTION_LEAGUE) return payload;

  const prediction = await authoritativeUserPrediction({ request, env, matchId });
  return {
    ...payload,
    data:Object.freeze({
      ...payload.data,
      prediction,
    }),
  };
}

export { needsHeroGoalEnrichment };
