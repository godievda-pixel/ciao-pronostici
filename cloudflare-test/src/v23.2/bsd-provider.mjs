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

async function fetchJson(url, apiKey, fetchImpl) {
  const response = await fetchImpl(url, { headers: authHeaders(apiKey) });
  if (!response.ok) throw new Error(`BSD upstream failed: HTTP ${response.status}`);
  const type = text(response.headers.get('content-type')).toLowerCase();
  if (type && !type.includes('json')) throw new Error(`BSD upstream returned non-JSON content: ${type}`);
  try {
    return await response.json();
  } catch {
    throw new Error('BSD upstream returned invalid JSON');
  }
}

function buildUrl(path, params = {}) {
  const url = new URL(`${BSD_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url;
}

async function fetchAll(path, params, apiKey, fetchImpl) {
  const rows = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const url = buildUrl(path, { ...params, limit, offset });
    const payload = await fetchJson(url, apiKey, fetchImpl);
    const page = Array.isArray(payload?.results) ? payload.results : [];
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
  const leagues = await fetchAll('/leagues/', {}, apiKey, fetchImpl);
  const aliases = new Set(expected.map(normalizeName));
  const league = leagues.find(item => aliases.has(normalizeName(item?.name || item?.league_name)));
  if (!league?.id) throw new Error(`BSD league not found: ${competition}`);
  return league;
}

async function resolveSeason(leagueId, apiKey, fetchImpl) {
  return fetchJson(buildUrl(`/leagues/${encodeURIComponent(leagueId)}/season/`), apiKey, fetchImpl);
}

async function italianTeams(apiKey, fetchImpl) {
  const teams = await fetchAll('/teams/', {
    country_code: 'IT',
  }, apiKey, fetchImpl);
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
  if (!seasonId) throw new Error(`BSD current season not found: ${competition}`);

  const [events, italianTeamIds] = await Promise.all([
    fetchAll('/events/', {
      league_id: league.id,
      season_id: seasonId,
      date_from: range.from,
      date_to: range.to,
    }, apiKey, fetchImpl),
    EUROPEAN.has(competition)
      ? italianTeams(apiKey, fetchImpl)
      : Promise.resolve(new Set()),
  ]);

  return adaptBsdEvents({ results: events }, competition, { italianTeamIds });
}

export { BSD_BASE };
