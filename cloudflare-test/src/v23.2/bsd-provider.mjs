import { adaptBsdEvents } from './bsd-adapter.mjs';

const BSD_BASE = 'https://sports.bzzoiro.com/api/v2';
const MAX_RANGE_DAYS = 370;
const LEAGUE_NAMES = Object.freeze({
  coppa_italia: ['Coppa Italia'],
  ucl: ['Champions League', 'UEFA Champions League'],
  uel: ['Europa League', 'UEFA Europa League'],
  uecl: ['Conference League', 'UEFA Conference League'],
});
const EUROPEAN = new Set(['ucl', 'uel', 'uecl']);

export class BsdUpstreamError extends Error {
  constructor(stage, status, code = 'upstream_failed') {
    super(`BSD ${stage} failed: HTTP ${status}`);
    this.name = 'BsdUpstreamError';
    this.stage = String(stage || 'unknown');
    this.status = Number.isFinite(Number(status)) ? Number(status) : null;
    this.code = String(code || 'upstream_failed');
  }
}

function text(value) {
  return String(value ?? '').trim();
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

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // The response body is intentionally not surfaced; diagnostics stay metadata-only.
    }
    throw new BsdUpstreamError(stage, response.status, upstreamCode(payload, `http_${response.status}`));
  }

  const type = text(response.headers.get('content-type')).toLowerCase();
  if (type && !type.includes('json')) {
    throw new BsdUpstreamError(stage, response.status, 'non_json_response');
  }
  try {
    return await response.json();
  } catch {
    throw new BsdUpstreamError(stage, response.status, 'invalid_json');
  }
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

async function fetchAll(path, params, apiKey, fetchImpl, stage) {
  const rows = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const url = buildUrl(path, { ...params, limit, offset });
    const payload = await fetchJson(url, apiKey, fetchImpl, stage);
    const page = pageRows(payload);
    rows.push(...page);
    const count = Number(payload?.count);
    if (page.length < limit || (Number.isFinite(count) && rows.length >= count)) break;
    offset += page.length;
    if (!page.length) break;
  }
  return rows;
}

function normalizeName(value) {
  return text(value).toLowerCase().replace(/^uefa\s+/, '').replace(/\s+/g, ' ');
}

async function resolveLeague(competition, apiKey, fetchImpl) {
  const expected = LEAGUE_NAMES[competition];
  if (!expected) throw new Error(`Unsupported BSD competition: ${competition}`);
  const leagues = await fetchAll('/leagues/', {}, apiKey, fetchImpl, 'leagues');
  const aliases = new Set(expected.map(normalizeName));
  const league = leagues.find(item => aliases.has(normalizeName(item?.name || item?.league_name)));
  if (!league?.id) throw new BsdUpstreamError('leagues', 200, 'league_not_found');
  return league;
}

function seasonCandidate(payload) {
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
  const direct = seasonCandidate(payload);
  if (direct?.id) return direct;

  const seasons = await fetchAll(
    `/leagues/${encodeURIComponent(leagueId)}/seasons/`,
    {},
    apiKey,
    fetchImpl,
    'season',
  );
  const fallback = chooseSeason(seasons);
  if (!fallback?.id) throw new BsdUpstreamError('season', 200, 'season_not_found');
  return fallback;
}

async function italianTeams(apiKey, fetchImpl) {
  const teams = await fetchAll('/teams/', {
    country_code: 'IT',
  }, apiKey, fetchImpl, 'teams');
  return new Set(teams.map(team => text(team?.id)).filter(Boolean));
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
  const seasonId = season?.id;
  if (!seasonId) throw new BsdUpstreamError('season', 200, 'season_not_found');

  const [events, italianTeamIds] = await Promise.all([
    fetchAll('/events/', {
      league_id: league.id,
      season_id: seasonId,
      date_from: range.from,
      date_to: range.to,
    }, apiKey, fetchImpl, 'events'),
    EUROPEAN.has(competition)
      ? italianTeams(apiKey, fetchImpl)
      : Promise.resolve(new Set()),
  ]);

  return adaptBsdEvents({ results: events }, competition, { italianTeamIds });
}

export { BSD_BASE };
