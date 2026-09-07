import { getCompetitionConfig } from './competition-config.mjs';
import { normalizeBsdEvent } from './normalizer.mjs';

export const BSD_BASE = 'https://sports.bzzoiro.com/api/v2';
const MAX_RANGE_DAYS = 370;
const EUROPEAN = new Set(['ucl', 'uel', 'uecl']);
const COPPA_SINGLE_LEG_STAGES = new Set(['r32', 'r16', 'qf', 'final']);

export class BsdUpstreamError extends Error {
  constructor(stage, status, code = 'upstream_failed') {
    super(`BSD ${String(stage || 'unknown')} failed: HTTP ${Number.isFinite(Number(status)) ? Number(status) : 0}`);
    this.name = 'BsdUpstreamError';
    this.stage = String(stage || 'unknown');
    this.status = Number.isFinite(Number(status)) ? Number(status) : null;
    this.code = String(code || 'upstream_failed');
  }
}

function text(value) {
  return String(value ?? '').trim();
}

function normalizeLeagueName(value) {
  return text(value).toLowerCase().replace(/^uefa\s+/, '').replace(/\s+/g, ' ');
}

function isoDate(value) {
  const valueText = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueText)) throw new Error(`Invalid date: ${valueText || 'empty'}`);
  const time = Date.parse(`${valueText}T00:00:00Z`);
  if (!Number.isFinite(time)) throw new Error(`Invalid date: ${valueText}`);
  return { text: valueText, time };
}

function assertRange(from, to) {
  const start = isoDate(from);
  const end = isoDate(to);
  if (end.time < start.time) throw new Error('Invalid date range: to is before from');
  const days = Math.floor((end.time - start.time) / 86400000) + 1;
  if (days > MAX_RANGE_DAYS) throw new Error(`Date range exceeds ${MAX_RANGE_DAYS} days`);
  return { from: start.text, to: end.text };
}

function authHeaders(apiKey) {
  const key = text(apiKey);
  if (!key) throw new Error('BSD API key is required');
  return {
    accept: 'application/json',
    authorization: `Token ${key}`,
    'cache-control': 'no-cache',
  };
}

