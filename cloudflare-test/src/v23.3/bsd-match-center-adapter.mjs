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

function overviewInput(event = {}) {
  const overviewMeta = object(event.overview_meta) || {};
  const venue = firstObject(event.venue, overviewMeta.venue) || {};
  const referee = firstObject(event.referee, event.main_referee, overviewMeta.referee);
  const form = firstObject(event.form, overviewMeta.form) || {};
  const momentum = firstPresent(event, ['momentum']) ?? overviewMeta.momentum ?? null;
  const shotmap = firstPresent(event, ['shotmap','shot_map'])
    ?? overviewMeta.shotmap
    ?? overviewMeta.shot_map
    ?? null;
  const predictionSplit = firstPresent(event, ['prediction_split','predictionSplit'])
    ?? firstPresent(overviewMeta, ['prediction_split','predictionSplit'])
    ?? null;
  return {
    venue,
    referee,
    form,
    prediction:firstObject(event.prediction, overviewMeta.prediction),
    predictionSplit,
    momentum,
    shotmap,
  };
}

function canonicalEventInput(event = {}) {
  return {
    type:event.type,
    minute:event.minute,
    addedTime:event.addedTime ?? event.added_time,
    side:event.side || (event.is_home === true ? 'home' : event.is_home === false ? 'away' : ''),
    player:event.player || event.player_name,
    assist:event.assist || event.assist_name,
    reason:event.reason,
    playerIn:event.playerIn ?? event.player_in,
    playerOut:event.playerOut ?? event.player_out,
    homeScore:event.homeScore ?? event.home_score,
    awayScore:event.awayScore ?? event.away_score,
    text:event.text,
  };
}

function lineupPlayerInput(player = {}) {
  return {
    playerId:player.playerId ?? player.player_id ?? player.id,
    name:player.name || player.short_name || player.shortName,
    position:player.position || player.pos,
    shirtNumber:player.shirtNumber ?? player.shirt_number ?? player.number,
  };
}

function lineupSideInput(side = {}) {
  return {
    formation:side.formation,
    starters:list(side.starters || side.players).map(lineupPlayerInput),
    substitutes:list(side.substitutes || side.bench).map(lineupPlayerInput),
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

function hasOverview(event = {}) {
  return Boolean(
    object(event.venue)
    || object(event.referee)
    || object(event.main_referee)
    || object(event.form)
    || object(event.overview_meta)
    || hasOwn(event, 'prediction_split')
    || hasOwn(event, 'predictionSplit')
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
  return canonicalCoverage({
    overview:hasOverview(event),
    stats:Boolean(statsSource(event)),
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
  const rawEvents = incidentsSource(event);
  const rawLineups = lineupsSource(event);
  const rawPlayers = playerStatsSource(event);
  return Object.freeze({
    coverage,
    overview:coverage.overview ? canonicalOverviewSection(overviewInput(event)) : null,
    stats:coverage.stats ? canonicalStatsSection({
      home:canonicalStatInput(rawStats?.home),
      away:canonicalStatInput(rawStats?.away),
    }) : null,
    events:coverage.events ? canonicalEventsSection(list(rawEvents).map(canonicalEventInput)) : null,
    lineups:coverage.lineups ? canonicalLineupsSection({
      home:lineupSideInput(rawLineups?.home),
      away:lineupSideInput(rawLineups?.away),
    }) : null,
    players:coverage.players ? canonicalPlayersSection(list(rawPlayers).map(playerInput)) : null,
  });
}
