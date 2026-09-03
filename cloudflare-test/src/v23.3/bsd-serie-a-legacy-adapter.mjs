function list(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function team(value = {}) {
  const crest = String(value?.crestUrl || value?.crest_url || value?.logo || value?.logo_url || '').trim();
  return Object.freeze({
    id:value?.id ?? null,
    name:String(value?.name || value?.rawName || '—'),
    logo:crest,
    logo_url:crest,
    crest_url:crest,
    crestUrl:crest,
  });
}

function legacyStats(value = {}) {
  const source = object(value);
  const out = {
    expected_goals:finite(source.xg ?? source.expected_goals),
    ball_possession:finite(source.possession ?? source.ball_possession),
    total_shots:finite(source.shots ?? source.total_shots),
    shots_on_target:finite(source.shotsOnTarget ?? source.shots_on_target),
    big_chances:finite(source.bigChances ?? source.big_chances),
    corner_kicks:finite(source.corners ?? source.corner_kicks),
    fouls:finite(source.fouls),
    offsides:finite(source.offsides),
    yellow_cards:finite(source.yellowCards ?? source.yellow_cards),
    red_cards:finite(source.redCards ?? source.red_cards),
    goalkeeper_saves:finite(source.saves ?? source.goalkeeper_saves),
    pass_accuracy_pct:finite(source.passAccuracy ?? source.pass_accuracy_pct),
    interceptions:finite(source.interceptions),
    total_tackles:finite(source.tackles ?? source.total_tackles),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== null));
}

function legacyMomentum(points) {
  return list(points).map(point => {
    const minute = finite(point?.minute ?? point?.m);
    const home = finite(point?.home);
    const away = finite(point?.away);
    const signed = finite(point?.v);
    if (minute === null) return null;
    const v = signed !== null ? signed : home !== null && away !== null ? home - away : null;
    if (v === null) return null;
    return Object.freeze({ m:minute, v });
  }).filter(Boolean);
}

function legacyShotmap(shots) {
  return list(shots).map(shot => {
    const x = finite(shot?.x ?? shot?.pos?.x);
    const y = finite(shot?.y ?? shot?.pos?.y);
    if (x === null || y === null) return null;
    const side = String(shot?.side || '').toLowerCase();
    const home = side ? side !== 'away' : shot?.home !== false;
    return Object.freeze({
      pos:Object.freeze({ x, y }),
      home,
      xg:finite(shot?.xg),
      min:finite(shot?.minute ?? shot?.min),
      type:String(shot?.type || ''),
      player_name:String(shot?.player || shot?.player_name || ''),
    });
  }).filter(Boolean);
}

function legacyIncident(item = {}) {
  const side = String(item?.side || '').toLowerCase();
  const player = String(item?.player || item?.player_name || '');
  const assist = String(item?.assist || item?.assist_name || '');
  const playerIn = String(item?.playerIn || item?.player_in || item?.player_in_name || '');
  const playerOut = String(item?.playerOut || item?.player_out || item?.player_out_name || '');
  return Object.freeze({
    type:String(item?.type || ''),
    minute:finite(item?.minute),
    added_time:finite(item?.addedTime ?? item?.added_time),
    is_home:side === 'away' ? false : side === 'home' ? true : null,
    side,
    player_name:player,
    player,
    assist_name:assist,
    assist,
    reason:String(item?.reason || ''),
    player_in_name:playerIn,
    player_out_name:playerOut,
    player_in:playerIn,
    player_out:playerOut,
    home_score:finite(item?.homeScore ?? item?.home_score),
    away_score:finite(item?.awayScore ?? item?.away_score),
    text:String(item?.text || ''),
  });
}

function legacyLineupPlayer(player = {}) {
  const id = player?.playerId ?? player?.player_id ?? player?.id ?? null;
  const name = String(player?.name || player?.short_name || player?.shortName || 'Игрок');
  return Object.freeze({
    id,
    player_id:id,
    name,
    short_name:name,
    position:String(player?.position || player?.pos || ''),
    shirt_number:finite(player?.shirtNumber ?? player?.shirt_number ?? player?.number),
  });
}

function legacyLineupSide(side = {}) {
  return Object.freeze({
    formation:String(side?.formation || ''),
    players:Object.freeze(list(side?.starters || side?.players).map(legacyLineupPlayer)),
    substitutes:Object.freeze(list(side?.substitutes || side?.bench).map(legacyLineupPlayer)),
  });
}

