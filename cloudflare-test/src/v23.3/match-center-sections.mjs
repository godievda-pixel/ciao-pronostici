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

const GOAL_KINDS = new Set(['open_play','penalty','own_goal','free_kick','unknown']);
const SHOT_OUTCOMES = new Set(['goal','saved','off_target','blocked','post','unknown']);
const SHOT_SITUATIONS = new Set(['open_play','set_piece','corner','free_kick','penalty','unknown']);

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

function enumValue(value, allowed, fallback = 'unknown') {
  const normalized = text(value).toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function canonicalCoordinate(value) {
  const number = finite(value);
  return number !== null && number >= 0 && number <= 100 ? number : null;
}

function canonicalFormToken(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const token = canonicalFormToken(item);
      if (token) return token;
    }
    return '';
  }
  if (value && typeof value === 'object') {
    const candidates = [value.result, value.outcome, value.code, value.value, value.status, value.form];
    for (const candidate of candidates) {
      const token = canonicalFormToken(candidate);
      if (token) return token;
    }
    return '';
  }
  const raw = text(value).toUpperCase();
  if (!raw || raw === '[OBJECT OBJECT]') return '';
  if (['W','WIN','WON','В','ПОБЕДА'].includes(raw)) return 'W';
  if (['D','DRAW','Н','НИЧЬЯ'].includes(raw)) return 'D';
  if (['L','LOSS','LOST','П','ПОРАЖЕНИЕ'].includes(raw)) return 'L';
  return '';
}

function frozenFormList(value) {
  return Object.freeze(list(value).map(canonicalFormToken).filter(Boolean));
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

function canonicalMomentumPoint(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const home = finite(value.home);
  const away = finite(value.away);
  if (home === null || away === null) return null;
  return Object.freeze({
    minute:finite(value.minute ?? value.m),
    home,
    away,
  });
}

function canonicalScoreAfter(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const home = finite(value.home ?? value.homeScore ?? value.home_score);
  const away = finite(value.away ?? value.awayScore ?? value.away_score);
  if (home === null && away === null) return null;
  return Object.freeze({ home, away });
}

function canonicalGoalSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const player = text(value.player ?? value.playerName ?? value.player_name);
  const minute = finite(value.minute);
  const addedTime = finite(value.addedTime ?? value.added_time);
  if (!player && minute === null) return null;
  return Object.freeze({
    player,
    minute,
    addedTime,
    kind:enumValue(value.kind ?? value.goalKind ?? value.goal_kind, GOAL_KINDS),
    scoreAfter:canonicalScoreAfter(value.scoreAfter ?? value.score_after ?? {
      home:value.homeScore ?? value.home_score,
      away:value.awayScore ?? value.away_score,
    }),
  });
}

function canonicalGoalSides(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.freeze({
    home:Object.freeze(list(source.home).map(canonicalGoalSummary).filter(Boolean)),
    away:Object.freeze(list(source.away).map(canonicalGoalSummary).filter(Boolean)),
  });
}

function canonicalEvent(value) {
  if (!value || typeof value !== 'object') return null;
  const type = text(value.type).toLowerCase();
  if (!type) return null;
  const sideValue = text(value.side).toLowerCase();
  const side = sideValue === 'away' ? 'away' : sideValue === 'home' ? 'home' : '';
  const goalKindRaw = value.goalKind ?? value.goal_kind;
  const cardKind = text(value.cardKind ?? value.card_kind).toLowerCase();
  const varDecision = text(value.varDecision ?? value.var_decision).toLowerCase();
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
    ...(goalKindRaw !== null && goalKindRaw !== undefined && text(goalKindRaw) ? { goalKind:enumValue(goalKindRaw, GOAL_KINDS) } : {}),
    ...(cardKind ? { cardKind } : {}),
    ...(varDecision ? { varDecision } : {}),
  });
}

function canonicalShot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rawX = canonicalCoordinate(value.x ?? value.position?.x ?? value.pos?.x);
  const rawY = canonicalCoordinate(value.y ?? value.position?.y ?? value.pos?.y);
  const coordinatesValid = rawX !== null && rawY !== null;
  const sideValue = text(value.side).toLowerCase();
  const side = sideValue === 'away' ? 'away' : sideValue === 'home' ? 'home' : '';
  return Object.freeze({
    side,
    x:coordinatesValid ? rawX : null,
    y:coordinatesValid ? rawY : null,
    minute:finite(value.minute),
    addedTime:finite(value.addedTime ?? value.added_time),
    player:text(value.player ?? value.playerName ?? value.player_name),
    assist:text(value.assist ?? value.assistName ?? value.assist_name),
    xg:finite(value.xg ?? value.expectedGoals ?? value.expected_goals),
    outcome:enumValue(value.outcome ?? value.result, SHOT_OUTCOMES),
    situation:enumValue(value.situation ?? value.playPattern ?? value.play_pattern, SHOT_SITUATIONS),
    bodyPart:text(value.bodyPart ?? value.body_part),
    goalKind:enumValue(value.goalKind ?? value.goal_kind, GOAL_KINDS),
  });
}

function canonicalLineupPlayer(value, starterFallback = null) {
  if (!value || typeof value !== 'object') return null;
  const playerId = finite(value.playerId ?? value.player_id ?? value.id);
  const name = text(value.name || value.shortName || value.short_name);
  if (playerId === null && !name) return null;
  const x = canonicalCoordinate(value.x ?? value.positionX ?? value.position_x);
  const y = canonicalCoordinate(value.y ?? value.positionY ?? value.position_y);
  const starter = typeof value.starter === 'boolean' ? value.starter : starterFallback === true;
  return Object.freeze({
    playerId,
    name,
    position:text(value.position || value.pos),
    shirtNumber:finite(value.shirtNumber ?? value.shirt_number ?? value.number),
    x,
    y,
    grid:text(value.grid ?? value.gridPosition ?? value.grid_position),
    starter,
  });
}

function canonicalLineupSide(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    formation:text(source.formation),
    starters:Object.freeze(list(source.starters || source.players).map(player => canonicalLineupPlayer(player, true)).filter(Boolean)),
    substitutes:Object.freeze(list(source.substitutes || source.bench).map(player => canonicalLineupPlayer(player, false)).filter(Boolean)),
    coach:text(source.coach ?? source.coachName ?? source.coach_name),
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
    goals:canonicalGoalSides(match?.goals),
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
      home:frozenFormList(form.home),
      away:frozenFormList(form.away),
    }),
    prediction:source.prediction || null,
    predictionSplit:source.predictionSplit ?? source.prediction_split ?? null,
    summaryStats:source.summaryStats ? canonicalStatsSection(source.summaryStats) : null,
    bestPlayer:source.bestPlayer ? canonicalPlayer(source.bestPlayer) : null,
    recentEvents:Object.freeze(list(source.recentEvents).map(canonicalEvent).filter(Boolean)),
    momentum:source.momentum ?? null,
    shotmap:source.shotmap ?? null,
  });
}

export function canonicalStatsSection(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return Object.freeze({
    home:canonicalStatSide(source.home),
    away:canonicalStatSide(source.away),
    shots:Object.freeze(list(source.shots).map(canonicalShot).filter(Boolean)),
    momentum:Object.freeze(list(source.momentum).map(canonicalMomentumPoint).filter(Boolean)),
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

export {
  COVERAGE_KEYS,
  STAT_KEYS,
  canonicalGoalSummary,
  canonicalGoalSides,
  canonicalShot,
  canonicalLineupPlayer,
};
