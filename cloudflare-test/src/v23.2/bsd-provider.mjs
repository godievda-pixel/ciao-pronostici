import { adaptBsdEvents } from './bsd-adapter.mjs';
import { dedupeMatches } from './match-deduper.mjs';
import { normalizeStandingRows } from '../v23.3/standing-normalizer.mjs';
import { canonicalMatchCenterSnapshot } from '../v23.3/match-center-snapshot.mjs';
import {
  canonicalCoverage,
  canonicalMatchCenterBase,
} from '../v23.3/match-center-sections.mjs';
import { adaptBsdMatchCenterSections } from '../v23.3/bsd-match-center-adapter.mjs';

const BSD_BASE = 'https://sports.bzzoiro.com/api/v2';
const MAX_RANGE_DAYS = 370;
const LEAGUE_NAMES = Object.freeze({
  coppa_italia: ['Coppa Italia'],
  ucl: ['Champions League', 'UEFA Champions League'],
  uel: ['Europa League', 'UEFA Europa League'],
  uecl: ['Conference League', 'UEFA Conference League'],
});
const STANDINGS_COMPETITIONS = new Set(['ucl', 'uel', 'uecl']);
const MATCH_CENTER_SECTIONS = new Set(['overview', 'stats', 'events', 'lineups', 'players']);
const MATCH_CENTER_LAZY_CAPABILITIES = Object.freeze({
  overview:true,
  stats:true,
  events:true,
  lineups:true,
  players:true,
});
const MATCH_CENTER_RESOURCE = Object.freeze({
  stats:'stats',
  events:'incidents',
  lineups:'lineups',
  players:'player-stats',
});

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