function buildUrl(path, params = {}) {
  const url = new URL(`${BSD_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url;
}

function pageRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function upstreamCode(payload, fallback) {
  if (!payload || typeof payload !== 'object') return fallback;
  const value = payload.code ?? payload.error_code ?? payload.error?.code;
  return text(value) || fallback;
}

async function fetchJson(url, apiKey, fetchImpl, stage) {
  let response;
  try {
    response = await fetchImpl(url, { headers: authHeaders(apiKey) });
  } catch {
    throw new BsdUpstreamError(stage, 0, 'network_error');
  }

  if (!response?.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new BsdUpstreamError(stage, response?.status ?? 0, upstreamCode(payload, `http_${response?.status ?? 0}`));
  }

  const type = text(response.headers?.get?.('content-type')).toLowerCase();
  if (type && !type.includes('json')) throw new BsdUpstreamError(stage, response.status, 'non_json_response');

  try {
    return await response.json();
  } catch {
    throw new BsdUpstreamError(stage, response.status, 'invalid_json');
  }
}

async function fetchAll(path, params, apiKey, fetchImpl, stage) {
  const rows = [];
  const limit = 200;
  let offset = 0;

  while (true) {
    const payload = await fetchJson(
      buildUrl(path, { ...params, limit, offset }),
      apiKey,
      fetchImpl,
      stage,
    );
    const page = pageRows(payload);
    rows.push(...page);

    const count = Number(payload?.count);
    if (page.length < limit) break;
    if (Number.isFinite(count) && rows.length >= count) break;
    if (!page.length) break;
    offset += page.length;
  }

  return rows;
}

async function resolveLeague(competition, apiKey, fetchImpl) {
  const config = getCompetitionConfig(competition);
  if (!config.external) throw new Error(`BSD provider is not used for ${competition}`);
  const aliases = new Set((config.leagueAliases || []).map(normalizeLeagueName));
  const leagues = await fetchAll('/leagues/', {}, apiKey, fetchImpl, 'leagues');
  const league = leagues.find(item => aliases.has(normalizeLeagueName(item?.name ?? item?.league_name)));
  if (!league?.id) throw new BsdUpstreamError('leagues', 200, 'league_not_found');
  return league;
}

function directSeason(payload) {
  const candidates = [
    payload,
    payload?.season,
    payload?.current_season,
    payload?.currentSeason,
    payload?.data,
    payload?.data?.season,
    payload?.data?.current_season,
    payload?.data?.currentSeason,
  ];
  return candidates.find(candidate => candidate && typeof candidate === 'object' && candidate.id) || null;
}

function chooseSeason(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const current = rows.find(row => row?.is_current === true || row?.current === true || row?.isCurrent === true);
  if (current?.id) return current;
  return [...rows]
    .filter(row => row?.id)
    .sort((a, b) => {
      const yearA = Number(a?.year || 0);
      const yearB = Number(b?.year || 0);
      if (yearA !== yearB) return yearB - yearA;
      return Number(b?.id || 0) - Number(a?.id || 0);
    })[0] || null;
}

async function resolveSeason(leagueId, apiKey, fetchImpl) {
  const payload = await fetchJson(
    buildUrl(`/leagues/${encodeURIComponent(leagueId)}/season/`),
    apiKey,
    fetchImpl,
    'season',
  );
  const direct = directSeason(payload);
  if (direct?.id) return direct;

  const seasons = await fetchAll(
    `/leagues/${encodeURIComponent(leagueId)}/seasons/`,
    {},
    apiKey,
    fetchImpl,
    'season',
  );
  const selected = chooseSeason(seasons);
  if (!selected?.id) throw new BsdUpstreamError('season', 200, 'season_not_found');
  return selected;
}

async function fetchItalianTeamIds(apiKey, fetchImpl) {
  const teams = await fetchAll('/teams/', { country_code: 'IT' }, apiKey, fetchImpl, 'teams');
  return new Set(teams.map(team => text(team?.id)).filter(Boolean));
}

function providerRevisionRank(match) {
  const value = Number(match?.sourceId);
  if (Number.isFinite(value)) return value;
  return Number.NEGATIVE_INFINITY;
}

export function dedupeCoppaSingleLegMatches(matches) {
  const rows = Array.isArray(matches) ? matches : [];
  const selected = new Map();
  const untouched = [];

  for (const match of rows) {
    const stageKey = text(match?.stageKey);
    const homeId = text(match?.homeTeam?.id);
    const awayId = text(match?.awayTeam?.id);
    if (!COPPA_SINGLE_LEG_STAGES.has(stageKey) || !homeId || !awayId) {
      untouched.push(match);
      continue;
    }

    const pair = [homeId, awayId].sort().join(':');
    const key = `${stageKey}:${pair}`;
    const previous = selected.get(key);
    if (!previous) {
      selected.set(key, match);
      continue;
    }

    const previousRank = providerRevisionRank(previous);
    const currentRank = providerRevisionRank(match);
    if (currentRank > previousRank) {
      selected.set(key, match);
      continue;
    }
    if (currentRank === previousRank) {
      const previousTime = Date.parse(previous?.kickoffAt || '') || 0;
      const currentTime = Date.parse(match?.kickoffAt || '') || 0;
      if (currentTime > previousTime) selected.set(key, match);
    }
  }

  return [...untouched, ...selected.values()];
}

export async function fetchBsdMatches({
  competition,
  from,
  to,
  apiKey,
  fetchImpl = fetch,
}) {
  const range = assertRange(from, to);
  const league = await resolveLeague(competition, apiKey, fetchImpl);
  const season = await resolveSeason(league.id, apiKey, fetchImpl);

  const [events, italianTeamIds] = await Promise.all([
    fetchAll('/events/', {
      league_id: league.id,
      season_id: season.id,
      date_from: range.from,
      date_to: range.to,
    }, apiKey, fetchImpl, 'events'),
    EUROPEAN.has(competition)
      ? fetchItalianTeamIds(apiKey, fetchImpl)
      : Promise.resolve(new Set()),
  ]);

  const matches = [];
  for (const event of events) {
    try {
      const match = normalizeBsdEvent(event, competition, { italianTeamIds });
      if (match) matches.push(match);
    } catch {
      // One malformed provider row must not break the tournament response.
    }
  }

  const filtered = competition === 'coppa_italia'
    ? dedupeCoppaSingleLegMatches(matches)
    : matches;

  return filtered.sort((a, b) => {
    const ta = Date.parse(a?.kickoffAt || '') || 0;
    const tb = Date.parse(b?.kickoffAt || '') || 0;
    return ta - tb || String(a?.matchId || '').localeCompare(String(b?.matchId || ''));
  });
}
