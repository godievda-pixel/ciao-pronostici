export const MATCH_CENTER_SECTIONS = Object.freeze([
  'overview',
  'stats',
  'events',
  'lineups',
  'players',
]);

const SECTION_SET = new Set(MATCH_CENTER_SECTIONS);

function textOrNull(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function numberOrNull(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function normalizeTeam(input = {}, fallback = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const legacy = fallback && typeof fallback === 'object' && !Array.isArray(fallback) ? fallback : {};
  return Object.freeze({
    id:textOrNull(source.id, source.teamId, source.team_id, legacy.id, legacy.teamId, legacy.team_id) || '',
    name:textOrNull(source.name, source.teamName, source.team_name, legacy.name, legacy.teamName, legacy.team_name) || '—',
    crestUrl:textOrNull(
      source.crestUrl,
      source.crest_url,
      source.logoUrl,
      source.logo_url,
      source.logo,
      source.crest,
      legacy.crestUrl,
      legacy.crest_url,
      legacy.logoUrl,
      legacy.logo_url,
      legacy.logo,
      legacy.crest,
    ) || '',
  });
}

export function normalizeCanonicalCoverage(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.freeze(Object.fromEntries(
    MATCH_CENTER_SECTIONS.map(section => [section, source[section] === true]),
  ));
}

function sourceTeam(input, side) {
  const camel = input?.[`${side}Team`];
  const snake = input?.[`${side}_team`];
  if (camel && typeof camel === 'object') return camel;
  if (snake && typeof snake === 'object') return snake;
  return {};
}

function fallbackTeam(input, side) {
  return {
    id:input?.[`${side}TeamId`] ?? input?.[`${side}_team_id`],
    name:input?.[`${side}TeamName`] ?? input?.[`${side}_team_name`],
    crestUrl:input?.[`${side}TeamCrestUrl`]
      ?? input?.[`${side}_team_crest_url`]
      ?? input?.[`${side}TeamLogoUrl`]
      ?? input?.[`${side}_team_logo_url`],
  };
}

export function normalizeCanonicalBase(input = {}, competition, matchId) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const score = source.score && typeof source.score === 'object' && !Array.isArray(source.score)
    ? source.score
    : {};
  const canonicalCompetition = textOrNull(competition, source.competition) || '';
  const canonicalMatchId = textOrNull(matchId, source.matchId, source.match_id, source.id) || '';

  return Object.freeze({
    competition:canonicalCompetition,
    matchId:canonicalMatchId,
    status:textOrNull(source.status) || 'scheduled',
    minute:numberOrNull(source.minute),
    kickoffAt:textOrNull(source.kickoffAt, source.kickoff_at, source.startAt, source.start_at),
    homeTeam:normalizeTeam(sourceTeam(source, 'home'), fallbackTeam(source, 'home')),
    awayTeam:normalizeTeam(sourceTeam(source, 'away'), fallbackTeam(source, 'away')),
    score:Object.freeze({
      home:numberOrNull(score.home, score.homeScore, score.home_score, source.homeScore, source.home_score),
      away:numberOrNull(score.away, score.awayScore, score.away_score, source.awayScore, source.away_score),
    }),
    venue:textOrNull(source.venue?.name, source.venue, source.venueName, source.venue_name),
    referee:textOrNull(source.referee?.name, source.referee, source.refereeName, source.referee_name),
    coverage:normalizeCanonicalCoverage(source.coverage),
    updatedAt:textOrNull(source.updatedAt, source.updated_at),
  });
}

export function normalizeCanonicalSection(section, input = {}) {
  const key = String(section || '').trim().toLowerCase();
  if (!SECTION_SET.has(key)) throw new Error('invalid_match_center_section');
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const hasData = Object.prototype.hasOwnProperty.call(source, 'data');
  const data = hasData ? source.data : null;
  return Object.freeze({
    section:key,
    available:source.available === undefined ? data !== null && data !== undefined : source.available === true,
    coverage:normalizeCanonicalCoverage(source.coverage),
    data,
  });
}

export function isCanonicalBase(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (typeof value.competition !== 'string' || !value.competition) return false;
  if (typeof value.matchId !== 'string' || !value.matchId) return false;
  if (!value.homeTeam || typeof value.homeTeam !== 'object') return false;
  if (!value.awayTeam || typeof value.awayTeam !== 'object') return false;
  if (!value.score || typeof value.score !== 'object') return false;
  if (!value.coverage || typeof value.coverage !== 'object') return false;
  return MATCH_CENTER_SECTIONS.every(section => typeof value.coverage[section] === 'boolean');
}