function list(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function hasOwn(source, key) {
  return Boolean(source && Object.prototype.hasOwnProperty.call(source, key));
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
      // Keep diagnostics metadata-only.
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

async function resolveCompetitionContext(competition, apiKey, fetchImpl) {
  const league = await resolveLeague(competition, apiKey, fetchImpl);
  const season = await resolveSeason(league.id, apiKey, fetchImpl);
  if (!season?.id) throw new BsdUpstreamError('season', 200, 'season_not_found');
  return { league, season };
}

function canonicalSourceId(competition, matchId) {
  const canonical = text(matchId);
  const prefix = `${competition}:`;
  if (!canonical.startsWith(prefix)) {
    throw new Error(`Match competition mismatch: expected ${competition}`);
  }
  const sourceId = canonical.slice(prefix.length).trim();
  if (!sourceId) throw new Error('BSD match source id is required');
  return sourceId;
}

function eventLeagueId(event) {
  const league = event?.league;
  return text(
    (league && typeof league === 'object' ? league.id : league)
      || event?.league_id,
  );
}

function venueText(event = {}) {
  const venue = event?.venue;
  if (venue && typeof venue === 'object') return text(venue.name || venue.full_name);
  return text(venue || event?.venue_name);
}

export function extractBsdMatchDetails(event = {}) {
  return Object.freeze({
    venue:venueText(event),
    events:Object.freeze(list(event?.events || event?.match_events)),
    statistics:Object.freeze(list(event?.statistics || event?.stats)),
    lineups:Object.freeze(list(event?.lineups)),
  });
}

async function fetchBsdEvent({
  competition,
  matchId,
  apiKey,
  fetchImpl = fetch,
}) {
  const sourceId = canonicalSourceId(competition, matchId);
  const { league, season } = await resolveCompetitionContext(competition, apiKey, fetchImpl);
  let event = null;

  try {
    event = await fetchJson(
      buildUrl(`/events/${encodeURIComponent(sourceId)}/`),
      apiKey,
      fetchImpl,
      'event',
    );
  } catch (error) {
    if (!(error instanceof BsdUpstreamError) || error.status !== 404) throw error;
    const events = await fetchAll('/events/', {
      league_id: league.id,
      season_id: season.id,
    }, apiKey, fetchImpl, 'events');
    event = events.find(row => text(row?.id ?? row?.event_id) === sourceId) || null;
    if (!event) throw new BsdUpstreamError('event', 404, 'event_not_found');
  }

  const leagueId = eventLeagueId(event);
  if (leagueId && leagueId !== text(league.id)) {
    throw new BsdUpstreamError('event', 200, 'competition_mismatch');
  }

  return Object.freeze({ event, sourceId });
}

function canonicalBsdMatch(event, competition, sourceId) {
  const adapted = adaptBsdEvents({ results:[event] }, competition);
  const match = adapted[0];
  if (!match) {
    throw new BsdUpstreamError('event', 404, 'match_not_eligible');
  }
  if (match.matchId !== `${competition}:${sourceId}`) {
    throw new BsdUpstreamError('event', 200, 'invalid_event');
  }
  return match;
}

async function fetchCanonicalBsdEvent(args) {
  const { event, sourceId } = await fetchBsdEvent(args);
  const match = canonicalBsdMatch(event, args.competition, sourceId);
  return Object.freeze({ event, match, sourceId });
}

async function fetchOptionalEventResource({ sourceId, resource, apiKey, fetchImpl = fetch }) {
  try {
    return await fetchJson(
      buildUrl(`/events/${encodeURIComponent(sourceId)}/${resource}/`),
      apiKey,
      fetchImpl,
      `event_${resource.replaceAll('-', '_')}`,
    );
  } catch (error) {
    if (error instanceof BsdUpstreamError && error.status === 404) return null;
    throw error;
  }
}

function baseMatchCenterCoverage(event = {}) {
  const embedded = adaptBsdMatchCenterSections(event).coverage;
  return canonicalCoverage({
    ...embedded,
    ...MATCH_CENTER_LAZY_CAPABILITIES,
    momentum:embedded.momentum,
    shotmap:embedded.shotmap,
  });
}

function mergeSectionCoverage(baseCoverage, section, available, extra = {}) {
  return canonicalCoverage({
    ...baseCoverage,
    [section]:available === true,
    ...extra,
  });
}

function resourceSections(payload) {
  return adaptBsdMatchCenterSections(object(payload) || {});
}

function lineupPlayers(side) {
  return [...list(side?.starters), ...list(side?.substitutes)];
}

function enrichPlayersFromLineups(players, lineups, match) {
  const byId = new Map();
  for (const [side, teamName] of [
    ['home', match?.homeTeam?.name],
    ['away', match?.awayTeam?.name],
  ]) {
    for (const player of lineupPlayers(lineups?.[side])) {
      const id = text(player?.playerId ?? player?.player_id ?? player?.id);
      if (!id) continue;
      byId.set(id, {
        name:text(player?.name ?? player?.short_name ?? player?.shortName),
        teamName:text(teamName),
      });
    }
  }

  return Object.freeze(list(players).map(player => {
    const found = byId.get(text(player?.playerId ?? player?.player_id ?? player?.id));
    if (!found) return player;
    const name = text(player?.name) || found.name;
    const teamName = text(player?.teamName ?? player?.team_name) || found.teamName;
    if (name === text(player?.name) && teamName === text(player?.teamName ?? player?.team_name)) return player;
    return Object.freeze({ ...player, name, teamName });
  }));
}

function predictionPayload(payload) {
  const source = object(payload);
  if (!source) return null;
  if (object(source.prediction)) return source.prediction;
  if (
    hasOwn(source, 'home')
    || hasOwn(source, 'draw')
    || hasOwn(source, 'away')
    || hasOwn(source, 'markets')
    || hasOwn(source, 'probabilities')
    || hasOwn(source, 'confidence')
  ) return source;
  return null;
}

function composeOverviewEvent(event, statsPayload, modelPayload, incidentsPayload, playerStatsPayload) {
  const combined = { ...event };
  const stats = object(statsPayload);
  if (stats) {
    if (hasOwn(stats, 'stats')) combined.stats = stats.stats;
    if (hasOwn(stats, 'statistics')) combined.statistics = stats.statistics;
    if (hasOwn(stats, 'momentum')) combined.momentum = stats.momentum;
    if (hasOwn(stats, 'shotmap')) combined.shotmap = stats.shotmap;
    if (hasOwn(stats, 'shot_map')) combined.shot_map = stats.shot_map;
  }
  const prediction = predictionPayload(modelPayload);
  if (prediction) combined.prediction = prediction;

  if (Array.isArray(incidentsPayload)) combined.incidents = incidentsPayload;
  else if (object(incidentsPayload)) combined.incidents = incidentsPayload;

  if (Array.isArray(playerStatsPayload)) combined.player_stats = playerStatsPayload;
  else if (object(playerStatsPayload)) combined.player_stats = playerStatsPayload;

  return combined;
}

export async function fetchBsdMatches({
  competition,
  from,
  to,
  apiKey,
  fetchImpl = fetch,
}) {
  const range = assertRange(from, to);
  const { league, season } = await resolveCompetitionContext(competition, apiKey, fetchImpl);
  const events = await fetchAll('/events/', {
    league_id: league.id,
    season_id: season.id,
    date_from: range.from,
    date_to: range.to,
  }, apiKey, fetchImpl, 'events');

  return dedupeMatches(adaptBsdEvents({ results: events }, competition));
}

export async function fetchBsdStandings({
  competition,
  apiKey,
  fetchImpl = fetch,
}) {
  if (!STANDINGS_COMPETITIONS.has(competition)) {
    throw new Error(`BSD standings unsupported for competition: ${competition}`);
  }
  const { league, season } = await resolveCompetitionContext(competition, apiKey, fetchImpl);
  const payload = await fetchJson(
    buildUrl(`/leagues/${encodeURIComponent(league.id)}/standings/`, { season_id: season.id }),
    apiKey,
    fetchImpl,
    'standings',
  );
  return normalizeStandingRows(payload, competition);
}

export async function fetchBsdMatchSnapshot(args) {
  const { match } = await fetchCanonicalBsdEvent(args);
  return match;
}

export async function fetchBsdMatchCenterBase(args) {
  const { event, match } = await fetchCanonicalBsdEvent(args);
  return canonicalMatchCenterBase(match, baseMatchCenterCoverage(event));
}

export async function fetchBsdMatchCenterSection(args) {
  const section = text(args?.section).toLowerCase();
  if (!MATCH_CENTER_SECTIONS.has(section)) {
    throw new Error(`Unsupported Match Center section: ${section || 'empty'}`);
  }

  const { event, match, sourceId } = await fetchCanonicalBsdEvent(args);
  const baseSections = adaptBsdMatchCenterSections(event);
  const baseCoverage = baseMatchCenterCoverage(event);

  if (section === 'overview') {
    const [statsPayload, modelPayload, incidentsPayload, playerStatsPayload] = await Promise.all([
      fetchOptionalEventResource({
        sourceId,
        resource:'stats',
        apiKey:args.apiKey,
        fetchImpl:args.fetchImpl,
      }),
      fetchOptionalEventResource({
        sourceId,
        resource:'prediction',
        apiKey:args.apiKey,
        fetchImpl:args.fetchImpl,
      }),
      fetchOptionalEventResource({
        sourceId,
        resource:'incidents',
        apiKey:args.apiKey,
        fetchImpl:args.fetchImpl,
      }),
      fetchOptionalEventResource({
        sourceId,
        resource:'player-stats',
        apiKey:args.apiKey,
        fetchImpl:args.fetchImpl,
      }),
    ]);
    const combined = composeOverviewEvent(event, statsPayload, modelPayload, incidentsPayload, playerStatsPayload);
    const sections = adaptBsdMatchCenterSections(combined);
    const available = sections.coverage.overview === true;
    return Object.freeze({
      section,
      available,
      coverage:mergeSectionCoverage(baseCoverage, section, available, {
        momentum:sections.coverage.momentum,
        shotmap:sections.coverage.shotmap,
      }),
      data:available ? sections.overview : null,
    });
  }

  if (section === 'players') {
    const [payload, lineupPayload] = await Promise.all([
      fetchOptionalEventResource({
        sourceId,
        resource:'player-stats',
        apiKey:args.apiKey,
        fetchImpl:args.fetchImpl,
      }),
      fetchOptionalEventResource({
        sourceId,
        resource:'lineups',
        apiKey:args.apiKey,
        fetchImpl:args.fetchImpl,
      }).catch(() => null),
    ]);
    const fetchedSections = resourceSections(payload);
    const fetchedAvailable = fetchedSections.coverage.players === true;
    const fallbackAvailable = payload === null && baseSections.coverage.players === true;
    const available = fetchedAvailable || fallbackAvailable;
    const rawData = fetchedAvailable
      ? fetchedSections.players
      : fallbackAvailable
        ? baseSections.players
        : null;
    const fetchedLineups = resourceSections(lineupPayload);
    const lineups = fetchedLineups.coverage.lineups
      ? fetchedLineups.lineups
      : baseSections.coverage.lineups
        ? baseSections.lineups
        : null;
    const data = available ? enrichPlayersFromLineups(rawData, lineups, match) : null;

    return Object.freeze({
      section,
      available,
      coverage:mergeSectionCoverage(baseCoverage, section, available),
      data,
    });
  }

  const resource = MATCH_CENTER_RESOURCE[section];
  const payload = await fetchOptionalEventResource({
    sourceId,
    resource,
    apiKey:args.apiKey,
    fetchImpl:args.fetchImpl,
  });
  const fetchedSections = resourceSections(payload);
  const fetchedAvailable = fetchedSections.coverage[section] === true;
  const fallbackAvailable = payload === null && baseSections.coverage[section] === true;
  const available = fetchedAvailable || fallbackAvailable;
  const data = fetchedAvailable
    ? fetchedSections[section]
    : fallbackAvailable
      ? baseSections[section]
      : null;

  return Object.freeze({
    section,
    available,
    coverage:mergeSectionCoverage(baseCoverage, section, available),
    data,
  });
}

export async function fetchBsdMatchCenterSnapshot(args) {
  const { event, match } = await fetchCanonicalBsdEvent(args);
  return canonicalMatchCenterSnapshot(match, extractBsdMatchDetails(event));
}

export { BSD_BASE };
