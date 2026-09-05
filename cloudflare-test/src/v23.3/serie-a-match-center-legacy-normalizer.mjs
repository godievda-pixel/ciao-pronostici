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

function firstPresent(source, keys) {
  if (!source || typeof source !== 'object') return undefined;
  for (const key of keys) {
    if (hasOwn(source, key)) return source[key];
  }
  return undefined;
}

function firstObject(...values) {
  return values.map(object).find(Boolean) || null;
}

function firstArraySource(...values) {
  return values.find(value => Array.isArray(value));
}

function nestedName(value) {
  const source = object(value);
  return source ? text(source.name ?? source.full_name ?? source.fullName ?? source.short_name ?? source.shortName) : text(value);
}

function legacyCrest(source, side) {
  return text(
    source?.[`${side}_logo`]
    ?? source?.[`${side}_logo_url`]
    ?? source?.[`${side}_team_logo`]
    ?? source?.[`${side}_team_logo_url`],
  );
}

function normalizeTeam(value, crestFallback = '') {
  const source = object(value) || {};
  return {
    id:finite(source.id ?? source.team_id ?? source.teamId),
    name:text(source.name ?? source.team_name ?? source.teamName),
    crestUrl:text(
      source.crestUrl
      ?? source.crest_url
      ?? source.logoUrl
      ?? source.logo_url
      ?? source.logo
      ?? crestFallback,
    ),
  };
}

function normalizeStatus(match = {}, root = {}) {
  const explicit = text(match.status ?? match.live_status ?? root.status ?? root.live_status).toLowerCase();
  if (['finished','ft','ended','complete','completed'].includes(explicit)) return 'finished';
  if (['live','in_progress','in-progress','playing','ht','halftime'].includes(explicit)) return 'live';
  if (['postponed','cancelled','canceled'].includes(explicit)) return explicit === 'canceled' ? 'cancelled' : explicit;
  if (match.is_finished === true || root.is_finished === true) return 'finished';
  if (match.is_live === true || root.is_live === true) return 'live';
  return explicit || 'scheduled';
}

function normalizeMatch(source = {}) {
  const match = object(source.match) || {};
  const detail = object(source.detail) || {};
  return {
    id:match.id ?? match.match_id ?? match.matchId ?? source.match_id ?? source.id,
    matchId:match.matchId ?? match.match_id ?? match.id ?? source.match_id ?? source.id,
    kickoffAt:text(match.kickoffAt ?? match.kickoff_at ?? match.starts_at ?? source.kickoff_at),
    status:normalizeStatus(match, source),
    minute:finite(match.minute ?? match.live_elapsed ?? detail.current_minute ?? source.minute),
    homeScore:finite(match.homeScore ?? match.home_score ?? detail.home_score ?? source.home_score),
    awayScore:finite(match.awayScore ?? match.away_score ?? detail.away_score ?? source.away_score),
    homeTeam:normalizeTeam(
      match.homeTeam ?? match.home_team ?? match.home,
      legacyCrest(match, 'home') || legacyCrest(source, 'home'),
    ),
    awayTeam:normalizeTeam(
      match.awayTeam ?? match.away_team ?? match.away,
      legacyCrest(match, 'away') || legacyCrest(source, 'away'),
    ),
    round:match.round ?? source.round ?? null,
    stage:text(match.stage ?? source.stage),
    predictionDeadline:text(match.predictionDeadline ?? match.prediction_deadline ?? source.prediction_deadline),
  };
}

function numericStat(source, aliases) {
  if (!source || typeof source !== 'object') return null;
  for (const key of aliases) {
    if (!hasOwn(source, key)) continue;
    const value = source[key];
    if (object(value) && hasOwn(value, 'actual')) return value.actual;
    return value;
  }
  return null;
}

