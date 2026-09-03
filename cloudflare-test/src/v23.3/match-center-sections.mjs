const COVERAGE_KEYS = Object.freeze([
  'overview',
  'stats',
  'events',
  'lineups',
  'players',
  'momentum',
  'shotmap',
]);

const STAT_KEYS = Object.freeze([
  'xg',
  'possession',
  'shots',
  'shotsOnTarget',
  'bigChances',
  'corners',
  'fouls',
  'offsides',
  'yellowCards',
  'redCards',
  'saves',
  'passAccuracy',
  'interceptions',
  'tackles',
]);

function text(value) {
  return String(value ?? '').trim();
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function frozenTextList(value) {
  return Object.freeze(list(value).map(text).filter(Boolean));
}

function canonicalVenue(value) {
  const venue = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    name:text(venue.name),
    city:text(venue.city),
    capacity:finite(venue.capacity),
  });
}

function canonicalReferee(value) {
  if (!value || typeof value !== 'object') return null;
  const name = text(value.name || value.fullName || value.full_name);
  if (!name) return null;
  return Object.freeze({ name });
}

function canonicalStatSide(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze(Object.fromEntries(
    STAT_KEYS.map(key => [key, finite(source[key])]),
  ));
}

function canonicalEvent(value) {
  if (!value || typeof value !== 'object') return null;
  const type = text(value.type).toLowerCase();
  if (!type) return null;
  const sideValue = text(value.side).toLowerCase();
  const side = sideValue === 'away' ? 'away' : sideValue === 'home' ? 'home' : '';
  return Object.freeze({
    type,
    minute:finite(value.minute),
    addedTime:finite(value.addedTime ?? value.added_time),
    side,
    player:text(value.player),
    assist:text(value.assist),
    reason:text(value.reason),
    playerIn:text(value.playerIn ?? value.player_in),
    playerOut:text(value.playerOut ?? value.player_out),
    homeScore:finite(value.homeScore ?? value.home_score),
    awayScore:finite(value.awayScore ?? value.away_score),
    text:text(value.text),
  });
}

function canonicalLineupPlayer(value) {
  if (!value || typeof value !== 'object') return null;
  const playerId = finite(value.playerId ?? value.player_id ?? value.id);
  const name = text(value.name || value.shortName || value.short_name);
  if (playerId === null && !name) return null;
  return Object.freeze({
    playerId,
    name,
    position:text(value.position || value.pos),
    shirtNumber:finite(value.shirtNumber ?? value.shirt_number ?? value.number),
  });
}

function canonicalLineupSide(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    formation:text(source.formation),
    starters:Object.freeze(list(source.starters || source.players).map(canonicalLineupPlayer).filter(Boolean)),
    substitutes:Object.freeze(list(source.substitutes || source.bench).map(canonicalLineupPlayer).filter(Boolean)),
  });
}

function canonicalPlayer(value) {
  if (!value || typeof value !== 'object') return null;
  const playerId = finite(value.playerId ?? value.player_id ?? value.id);
  const name = text(value.name || value.shortName || value.short_name);
  if (playerId === null && !name) return null;
  return Object.freeze({
    playerId,
    name,
    teamId:finite(value.teamId ?? value.team_id),
    teamName:text(value.teamName ?? value.team_name),
    rating:finite(value.rating),
    goals:finite(value.goals),
    assists:finite(value.assists ?? value.goal_assist),
    xg:finite(value.xg ?? value.expected_goals),
    xa:finite(value.xa ?? value.expected_assists),
    shots:finite(value.shots ?? value.total_shots),
    keyPasses:finite(value.keyPasses ?? value.key_pass),
    minutes:finite(value.minutes ?? value.minutes_played),
  });
}

export function canonicalCoverage(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return Object.freeze(Object.fromEntries(
    COVERAGE_KEYS.map(key => [key, source[key] === true]),
  ));
}

export function canonicalMatchCenterBase(match = {}, coverage = {}) {
  return Object.freeze({
    competition:text(match?.competition),
    matchId:text(match?.matchId),
    homeTeam:match?.homeTeam || null,
    awayTeam:match?.awayTeam || null,
    kickoffAt:text(match?.kickoffAt),
    status:text(match?.status),
    minute:match?.minute ?? null,
    homeScore:match?.homeScore ?? null,
    awayScore:match?.awayScore ?? null,
    round:match?.round ?? null,
    stage:text(match?.stage),
    predictionDeadline:text(match?.predictionDeadline),
    coverage:canonicalCoverage(coverage),
  });
}

export function canonicalOverviewSection(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const form = source.form && typeof source.form === 'object' ? source.form : {};
  return Object.freeze({
    venue:canonicalVenue(source.venue),
    referee:canonicalReferee(source.referee),
    form:Object.freeze({
      home:frozenTextList(form.home),
      away:frozenTextList(form.away),
    }),
    prediction:source.prediction || null,
    predictionSplit:source.predictionSplit ?? source.prediction_split ?? null,
    momentum:source.momentum ?? null,
    shotmap:source.shotmap ?? null,
  });
}

export function canonicalStatsSection(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return Object.freeze({
    home:canonicalStatSide(source.home),
    away:canonicalStatSide(source.away),
  });
}

export function canonicalEventsSection(input = []) {
  return Object.freeze(list(input).map(canonicalEvent).filter(Boolean));
}

export function canonicalLineupsSection(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return Object.freeze({
    home:canonicalLineupSide(source.home),
    away:canonicalLineupSide(source.away),
  });
}

export function canonicalPlayersSection(input = []) {
  return Object.freeze(list(input).map(canonicalPlayer).filter(Boolean));
}

export { COVERAGE_KEYS, STAT_KEYS };
