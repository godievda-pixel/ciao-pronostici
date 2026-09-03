import { normalizeStandingRows } from './standing-normalizer.mjs';
import { normalizeTeamAlias, russianTeamName } from '../v23.2/team-registry.mjs';

const BSD_BASE = 'https://sports.bzzoiro.com/api/v2';
const CACHE_TTL_MS = 15 * 60 * 1000;
let cache = { apiKey:'', at:0, registry:null };

function text(value) { return String(value ?? '').trim(); }
function canonicalTeamName(value) {
  const raw = text(value);
  return raw ? normalizeTeamAlias(russianTeamName(raw)) : '';
}
function headers(apiKey) {
  return { accept:'application/json', authorization:`Token ${text(apiKey)}`, 'cache-control':'no-cache' };
}
async function json(url, apiKey, fetchImpl) {
  const response = await fetchImpl(url, { headers:headers(apiKey) });
  if (!response.ok) throw new Error(`serie_a_crest_upstream_${response.status}`);
  return response.json();
}
function rows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}
async function all(path, params, apiKey, fetchImpl) {
  const output = [];
  let offset = 0;
  const limit = 200;
  while (true) {
    const url = new URL(`${BSD_BASE}${path}`);
    for (const [key, value] of Object.entries({ ...params, limit, offset })) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const payload = await json(url, apiKey, fetchImpl);
    const page = rows(payload);
    output.push(...page);
    const count = Number(payload?.count);
    if (!page.length || page.length < limit || (Number.isFinite(count) && output.length >= count)) break;
    offset += page.length;
  }
  return output;
}
function leagueName(value) {
  return text(value).toLowerCase().replace(/^lega\s+/, '').replace(/\s+/g, ' ');
}
async function resolveSerieALeague(apiKey, fetchImpl) {
  const leagues = await all('/leagues/', {}, apiKey, fetchImpl);
  const aliases = new Set(['serie a','serie a tim','campionato serie a']);
  const league = leagues.find(item => aliases.has(leagueName(item?.name || item?.league_name)));
  if (!league?.id) throw new Error('serie_a_league_not_found');
  return league;
}
function seasonCandidate(payload) {
  const list = [payload,payload?.season,payload?.current_season,payload?.currentSeason,payload?.data,payload?.data?.season,payload?.data?.current_season,payload?.data?.currentSeason];
  return list.find(item => item && typeof item === 'object' && item.id) || null;
}
async function resolveSeason(leagueId, apiKey, fetchImpl) {
  const direct = await json(new URL(`${BSD_BASE}/leagues/${encodeURIComponent(leagueId)}/season/`), apiKey, fetchImpl);
  const candidate = seasonCandidate(direct);
  if (candidate?.id) return candidate;
  const seasons = await all(`/leagues/${encodeURIComponent(leagueId)}/seasons/`, {}, apiKey, fetchImpl);
  const current = seasons.find(item => item?.is_current === true || item?.current === true || item?.isCurrent === true);
  const fallback = current || [...seasons].filter(item => item?.id).sort((a,b) => Number(b?.year || 0) - Number(a?.year || 0) || Number(b?.id || 0) - Number(a?.id || 0))[0];
  if (!fallback?.id) throw new Error('serie_a_season_not_found');
  return fallback;
}

export function buildSerieACrestRegistry(standingRows = []) {
  const registry = new Map();
  for (const row of Array.isArray(standingRows) ? standingRows : []) {
    const team = row?.team || {};
    const crest = text(team?.crestUrl || team?.logo_url || team?.logoUrl || team?.logo || team?.crest_url);
    if (!crest) continue;
    const id = text(team?.id);
    const names = [team?.name, team?.rawName].map(canonicalTeamName).filter(Boolean);
    if (id) registry.set(`id:${id}`, crest);
    for (const name of names) registry.set(`name:${name}`, crest);
  }
  return registry;
}

export async function fetchSerieACrestRegistry({ apiKey, fetchImpl = fetch, now = Date.now() } = {}) {
  const key = text(apiKey);
  if (!key) return new Map();
  if (cache.registry && cache.apiKey === key && Number(now) - cache.at < CACHE_TTL_MS) return cache.registry;
  const league = await resolveSerieALeague(key, fetchImpl);
  const season = await resolveSeason(league.id, key, fetchImpl);
  const url = new URL(`${BSD_BASE}/leagues/${encodeURIComponent(league.id)}/standings/`);
  url.searchParams.set('season_id', String(season.id));
  const payload = await json(url, key, fetchImpl);
  const registry = buildSerieACrestRegistry(normalizeStandingRows(payload, 'serie_a'));
  cache = { apiKey:key, at:Number(now), registry };
  return registry;
}

function registryCrest(registry, team = {}) {
  if (!(registry instanceof Map)) return '';
  const id = text(team?.id);
  const names = [team?.name, team?.rawName].map(canonicalTeamName).filter(Boolean);
  return (id && registry.get(`id:${id}`)) || names.map(name => registry.get(`name:${name}`)).find(Boolean) || '';
}

export function enrichSerieAMatchesWithCrests(matches = [], registry = new Map()) {
  return (Array.isArray(matches) ? matches : []).map(match => {
    const home = match?.homeTeam || {};
    const away = match?.awayTeam || {};
    const homeCrest = text(home?.crestUrl) || registryCrest(registry, home);
    const awayCrest = text(away?.crestUrl) || registryCrest(registry, away);
    return Object.freeze({
      ...match,
      homeTeam:Object.freeze({ ...home, crestUrl:homeCrest }),
      awayTeam:Object.freeze({ ...away, crestUrl:awayCrest }),
    });
  });
}

export function enrichSerieAStandingsWithCrests(standings = {}, registry = new Map()) {
  return {
    ...standings,
    rows:(Array.isArray(standings?.rows) ? standings.rows : []).map(row => {
      const team = row?.team || {};
      const crestUrl = text(team?.crestUrl) || registryCrest(registry, team);
      return crestUrl ? { ...row, team:{ ...team, crestUrl } } : row;
    }),
  };
}