function normalizeStatSide(source = {}) {
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

function normalizePrediction(value, fallbackKind = 'model') {
  const source = object(value);
  if (!source) return null;
  const homeScore = finite(source.homeScore ?? source.home_score ?? source.pred_home_score);
  const awayScore = finite(source.awayScore ?? source.away_score ?? source.pred_away_score);
  if (homeScore === null && awayScore === null) return null;
  return {
    ...source,
    kind:text(source.kind) || fallbackKind,
    ...(homeScore !== null ? { homeScore } : {}),
    ...(awayScore !== null ? { awayScore } : {}),
  };
}

function splitValue(value) {
  const source = object(value);
  return finite(source ? source.pct ?? source.percent ?? source.value : value);
}

function normalizePredictionSplit(value) {
  const source = object(value);
  if (!source) return null;
  const total = finite(source.total);
  const home = splitValue(source.home ?? source.homeWin ?? source.home_win ?? source.prob_home ?? source.probHome);
  const draw = splitValue(source.draw ?? source.prob_draw ?? source.probDraw);
  const away = splitValue(source.away ?? source.awayWin ?? source.away_win ?? source.prob_away ?? source.probAway);
  if (total === null && home === null && draw === null && away === null) return null;
  return {
    ...(total !== null ? { total } : {}),
    ...(home !== null ? { home } : {}),
    ...(draw !== null ? { draw } : {}),
    ...(away !== null ? { away } : {}),
  };
}

function normalizeMomentum(value) {
  return (array(value) || []).map(point => {
    const source = object(point);
    if (!source) return null;
    const minute = finite(source.minute ?? source.m);
    const home = finite(source.home);
    const away = finite(source.away);
    if (home !== null && away !== null) return { minute, home, away };
    const signed = finite(source.v);
    if (signed === null) return null;
    const homeShare = Math.max(0, Math.min(100, 50 + signed / 2));
    return { minute, home:homeShare, away:100 - homeShare };
  }).filter(Boolean);
}

function shotSide(source = {}) {
  const explicitSide = text(source.side).toLowerCase();
  if (explicitSide === 'home' || explicitSide === 'away') return explicitSide;
  return source.home === false || source.is_home === false ? 'away' : 'home';
}

function normalizeGoalKind(source = {}) {
  const explicit = text(source.goalKind ?? source.goal_kind ?? source.goal_type ?? source.kind).toLowerCase();
  if (['open_play','penalty','own_goal','free_kick','unknown'].includes(explicit)) return explicit;
  if (source.own_goal === true || source.is_own_goal === true) return 'own_goal';
  if (source.penalty === true || source.is_penalty === true) return 'penalty';
  if (source.free_kick === true || source.is_free_kick === true) return 'free_kick';
  return '';
}

function normalizeShotmap(value) {
  return (array(value) || []).map(shot => {
    const source = object(shot);
    if (!source) return null;
    const position = object(source.pos);
    const x = finite(source.x ?? position?.x);
    const y = finite(source.y ?? position?.y);
    if (x === null || y === null) return null;
    return { side:shotSide(source), x, y, xg:finite(source.xg) };
  }).filter(Boolean);
}

function normalizeDetailedShot(shot) {
  const source = object(shot);
  if (!source) return null;
  const position = firstObject(source.position, source.pos) || {};
  const goalKind = normalizeGoalKind(source);
  return {
    side:shotSide(source),
    x:source.x ?? position.x,
    y:source.y ?? position.y,
    minute:source.minute ?? source.min,
    addedTime:source.addedTime ?? source.added_time,
    player:nestedName(source.player ?? source.player_name),
    assist:nestedName(source.assist ?? source.assist_name),
    xg:source.xg ?? source.expected_goals,
    outcome:source.outcome ?? source.result ?? source.type,
    situation:source.situation ?? source.playPattern ?? source.play_pattern,
    bodyPart:source.bodyPart ?? source.body_part,
    ...(goalKind ? { goalKind } : {}),
  };
}

function normalizeVenue(detail = {}, overview = {}) {
  const existing = firstObject(overview.venue, detail.venue);
  if (existing) return existing;
  const name = text(detail.stadium ?? detail.stadium_name ?? detail.venue_name);
  const city = text(detail.city ?? detail.stadium_city);
  const capacity = finite(detail.stadium_capacity ?? detail.capacity);
  return name || city || capacity !== null ? { name, city, capacity } : null;
}

function normalizeReferee(detail = {}, overview = {}) {
  const structured = firstObject(overview.referee, detail.referee, detail.main_referee);
  if (structured) return structured;
  const name = text(detail.referee ?? detail.referee_name ?? detail.main_referee);
  return name ? { name } : null;
}

function normalizeEvent(event) {
  const source = object(event) || {};
  const goalKind = normalizeGoalKind(source);
  const cardKind = text(source.cardKind ?? source.card_kind ?? source.card_type).toLowerCase();
  const varDecision = text(source.varDecision ?? source.var_decision ?? source.var_result).toLowerCase();
  return {
    ...source,
    side:source.side || (source.is_home === true ? 'home' : source.is_home === false ? 'away' : ''),
    player:nestedName(source.player ?? source.player_name),
    assist:nestedName(source.assist ?? source.assist_name),
    playerIn:nestedName(source.playerIn ?? source.player_in),
    playerOut:nestedName(source.playerOut ?? source.player_out),
    ...(goalKind ? { goalKind } : {}),
    ...(cardKind ? { cardKind } : {}),
    ...(varDecision ? { varDecision } : {}),
  };
}

function normalizeLineupPlayer(player, starter) {
  const source = object(player) || {};
  return {
    ...source,
    name:nestedName(source.name || source.short_name || source.shortName || source.player),
    shirtNumber:source.shirtNumber ?? source.shirt_number ?? source.number,
    x:source.x ?? source.position_x ?? source.coordinates?.x,
    y:source.y ?? source.position_y ?? source.coordinates?.y,
    grid:source.grid ?? source.grid_position ?? source.formation_position,
    starter:typeof source.starter === 'boolean' ? source.starter : starter,
  };
}

function normalizeLineupSide(side) {
  const source = object(side) || {};
  const startersSource = array(source.starters) || array(source.players) || [];
  const substitutesSource = array(source.substitutes) || array(source.bench) || [];
  return {
    ...source,
    formation:source.formation,
    coach:nestedName(source.coach ?? source.coach_name),
    starters:startersSource.map(player => normalizeLineupPlayer(player, true)),
    substitutes:substitutesSource.map(player => normalizeLineupPlayer(player, false)),
  };
}

function normalizeLineups(value) {
  const source = object(value) || {};
  return {
    home:normalizeLineupSide(source.home),
    away:normalizeLineupSide(source.away),
  };
}

function normalizePlayer(player) {
  const source = object(player) || {};
  return {
    ...source,
    keyPasses:source.keyPasses ?? source.key_pass ?? source.key_passes,
  };
}

function overviewPayload(source, statsEnvelope) {
  const existing = object(source.overview_meta ?? source.overviewMeta) || {};
  const detail = object(source.detail) || {};
  const match = object(source.match) || {};
  const momentumSource = firstPresent(source, ['momentum'])
    ?? firstPresent(statsEnvelope, ['momentum'])
    ?? firstPresent(existing, ['momentum']);
  const shotmapSource = firstPresent(source, ['shotmap','shot_map'])
    ?? firstPresent(statsEnvelope, ['shotmap','shot_map'])
    ?? firstPresent(existing, ['shotmap','shot_map']);
  const venue = normalizeVenue(detail, existing);
  const referee = normalizeReferee(detail, existing);
  const form = firstObject(source.form, existing.form);
  const modelPrediction = firstPresent(source, ['prediction_model','predictionModel'])
    ?? firstPresent(existing, ['prediction_model','predictionModel']);
  const userPrediction = firstPresent(match, ['prediction'])
    ?? firstPresent(source, ['prediction'])
    ?? firstPresent(existing, ['prediction']);
  const prediction = modelPrediction !== undefined
    ? normalizePrediction(modelPrediction, 'model')
    : userPrediction !== undefined
      ? normalizePrediction(userPrediction, 'user')
      : null;
  const predictionSplit = normalizePredictionSplit(
    firstPresent(source, ['prediction_split','predictionSplit'])
    ?? firstPresent(existing, ['prediction_split','predictionSplit']),
  );
  const momentum = normalizeMomentum(momentumSource);
  const shotmap = normalizeShotmap(shotmapSource);

  const hasData = Boolean(
    venue
    || referee
    || form
    || prediction
    || predictionSplit
    || momentum.length
    || shotmap.length
  );
  if (!hasData) return null;
  return {
    ...(venue ? { venue } : {}),
    ...(referee ? { referee } : {}),
    ...(form ? { form } : {}),
    ...(prediction ? { prediction } : {}),
    ...(predictionSplit ? { predictionSplit } : {}),
    ...(momentum.length ? { momentum } : {}),
    ...(shotmap.length ? { shotmap } : {}),
  };
}

export function normalizeSerieALegacyMatchCenter(raw = {}) {
  const source = object(raw) || {};
  const statsEnvelope = object(source.stats) || {};
  const statsRaw = object(statsEnvelope.stats ?? source.stats);
  const overviewRaw = object(source.overview_meta ?? source.overviewMeta) || {};
  const shotSource = firstArraySource(
    source.shots,
    source.shotmap,
    source.shot_map,
    statsEnvelope.shots,
    statsEnvelope.shotmap,
    statsEnvelope.shot_map,
    overviewRaw.shots,
    overviewRaw.shotmap,
    overviewRaw.shot_map,
  );
  const richShots = (shotSource || []).map(normalizeDetailedShot).filter(Boolean);
  const incidentsRaw = array(source.incidents?.incidents ?? source.incidents);
  const lineupsRaw = object(source.lineups?.lineups ?? source.lineups);
  const playersRaw = array(source.player_stats?.player_stats ?? source.playerStats ?? source.player_stats);
  const overview = overviewPayload(source, statsEnvelope);

  return {
    match:normalizeMatch(source),
    ...(overview ? { overview_meta:overview } : {}),
    ...(statsRaw || richShots.length ? {
      stats:{
        stats:{
          home:normalizeStatSide(statsRaw?.home),
          away:normalizeStatSide(statsRaw?.away),
        },
        ...(richShots.length ? { shots:richShots } : {}),
      },
    } : {}),
    ...(incidentsRaw ? { incidents:{ incidents:incidentsRaw.map(normalizeEvent) } } : {}),
    ...(lineupsRaw ? { lineups:{ lineups:normalizeLineups(lineupsRaw) } } : {}),
    ...(playersRaw ? { player_stats:{ player_stats:playersRaw.map(normalizePlayer) } } : {}),
    ...(object(source.capabilities) ? { capabilities:source.capabilities } : {}),
  };
}
