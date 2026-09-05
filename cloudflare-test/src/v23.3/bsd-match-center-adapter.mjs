import {
  canonicalCoverage,
  canonicalOverviewSection,
  canonicalStatsSection,
  canonicalEventsSection,
  canonicalLineupsSection,
  canonicalPlayersSection,
} from './match-center-sections.mjs';

function list(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function hasOwn(source, key) {
  return Boolean(source && Object.prototype.hasOwnProperty.call(source, key));
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value) {
  return String(value ?? '').trim();
}

function firstObject(...values) {
  return values.map(object).find(Boolean) || null;
}

function firstArraySource(...values) {
  return values.find(value => Array.isArray(value));
}

function firstPresent(source, keys) {
  for (const key of keys) {
    if (hasOwn(source, key)) return source[key];
  }
  return undefined;
}

function nestedName(value) {
  const source = object(value);
  return source ? text(source.name ?? source.short_name ?? source.shortName) : text(value);
}

function numericStat(source, aliases) {
  if (!source || typeof source !== 'object') return null;
  for (const key of aliases) {
    if (!hasOwn(source, key)) continue;
    const value = source[key];
    if (value && typeof value === 'object' && hasOwn(value, 'actual')) return value.actual;
    return value;
  }
  return null;
}

function canonicalStatInput(source = {}) {
  return {
    xg:numericStat(source, ['xg','expected_goals']),
    possession:numericStat(source, ['possession','ball_possession']),
    shots:numericStat(source, ['shots','total_shots']),
    shotsOnTarget:numericStat(source, ['shotsOnTarget','shots_on_target']),
    bigChances:numericStat(source, ['bigChances','big_chances']),
    corners:numericStat(source, ['corners','corner_kicks']),
    fouls:numericStat(source, ['fouls']),
    offsides:numericStat(source, ['offsides']),
    yellowCards:numericStat(source, ['yellowCards','yellow_cards']),
    redCards:numericStat(source, ['redCards','red_cards']),
    saves:numericStat(source, ['saves','goalkeeper_saves']),
    passAccuracy:numericStat(source, ['passAccuracy','pass_accuracy','pass_accuracy_pct']),
    interceptions:numericStat(source, ['interceptions']),
    tackles:numericStat(source, ['tackles','total_tackles']),
  };
}

function statsSource(event = {}) {
  const raw = firstObject(event.statistics, event.stats);
  if (!raw) return null;
  const nested = firstObject(raw.stats);
  return nested || raw;
}

function incidentsSource(event = {}) {
  if (Array.isArray(event?.incidents?.incidents)) return event.incidents.incidents;
  if (Array.isArray(event?.incidents)) return event.incidents;
  return firstArraySource(event.events, event.match_events);
}

function lineupsSource(event = {}) {
  const raw = firstObject(event.lineups);
  if (!raw) return null;
  return firstObject(raw.lineups) || raw;
}

function playerStatsSource(event = {}) {
  if (Array.isArray(event?.player_stats?.player_stats)) return event.player_stats.player_stats;
  return firstArraySource(event.player_stats, event.players_stats);
}

function shotSource(event = {}) {
  const statsEnvelope = firstObject(event.statistics, event.stats) || {};
  const overview = object(event.overview_meta) || {};
  return firstArraySource(
    event.shots,
    event.shotmap,
    event.shot_map,
    statsEnvelope.shots,
    statsEnvelope.shotmap,
    statsEnvelope.shot_map,
    overview.shots,
    overview.shotmap,
    overview.shot_map,
  );
}

function normalizeMomentum(value) {
  return list(value).map(point => {
    if (!point || typeof point !== 'object') return null;
    const minute = finite(point.minute ?? point.m);
    const home = finite(point.home);
    const away = finite(point.away);
    if (home !== null && away !== null) return point;

    const signed = finite(point.v);
    if (signed === null) return null;
    const homeShare = Math.max(0, Math.min(100, 50 + signed / 2));
    return Object.freeze({
      minute,
      home:homeShare,
      away:100 - homeShare,
    });
  }).filter(Boolean);
}

function normalizeShotmap(value) {
  return list(value).map(shot => {
    if (!shot || typeof shot !== 'object') return null;
    const position = object(shot.pos);
    const x = finite(shot.x ?? position?.x);
    const y = finite(shot.y ?? position?.y);
    if (x === null || y === null) return null;

    if (!position) return shot;

    const explicitSide = String(shot.side ?? '').trim().toLowerCase();
    const side = explicitSide === 'away'
      ? 'away'
      : explicitSide === 'home'
        ? 'home'
        : shot.home === false || shot.is_home === false
          ? 'away'
          : 'home';
    return Object.freeze({
      side,
      x,
      y,
      xg:finite(shot.xg),
    });
  }).filter(Boolean);
}

function normalizeGoalKind(event = {}) {
  const explicit = text(event.goalKind ?? event.goal_kind ?? event.goal_type).toLowerCase();
  if (explicit) return explicit;
  if (event.own_goal === true || event.is_own_goal === true) return 'own_goal';
  if (event.penalty === true || event.is_penalty === true) return 'penalty';
  if (event.free_kick === true || event.is_free_kick === true) return 'free_kick';
  return '';
}

function shotSide(shot = {}) {
  const explicit = text(shot.side).toLowerCase();
  if (explicit === 'home' || explicit === 'away') return explicit;
  return shot.home === false || shot.is_home === false ? 'away' : 'home';
}

function normalizeDetailedShot(shot = {}) {
  const position = firstObject(shot.position, shot.pos) || {};
  return {
    side:shotSide(shot),
    x:shot.x ?? position.x,
    y:shot.y ?? position.y,
    minute:shot.minute ?? shot.min,
    addedTime:shot.addedTime ?? shot.added_time,
    player:nestedName(shot.player ?? shot.player_name),
    assist:nestedName(shot.assist ?? shot.assist_name),
    xg:shot.xg ?? shot.expected_goals,
    outcome:shot.outcome ?? shot.result ?? shot.type,
    situation:shot.situation ?? shot.playPattern ?? shot.play_pattern,
    bodyPart:shot.bodyPart ?? shot.body_part,
    goalKind:normalizeGoalKind(shot),
  };
}

function predictionSplitFromModel(prediction) {
  const result = firstObject(
    prediction?.markets?.match_result,
    prediction?.markets?.matchResult,
    prediction?.match_result,
    prediction?.matchResult,
  );
  if (!result) return null;

  const home = finite(result.prob_home ?? result.probHome);
  const draw = finite(result.prob_draw ?? result.probDraw);
  const away = finite(result.prob_away ?? result.probAway);
  if (home === null && draw === null && away === null) return null;
  return Object.freeze({ home, draw, away });
}

function canonicalEventInput(event = {}) {
  const goalKind = normalizeGoalKind(event);
  const cardKind = text(event.cardKind ?? event.card_kind ?? event.card_type).toLowerCase();
  const varDecision = text(event.varDecision ?? event.var_decision ?? event.var_result).toLowerCase();
  return {
    type:event.type,
    minute:event.minute,
    addedTime:event.addedTime ?? event.added_time,
    side:event.side || (event.is_home === true ? 'home' : event.is_home === false ? 'away' : ''),
    player:nestedName(event.player ?? event.player_name),
    assist:nestedName(event.assist ?? event.assist_name),
    reason:event.reason,
    playerIn:nestedName(event.playerIn ?? event.player_in),
    playerOut:nestedName(event.playerOut ?? event.player_out),
    homeScore:event.homeScore ?? event.home_score,
    awayScore:event.awayScore ?? event.away_score,
    text:event.text,
    ...(goalKind ? { goalKind } : {}),
    ...(cardKind ? { cardKind } : {}),
    ...(varDecision ? { varDecision } : {}),
  };
}

function lineupPlayerInput(player = {}) {
  return {
    playerId:player.playerId ?? player.player_id ?? player.id,
    name:nestedName(player.name || player.short_name || player.shortName),
    position:player.position || player.pos,
    shirtNumber:player.shirtNumber ?? player.shirt_number ?? player.number,
    x:player.x ?? player.position_x ?? player.coordinates?.x,
    y:player.y ?? player.position_y ?? player.coordinates?.y,
    grid:player.grid ?? player.grid_position ?? player.formation_position,
    starter:typeof player.starter === 'boolean' ? player.starter : undefined,
  };
}

function lineupSideInput(side = {}) {
  return {
    formation:side.formation,
    starters:list(side.starters || side.players).map(lineupPlayerInput),
    substitutes:list(side.substitutes || side.bench).map(lineupPlayerInput),
    coach:nestedName(side.coach ?? side.coach_name),
  };
}

function playerInput(player = {}) {
  return {
    playerId:player.playerId ?? player.player_id ?? player.id,
    name:player.name || player.short_name || player.shortName,
    teamId:player.teamId ?? player.team_id,
    teamName:player.teamName ?? player.team_name,
    rating:player.rating,
    goals:player.goals,
    assists:player.assists ?? player.goal_assist,
    xg:player.xg ?? player.expected_goals,
    xa:player.xa ?? player.expected_assists,
    shots:player.shots ?? player.total_shots,
    keyPasses:player.keyPasses ?? player.key_pass,
    minutes:player.minutes ?? player.minutes_played,
  };
}

function eventClockValue(event = {}) {
  const minute = finite(event.minute) ?? -1;
  const addedTime = finite(event.addedTime ?? event.added_time) ?? 0;
  return minute * 100 + addedTime;
}

function bestRatedPlayer(value) {
  const players = canonicalPlayersSection(list(value).map(playerInput));
  let best = null;
  for (const player of players) {
    const rating = finite(player?.rating);
    if (rating === null) continue;
    if (!best || rating > finite(best.rating)) best = player;
  }
  return best;
}

function recentOverviewEvents(value) {
  const important = new Set(['goal','yellow','yellow_card','red','red_card','card','sub','substitution','var']);
  return canonicalEventsSection(list(value).map(canonicalEventInput))
    .filter(event => important.has(text(event?.type).toLowerCase()))
    .sort((a, b) => eventClockValue(a) - eventClockValue(b))
    .slice(-4);
}

function overviewInput(event = {}) {
  const overviewMeta = object(event.overview_meta) || {};
  const venue = firstObject(event.venue, overviewMeta.venue) || {};
  const referee = firstObject(event.referee, event.main_referee, overviewMeta.referee);
  const form = firstObject(event.form, overviewMeta.form) || {};
  const rawStats = statsSource(event);
  const rawEvents = incidentsSource(event);
  const rawPlayers = playerStatsSource(event);
  const rawMomentum = firstPresent(event, ['momentum']) ?? overviewMeta.momentum ?? null;
  const rawShotmap = firstPresent(event, ['shotmap','shot_map'])
    ?? overviewMeta.shotmap
    ?? overviewMeta.shot_map
    ?? null;
  const prediction = firstObject(event.prediction, overviewMeta.prediction);
  const explicitPredictionSplit = firstPresent(event, ['prediction_split','predictionSplit'])
    ?? firstPresent(overviewMeta, ['prediction_split','predictionSplit'])
    ?? null;
  return {
    venue,
    referee,
    form,
    prediction,
    predictionSplit:explicitPredictionSplit ?? predictionSplitFromModel(prediction),
    summaryStats:rawStats ? {
      home:canonicalStatInput(rawStats.home),
      away:canonicalStatInput(rawStats.away),
    } : null,
    bestPlayer:bestRatedPlayer(rawPlayers),
    recentEvents:recentOverviewEvents(rawEvents),
    momentum:normalizeMomentum(rawMomentum),
    shotmap:normalizeShotmap(rawShotmap),
  };
}

function hasOverview(event = {}) {
  return Boolean(
    object(event.venue)
    || object(event.referee)
    || object(event.main_referee)
    || object(event.form)
    || object(event.overview_meta)
    || object(event.prediction)
    || hasOwn(event, 'prediction_split')
    || hasOwn(event, 'predictionSplit')
    || statsSource(event)
    || incidentsSource(event) !== undefined
    || playerStatsSource(event) !== undefined
    || hasOwn(event, 'momentum')
    || hasOwn(event, 'shotmap')
    || hasOwn(event, 'shot_map')
  );
}

export function extractBsdCoverage(event = {}) {
  const overviewMeta = object(event.overview_meta) || {};
  const momentum = hasOwn(event, 'momentum') || hasOwn(overviewMeta, 'momentum');
  const shotmap = hasOwn(event, 'shotmap')
    || hasOwn(event, 'shot_map')
    || hasOwn(overviewMeta, 'shotmap')
    || hasOwn(overviewMeta, 'shot_map');
  const shots = shotSource(event);
  return canonicalCoverage({
    overview:hasOverview(event),
    stats:Boolean(statsSource(event) || shots !== undefined),
    events:incidentsSource(event) !== undefined,
    lineups:Boolean(lineupsSource(event)),
    players:playerStatsSource(event) !== undefined,
    momentum,
    shotmap,
  });
}

export function adaptBsdMatchCenterSections(event = {}) {
  const coverage = extractBsdCoverage(event);
  const rawStats = statsSource(event);
  const rawShots = shotSource(event);
  const rawEvents = incidentsSource(event);
  const rawLineups = lineupsSource(event);
  const rawPlayers = playerStatsSource(event);
  const overviewMeta = object(event.overview_meta) || {};
  const rawMomentum = firstPresent(event, ['momentum']) ?? overviewMeta.momentum ?? null;
  return Object.freeze({
    coverage,
    overview:coverage.overview ? canonicalOverviewSection(overviewInput(event)) : null,
    stats:coverage.stats ? canonicalStatsSection({
      home:canonicalStatInput(rawStats?.home),
      away:canonicalStatInput(rawStats?.away),
      shots:list(rawShots).map(normalizeDetailedShot),
      momentum:normalizeMomentum(rawMomentum),
    }) : null,
    events:coverage.events ? canonicalEventsSection(list(rawEvents).map(canonicalEventInput)) : null,
    lineups:coverage.lineups ? canonicalLineupsSection({
      home:lineupSideInput(rawLineups?.home),
      away:lineupSideInput(rawLineups?.away),
    }) : null,
    players:coverage.players ? canonicalPlayersSection(list(rawPlayers).map(playerInput)) : null,
  });
}
