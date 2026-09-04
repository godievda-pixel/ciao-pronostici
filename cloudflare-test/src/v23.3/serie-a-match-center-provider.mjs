import { adaptSerieALegacyMatchCenter } from './serie-a-match-center-adapter.mjs';

export const SERIE_A_MATCH_SUMMARY_PATH = '/api/ciao-match-summary-fast-v2';
export const SERIE_A_MATCH_CENTER_PATH = '/api/ciao-match-center-fast-v3';

export const SERIE_A_SECTION_REQUESTS = Object.freeze({
  overview:Object.freeze(['detail','stats','lineups','overview_meta','player_stats']),
  stats:Object.freeze(['stats']),
  events:Object.freeze(['incidents','lineups']),
  lineups:Object.freeze(['lineups']),
  players:Object.freeze(['player_stats']),
});

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

function richEnoughBase(adapted) {
  const home = String(adapted?.base?.homeTeam?.name || '').trim();
  const away = String(adapted?.base?.awayTeam?.name || '').trim();
  return Boolean(home && away && home !== '—' && away !== '—');
}

function canonicalBaseFromAdapted(adapted) {
  return {
    ...adapted.base,
    venue:adapted.overview?.venue ?? null,
    referee:adapted.overview?.referee ?? null,
    coverage:adapted.coverage,
  };
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
  let adapted = adaptSerieALegacyMatchCenter(summaryRaw);
  if (!richEnoughBase(adapted)) {
    const fullRaw = await postStable({
      request,
      env,
      initData,
      path:SERIE_A_MATCH_CENTER_PATH,
      body:{ match_id:id, sections:[], include_split:false },
    });
    adapted = adaptSerieALegacyMatchCenter({ ...summaryRaw, ...fullRaw });
  }
  if (!richEnoughBase(adapted)) throw providerError('match_not_found', 404);
  return { match:canonicalBaseFromAdapted(adapted) };
}

export async function loadSerieAMatchCenterSection({ request, env, initData, matchId, section }) {
  const id = numericSerieAMatchId(matchId);
  const sections = SERIE_A_SECTION_REQUESTS[section];
  if (!sections) throw providerError('invalid_match_center_section', 400);
  const raw = await postStable({
    request,
    env,
    initData,
    path:SERIE_A_MATCH_CENTER_PATH,
    body:{ match_id:id, sections:[...sections], include_split:false },
  });
  const adapted = adaptSerieALegacyMatchCenter(raw);
  return {
    available:adapted.coverage?.[section] === true,
    coverage:adapted.coverage,
    data:adapted[section] ?? null,
  };
}
