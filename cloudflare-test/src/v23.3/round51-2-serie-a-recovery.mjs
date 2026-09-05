function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value ?? '').trim();
}

function normalizeShot(shot) {
  const source = object(shot);
  if (!source) return shot;
  const directPlayer = source.player ?? source.player_name ?? source.playerName;
  const aliasPlayer = source.short_name ?? source.shortName ?? source.name ?? source.shooter_name ?? source.shooterName ?? source.shooter;
  const playerId = source.player_id ?? source.playerId ?? source.pid ?? source.player?.id ?? source.shooter?.id;
  return {
    ...source,
    ...(directPlayer === undefined && aliasPlayer !== undefined ? { player_name:aliasPlayer } : {}),
    ...(source.player_id === undefined && playerId !== undefined ? { player_id:playerId } : {}),
  };
}

function normalizeIncident(event) {
  const source = object(event);
  if (!source) return event;
  const directPlayer = source.player ?? source.player_name ?? source.playerName;
  const aliasPlayer = source.short_name ?? source.shortName ?? source.name;
  const playerId = source.player_id ?? source.playerId ?? source.pid ?? source.player?.id;
  return {
    ...source,
    ...(directPlayer === undefined && aliasPlayer !== undefined ? { player_name:aliasPlayer } : {}),
    ...(source.player_id === undefined && playerId !== undefined ? { player_id:playerId } : {}),
  };
}

function normalizePlayerStatsEnvelope(value) {
  if (Array.isArray(value)) return { player_stats:value };
  const source = object(value);
  if (!source) return value;
  if (Array.isArray(source.player_stats)) return source;
  const combined = [
    ...list(source.players),
    ...list(source.home),
    ...list(source.away),
    ...list(source.home_players),
    ...list(source.away_players),
  ];
  return combined.length ? { ...source, player_stats:combined } : source;
}

function normalizeShotContainer(container) {
  const source = object(container);
  if (!source) return container;
  const key = ['shotmap','shot_map','shots'].find(name => Array.isArray(source[name]));
  if (!key) return source;
  return { ...source, [key]:source[key].map(normalizeShot) };
}

function rawShotSource(raw) {
  const source = object(raw) || {};
  const stats = object(source.stats) || {};
  const overview = object(source.overview_meta ?? source.overviewMeta) || {};
  return [
    source.shots,
    source.shotmap,
    source.shot_map,
    stats.shots,
    stats.shotmap,
    stats.shot_map,
    overview.shots,
    overview.shotmap,
    overview.shot_map,
  ].find(Array.isArray) || [];
}

export function normalizeRound512SerieARaw(raw) {
  const source = object(raw);
  if (!source) return raw;
  const stats = normalizeShotContainer(source.stats);
  const topShotKey = ['shotmap','shot_map','shots'].find(name => Array.isArray(source[name]));
  const incidentsEnvelope = object(source.incidents);
  const incidents = incidentsEnvelope && Array.isArray(incidentsEnvelope.incidents)
    ? { ...incidentsEnvelope, incidents:incidentsEnvelope.incidents.map(normalizeIncident) }
    : Array.isArray(source.incidents)
      ? source.incidents.map(normalizeIncident)
      : source.incidents;
  return {
    ...source,
    ...(stats ? { stats } : {}),
    ...(topShotKey ? { [topShotKey]:source[topShotKey].map(normalizeShot) } : {}),
    ...(source.incidents !== undefined ? { incidents } : {}),
    ...(source.player_stats !== undefined ? { player_stats:normalizePlayerStatsEnvelope(source.player_stats) } : {}),
  };
}

export function restoreRound512NormalizedShotIds(normalized, recoveredRaw) {
  if (!normalized || typeof normalized !== 'object') return normalized;
  const normalizedStats = object(normalized.stats);
  const shots = list(normalizedStats?.shots);
  if (!shots.length) return normalized;
  const rawShots = rawShotSource(recoveredRaw);
  if (!rawShots.length) return normalized;
  const patched = shots.map((shot, index) => {
    const raw = object(rawShots[index]);
    if (!raw) return shot;
    const playerId = raw.player_id ?? raw.playerId ?? raw.pid ?? raw.player?.id ?? raw.shooter?.id;
    return playerId === null || playerId === undefined || playerId === ''
      ? shot
      : { ...shot, playerId };
  });
  return {
    ...normalized,
    stats:{ ...normalizedStats, shots:patched },
  };
}

function playerIdentity(players, lineups) {
  const byId = new Map();
  const add = player => {
    const id = text(player?.playerId ?? player?.player_id ?? player?.id);
    const name = text(player?.name ?? player?.shortName ?? player?.short_name ?? player?.player_name);
    if (id && name && !byId.has(id)) byId.set(id, name);
  };
  for (const player of list(players)) add(player);
  for (const side of ['home','away']) {
    for (const player of [...list(lineups?.[side]?.starters), ...list(lineups?.[side]?.substitutes)]) add(player);
  }
  return byId;
}

export function enrichRound512ShotPlayers(stats, players, lineups) {
  if (!stats || typeof stats !== 'object') return stats;
  const byId = playerIdentity(players, lineups);
  return Object.freeze({
    ...stats,
    shots:Object.freeze(list(stats.shots).map(shot => {
      if (text(shot?.player)) return shot;
      const name = byId.get(text(shot?.playerId ?? shot?.player_id));
      return name ? Object.freeze({ ...shot, player:name }) : shot;
    })),
  });
}

export function round512NeedsSectionRecovery(adapted, section) {
  if (!adapted || typeof adapted !== 'object') return false;
  if (section === 'lineups') {
    const homeStarters = list(adapted?.lineups?.home?.starters).length;
    const awayStarters = list(adapted?.lineups?.away?.starters).length;
    const substitutes = list(adapted?.lineups?.home?.substitutes).length + list(adapted?.lineups?.away?.substitutes).length;
    return homeStarters + awayStarters > 0 && substitutes === 0;
  }
  if (section === 'players') {
    const players = list(adapted?.players);
    return players.length === 0 || !players.some(player => Number.isFinite(Number(player?.rating)));
  }
  if (section === 'stats') {
    return list(adapted?.stats?.shots).some(shot => !text(shot?.player) && text(shot?.playerId));
  }
  return false;
}
