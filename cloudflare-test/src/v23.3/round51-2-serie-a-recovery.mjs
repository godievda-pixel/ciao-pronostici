function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value ?? '').trim();
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

function rawPlayerNameIndex(playerStats) {
  const envelope = object(playerStats);
  const rows = envelope ? list(envelope.player_stats) : list(playerStats);
  const byId = new Map();
  for (const player of rows) {
    const id = text(player?.playerId ?? player?.player_id ?? player?.id ?? player?.pid);
    const name = text(player?.name ?? player?.short_name ?? player?.shortName ?? player?.player_name ?? player?.playerName);
    if (id && name && !byId.has(id)) byId.set(id, name);
  }
  return byId;
}

function playerIdentityFromRaw(source, namesById, aliases = []) {
  const playerObject = object(source?.player);
  const directName = text(
    playerObject?.name
    ?? playerObject?.full_name
    ?? playerObject?.fullName
    ?? playerObject?.short_name
    ?? playerObject?.shortName
    ?? source?.player_name
    ?? source?.playerName,
  );
  const aliasName = text(aliases.map(key => source?.[key]).find(value => text(value)));
  const playerId = source?.player_id ?? source?.playerId ?? source?.pid ?? source?.player?.id ?? source?.shooter?.id;
  const recoveredName = directName || aliasName || namesById.get(text(playerId)) || '';
  return { playerObject, directName, playerId, recoveredName };
}

function normalizeShot(shot, namesById = new Map()) {
  const source = object(shot);
  if (!source) return shot;
  const identity = playerIdentityFromRaw(source, namesById, [
    'short_name','shortName','name','shooter_name','shooterName',
  ]);
  return {
    ...source,
    ...(identity.playerObject && !identity.directName && identity.recoveredName
      ? { player:{ ...identity.playerObject, name:identity.recoveredName } }
      : {}),
    ...(!identity.playerObject && source.player === undefined && source.player_name === undefined && identity.recoveredName
      ? { player_name:identity.recoveredName }
      : {}),
    ...(source.player_id === undefined && identity.playerId !== undefined ? { player_id:identity.playerId } : {}),
  };
}

function normalizeIncident(event, namesById = new Map()) {
  const source = object(event);
  if (!source) return event;
  const identity = playerIdentityFromRaw(source, namesById, ['short_name','shortName','name']);
  return {
    ...source,
    ...(identity.playerObject && !identity.directName && identity.recoveredName
      ? { player:{ ...identity.playerObject, name:identity.recoveredName } }
      : {}),
    ...(!identity.playerObject && source.player === undefined && source.player_name === undefined && identity.recoveredName
      ? { player_name:identity.recoveredName }
      : {}),
    ...(source.player_id === undefined && identity.playerId !== undefined ? { player_id:identity.playerId } : {}),
  };
}

function normalizeShotContainer(container, namesById) {
  const source = object(container);
  if (!source) return container;
  const key = ['shotmap','shot_map','shots'].find(name => Array.isArray(source[name]));
  if (!key) return source;
  return { ...source, [key]:source[key].map(shot => normalizeShot(shot, namesById)) };
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
  const playerStats = source.player_stats !== undefined
    ? normalizePlayerStatsEnvelope(source.player_stats)
    : source.player_stats;
  const namesById = rawPlayerNameIndex(playerStats);
  const stats = normalizeShotContainer(source.stats, namesById);
  const overviewKey = source.overview_meta !== undefined ? 'overview_meta' : source.overviewMeta !== undefined ? 'overviewMeta' : '';
  const overview = overviewKey ? normalizeShotContainer(source[overviewKey], namesById) : null;
  const topShotKey = ['shotmap','shot_map','shots'].find(name => Array.isArray(source[name]));
  const incidentsEnvelope = object(source.incidents);
  const incidents = incidentsEnvelope && Array.isArray(incidentsEnvelope.incidents)
    ? { ...incidentsEnvelope, incidents:incidentsEnvelope.incidents.map(event => normalizeIncident(event, namesById)) }
    : Array.isArray(source.incidents)
      ? source.incidents.map(event => normalizeIncident(event, namesById))
      : source.incidents;
  return {
    ...source,
    ...(stats ? { stats } : {}),
    ...(overviewKey && overview ? { [overviewKey]:overview } : {}),
    ...(topShotKey ? { [topShotKey]:source[topShotKey].map(shot => normalizeShot(shot, namesById)) } : {}),
    ...(source.incidents !== undefined ? { incidents } : {}),
    ...(source.player_stats !== undefined ? { player_stats:playerStats } : {}),
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
    return players.length === 0 || !players.some(player => {
      if (player?.rating === null || player?.rating === undefined || player?.rating === '') return false;
      return Number.isFinite(Number(player.rating));
    });
  }
  if (section === 'stats') {
    return list(adapted?.stats?.shots).some(shot => !text(shot?.player));
  }
  return false;
}