function legacyPlayer(player = {}) {
  return Object.freeze({
    player_id:player?.playerId ?? player?.player_id ?? player?.id ?? null,
    name:String(player?.name || player?.short_name || player?.shortName || 'Игрок'),
    team_id:player?.teamId ?? player?.team_id ?? null,
    team_name:String(player?.teamName || player?.team_name || ''),
    rating:finite(player?.rating),
    goals:finite(player?.goals),
    goal_assist:finite(player?.assists ?? player?.goal_assist),
    expected_goals:finite(player?.xg ?? player?.expected_goals),
    expected_assists:finite(player?.xa ?? player?.expected_assists),
    total_shots:finite(player?.shots ?? player?.total_shots),
    key_pass:finite(player?.keyPasses ?? player?.key_pass),
    minutes_played:finite(player?.minutes ?? player?.minutes_played),
  });
}

function prediction(base = {}, overview = {}) {
  const direct = object(base?.prediction);
  if (Object.keys(direct).length) return direct;
  const canonical = object(overview?.userPrediction);
  const home = finite(canonical?.homeScore ?? canonical?.home_score);
  const away = finite(canonical?.awayScore ?? canonical?.away_score);
  if (home === null || away === null) return null;
  return Object.freeze({ home_score:home, away_score:away, points:finite(canonical?.points) });
}

function venueDetail(overview = {}) {
  const venue = object(overview?.venue);
  const name = String(venue?.name || '').trim();
  const city = String(venue?.city || '').trim();
  return {
    venue:name || city ? [name, city].filter(Boolean).join(' · ') : '',
    stadium:name,
    city,
    stadium_capacity:finite(venue?.capacity),
    referee:String(overview?.referee?.name || overview?.referee || ''),
  };
}

export function toSerieALegacyMatchCenterData(base = {}, sections = {}) {
  const overview = object(sections?.overview);
  const statsSection = object(sections?.stats);
  const stats = Object.keys(statsSection).length ? statsSection : object(overview?.summaryStats);
  const status = String(base?.status || 'scheduled').toLowerCase();
  const homeScore = finite(base?.homeScore ?? base?.home_score);
  const awayScore = finite(base?.awayScore ?? base?.away_score);
  const home = team(base?.homeTeam || base?.home);
  const away = team(base?.awayTeam || base?.away);
  const matchPrediction = prediction(base, overview);
  const venue = venueDetail(overview);

  return Object.freeze({
    status,
    competition:String(base?.competition || ''),
    match_id:String(base?.matchId || base?.match_id || ''),
    match:Object.freeze({
      id:String(base?.matchId || base?.match_id || ''),
      home,
      away,
      home_score:homeScore,
      away_score:awayScore,
      is_finished:status === 'finished',
      live_elapsed:finite(base?.minute),
      kickoff_at:base?.kickoffAt || base?.kickoff_at || null,
      round:finite(base?.round) !== null ? Object.freeze({ number:finite(base?.round) }) : null,
      prediction:matchPrediction,
    }),
    detail:Object.freeze({
      ...venue,
      home_score:homeScore,
      away_score:awayScore,
      current_minute:finite(base?.minute),
    }),
    coverage:Object.freeze({
      momentum:list(overview?.momentum).length > 0,
      shotmap:list(overview?.shotmap).length > 0,
    }),
    stats:Object.freeze({
      stats:Object.freeze({
        home:Object.freeze(legacyStats(stats?.home)),
        away:Object.freeze(legacyStats(stats?.away)),
      }),
      momentum:Object.freeze(legacyMomentum(overview?.momentum)),
      shotmap:Object.freeze(legacyShotmap(overview?.shotmap)),
    }),
    incidents:Object.freeze({ incidents:Object.freeze(list(sections?.events).map(legacyIncident)) }),
    lineups:Object.freeze({
      lineup_status:list(sections?.lineups?.home?.starters).length || list(sections?.lineups?.away?.starters).length ? 'confirmed' : 'unknown',
      lineups:Object.freeze({
        home:legacyLineupSide(sections?.lineups?.home),
        away:legacyLineupSide(sections?.lineups?.away),
      }),
    }),
    player_stats:Object.freeze({ player_stats:Object.freeze(list(sections?.players).map(legacyPlayer)) }),
    form:Object.freeze({
      home:Object.freeze(list(overview?.form?.home)),
      away:Object.freeze(list(overview?.form?.away)),
    }),
    prediction_model:overview?.prediction || null,
    prediction_split:overview?.predictionSplit || null,
  });
}
