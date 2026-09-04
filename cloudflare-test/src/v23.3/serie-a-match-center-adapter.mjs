import {
  canonicalCoverage,
  canonicalMatchCenterBase,
  canonicalOverviewSection,
  canonicalStatsSection,
  canonicalEventsSection,
  canonicalLineupsSection,
  canonicalPlayersSection,
} from './match-center-sections.mjs';

function text(value) {
  return String(value ?? '').trim();
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function array(value) {
  return Array.isArray(value) ? value : null;
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hasOwn(source, key) {
  return Boolean(source && Object.prototype.hasOwnProperty.call(source, key));
}

function firstObject(...values) {
  return values.map(object).find(Boolean) || null;
}

function firstPresent(source, keys) {
  if (!source || typeof source !== 'object') return undefined;
  for (const key of keys) {
    if (hasOwn(source, key)) return source[key];
  }
  return undefined;
}

function canonicalTeam(value, crestFallback = '') {
  const source = object(value) || {};
  const id = finite(source.id ?? source.team_id ?? source.teamId);
  const name = text(source.name ?? source.team_name ?? source.teamName);
  const crestUrl = text(
    source.crestUrl
    ?? source.crest_url
    ?? source.logoUrl
    ?? source.logo_url
    ?? source.logo
    ?? crestFallback,
  );
  return Object.freeze({ id, name, crestUrl });
}

function legacyCrest(match, side) {
  return text(
    match?.[`${side}_logo`]
    ?? match?.[`${side}_logo_url`]
    ?? match?.[`${side}_team_logo`]
    ?? match?.[`${side}_team_logo_url`],
  );
}

function canonicalStatus(match = {}, root = {}) {
  const explicit = text(match.status ?? match.live_status ?? root.status ?? root.live_status).toLowerCase();
  if (['finished','ft','ended','complete','completed'].includes(explicit)) return 'finished';
  if (['live','in_progress','in-progress','playing','ht','halftime'].includes(explicit)) return 'live';
  if (['postponed','cancelled','canceled'].includes(explicit)) return explicit === 'canceled' ? 'cancelled' : explicit;
  if (match.is_finished === true || root.is_finished === true) return 'finished';
  if (match.is_live === true || root.is_live === true) return 'live';
  return explicit || 'scheduled';
}

function canonicalLegacyMatch(value, root = {}) {
  const match = object(value) || {};
  const detail = object(root.detail) || {};
  const rawId = match.matchId ?? match.match_id ?? match.id ?? root.match_id ?? root.id;
  const idText = text(rawId);
  const matchId = idText.startsWith('serie_a:') ? idText : `serie_a:${idText}`;
  const homeValue = match.homeTeam ?? match.home_team ?? match.home;
  const awayValue = match.awayTeam ?? match.away_team ?? match.away;
  return Object.freeze({
    competition:'serie_a',
    matchId,
    kickoffAt:text(match.kickoffAt ?? match.kickoff_at ?? match.starts_at ?? root.kickoff_at),
    status:canonicalStatus(match, root),
    minute:finite(match.minute ?? match.live_elapsed ?? detail.current_minute ?? root.minute),
    homeScore:finite(match.homeScore ?? match.home_score ?? detail.home_score ?? root.home_score),
    awayScore:finite(match.awayScore ?? match.away_score ?? detail.away_score ?? root.away_score),
    homeTeam:canonicalTeam(homeValue, legacyCrest(match, 'home') || legacyCrest(root, 'home')),
    awayTeam:canonicalTeam(awayValue, legacyCrest(match, 'away') || legacyCrest(root, 'away')),
    round:match.round ?? root.round ?? null,
    stage:text(match.stage ?? root.stage),
    predictionDeadline:text(match.predictionDeadline ?? match.prediction_deadline ?? root.prediction_deadline),
  });
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
    xg:numericStat(source, ['xg','expectedGoals','expected_goals']),
    possession:numericStat(source, ['possession','ballPossession','ball_possession']),
    shots:numericStat(source, ['shots','totalShots','total_shots']),
    shotsOnTarget:numericStat(source, ['shotsOnTarget','shots_on_target']),
    bigChances:numericStat(source, ['bigChances','big_chances']),
    corners:numericStat(source, ['corners','cornerKicks','corner_kicks']),
    fouls:numericStat(source, ['fouls']),
    offsides:numericStat(source, ['offsides']),
    yellowCards:numericStat(source, ['yellowCards','yellow_cards']),
    redCards:numericStat(source, ['redCards','red_cards']),
    saves:numericStat(source, ['saves','goalkeeperSaves','goalkeeper_saves']),
    passAccuracy:numericStat(source, ['passAccuracy','pass_accuracy','pass_accuracy_pct']),
    interceptions:numericStat(source, ['interceptions']),
    tackles:numericStat(source, ['tackles','totalTackles','total_tackles']),
  };
}

function normalizePrediction(value) {
  const source = object(value);
  if (!source) return null;
  const homeScore = finite(source.homeScore ?? source.home_score ?? source.pred_home_score);
  const awayScore = finite(source.awayScore ?? source.away_score ?? source.pred_away_score);
  if (homeScore === null && awayScore === null) return Object.freeze({ ...source });
  return Object.freeze({ ...source, homeScore, awayScore });
}

function normalizeMomentum(value) {
  return (array(value) || []).map(point => {
    if (!object(point)) return null;
    const minute = finite(point.minute ?? point.m);
    const home = finite(point.home);
    const away = finite(point.away);
    if (home !== null && away !== null) return Object.freeze({ minute, home, away });
    const signed = finite(point.v);
    if (signed === null) return null;
    const homeShare = Math.max(0, Math.min(100, 50 + signed / 2));
    return Object.freeze({ minute, home:homeShare, away:100 - homeShare });
  }).filter(Boolean);
}

function normalizeShotmap(value) {
  return (array(value) || []).map(shot => {
    if (!object(shot)) return null;
    const position = object(shot.pos);
    const x = finite(shot.x ?? position?.x);
    const y = finite(shot.y ?? position?.y);
    if (x === null || y === null) return null;
    const explicitSide = text(shot.side).toLowerCase();
    const side = explicitSide === 'away'
      ? 'away'
      : explicitSide === 'home'
        ? 'home'
        : shot.home === false || shot.is_home === false
          ? 'away'
          : 'home';
    return Object.freeze({ side, x, y, xg:finite(shot.xg) });
  }).filter(Boolean);
}

function detailVenue(detail = {}, overview = {}) {
  const existing = firstObject(overview.venue, detail.venue);
  if (existing) return existing;
  const name = text(detail.stadium ?? detail.stadium_name ?? detail.venue_name);
  const city = text(detail.city ?? detail.stadium_city);
  const capacity = finite(detail.stadium_capacity ?? detail.capacity);
  return name || city || capacity !== null ? { name, city, capacity } : null;
}

function detailReferee(detail = {}, overview = {}) {
  const existing = firstObject(overview.referee, detail.referee, detail.main_referee);
  if (existing) return existing;
  const name = text(detail.referee ?? detail.referee_name ?? detail.main_referee);
  return name ? { name } : null;
}

function normalizeOverview(source, statsRaw) {
  const overview = object(source.overview_meta ?? source.overviewMeta) || {};
  const detail = object(source.detail) || {};
  const statsEnvelope = object(source.stats) || {};
  const prediction = normalizePrediction(
    source.prediction_model
    ?? source.prediction
    ?? overview.prediction,
  );
  return {
    venue:detailVenue(detail, overview),
    referee:detailReferee(detail, overview),
    form:firstObject(source.form, overview.form) || {},
    prediction,
    predictionSplit:firstPresent(source, ['prediction_split','predictionSplit'])
      ?? firstPresent(overview, ['prediction_split','predictionSplit'])
      ?? null,
    summaryStats:statsRaw ? {
      home:canonicalStatInput(statsRaw.home),
      away:canonicalStatInput(statsRaw.away),
    } : null,
    momentum:normalizeMomentum(
      firstPresent(source, ['momentum'])
      ?? firstPresent(statsEnvelope, ['momentum'])
      ?? firstPresent(overview, ['momentum']),
    ),
    shotmap:normalizeShotmap(
      firstPresent(source, ['shotmap','shot_map'])
      ?? firstPresent(statsEnvelope, ['shotmap','shot_map'])
      ?? firstPresent(overview, ['shotmap','shot_map']),
    ),
  };
}

function nestedName(value) {
  const source = object(value);
  return source ? text(source.name ?? source.short_name ?? source.shortName) : text(value);
}

function normalizeEvents(value) {
  return (array(value) || []).map(event => {
    const item = object(event) || {};
    return {
      ...item,
      side:item.side || (item.is_home === true ? 'home' : item.is_home === false ? 'away' : ''),
      player:nestedName(item.player ?? item.player_name),
      assist:nestedName(item.assist ?? item.assist_name),
      playerIn:nestedName(item.playerIn ?? item.player_in),
      playerOut:nestedName(item.playerOut ?? item.player_out),
    };
  });
}

function normalizePlayers(value) {
  const source = array(value) || [];
  return source.map(player => {
    const item = object(player) || {};
    return {
      ...item,
      keyPasses:item.keyPasses ?? item.key_pass ?? item.key_passes,
    };
  });
}

function hasOverview(source, overview) {
  if (object(source.detail)) return true;
  if (object(source.form)) return true;
  if (object(source.prediction_model) || object(source.prediction)) return true;
  if (hasOwn(source, 'prediction_split') || hasOwn(source, 'predictionSplit')) return true;
  if (!object(overview)) return false;
  return Boolean(
    object(overview.venue)
    || object(overview.referee)
    || object(overview.form)
    || object(overview.prediction)
    || object(overview.predictionSplit ?? overview.prediction_split)
    || array(overview.momentum)
    || array(overview.shotmap ?? overview.shot_map)
  );
}

export function adaptSerieALegacyMatchCenter(raw = {}) {
  const source = object(raw) || {};
  const match = canonicalLegacyMatch(source.match, source);
  const overviewRaw = object(source.overview_meta ?? source.overviewMeta);
  const statsEnvelope = object(source.stats);
  const statsRaw = object(statsEnvelope?.stats ?? source.stats);
  const eventsRaw = array(source.incidents?.incidents ?? source.incidents);
  const lineupsRaw = object(source.lineups?.lineups ?? source.lineups);
  const playersRaw = array(source.player_stats?.player_stats ?? source.playerStats ?? source.player_stats);
  const capabilitiesRaw = object(source.capabilities) || {};
  const normalizedOverview = normalizeOverview(source, statsRaw);
  const rawMomentum = normalizedOverview.momentum;
  const rawShotmap = normalizedOverview.shotmap;

  const coverage = canonicalCoverage({
    overview:hasOverview(source, overviewRaw) || statsRaw !== null || rawMomentum.length > 0 || rawShotmap.length > 0,
    stats:statsRaw !== null,
    events:eventsRaw !== null,
    lineups:lineupsRaw !== null,
    players:playersRaw !== null,
    momentum:rawMomentum.length > 0,
    shotmap:rawShotmap.length > 0,
  });

  const overview = canonicalOverviewSection(normalizedOverview);
  const stats = canonicalStatsSection({
    home:canonicalStatInput(statsRaw?.home),
    away:canonicalStatInput(statsRaw?.away),
  });
  const events = canonicalEventsSection(normalizeEvents(eventsRaw || []));
  const lineups = canonicalLineupsSection(lineupsRaw || {});
  const players = canonicalPlayersSection(normalizePlayers(playersRaw || []));
  const base = canonicalMatchCenterBase(match, coverage);
  const capabilities = Object.freeze({
    navigation:capabilitiesRaw.navigation === true,
    live:capabilitiesRaw.live === true,
  });

  return Object.freeze({
    base,
    coverage,
    overview,
    stats,
    events,
    lineups,
    players,
    capabilities,
  });
}