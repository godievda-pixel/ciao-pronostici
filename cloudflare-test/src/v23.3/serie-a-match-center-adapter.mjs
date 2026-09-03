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

function canonicalTeam(value) {
  const source = object(value) || {};
  const id = finite(source.id ?? source.team_id ?? source.teamId);
  const name = text(source.name ?? source.team_name ?? source.teamName);
  const crestUrl = text(source.crestUrl ?? source.crest_url ?? source.logoUrl ?? source.logo_url ?? source.logo);
  return Object.freeze({ id, name, crestUrl });
}

function canonicalLegacyMatch(value) {
  const match = object(value) || {};
  const rawId = match.matchId ?? match.match_id ?? match.id;
  const idText = text(rawId);
  const matchId = idText.startsWith('serie_a:') ? idText : `serie_a:${idText}`;
  return Object.freeze({
    competition:'serie_a',
    matchId,
    kickoffAt:text(match.kickoffAt ?? match.kickoff_at ?? match.starts_at),
    status:text(match.status).toLowerCase(),
    minute:finite(match.minute),
    homeScore:finite(match.homeScore ?? match.home_score),
    awayScore:finite(match.awayScore ?? match.away_score),
    homeTeam:canonicalTeam(match.homeTeam ?? match.home_team ?? match.home),
    awayTeam:canonicalTeam(match.awayTeam ?? match.away_team ?? match.away),
    round:match.round ?? null,
    stage:text(match.stage),
    predictionDeadline:text(match.predictionDeadline ?? match.prediction_deadline),
  });
}

function normalizePrediction(value) {
  const source = object(value);
  if (!source) return null;
  const homeScore = finite(source.homeScore ?? source.home_score ?? source.pred_home_score);
  const awayScore = finite(source.awayScore ?? source.away_score ?? source.pred_away_score);
  if (homeScore === null && awayScore === null) return source;
  return Object.freeze({ ...source, homeScore, awayScore });
}

function normalizeOverview(value) {
  const source = object(value) || {};
  return {
    venue:source.venue,
    referee:source.referee,
    form:source.form,
    prediction:normalizePrediction(source.prediction),
    predictionSplit:source.predictionSplit ?? source.prediction_split ?? null,
    momentum:source.momentum ?? null,
    shotmap:source.shotmap ?? source.shot_map ?? null,
  };
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

function hasOverview(source) {
  if (!object(source)) return false;
  return Boolean(
    object(source.venue)
    || object(source.referee)
    || object(source.form)
    || object(source.prediction)
    || object(source.predictionSplit ?? source.prediction_split)
    || array(source.momentum)
    || array(source.shotmap ?? source.shot_map)
  );
}

export function adaptSerieALegacyMatchCenter(raw = {}) {
  const source = object(raw) || {};
  const match = canonicalLegacyMatch(source.match);
  const overviewRaw = object(source.overview_meta ?? source.overviewMeta);
  const statsRaw = object(source.stats?.stats ?? source.stats);
  const eventsRaw = array(source.incidents?.incidents ?? source.incidents);
  const lineupsRaw = object(source.lineups?.lineups ?? source.lineups);
  const playersRaw = array(source.player_stats?.player_stats ?? source.playerStats ?? source.player_stats);
  const capabilitiesRaw = object(source.capabilities) || {};

  const coverage = canonicalCoverage({
    overview:hasOverview(overviewRaw),
    stats:statsRaw !== null,
    events:eventsRaw !== null,
    lineups:lineupsRaw !== null,
    players:playersRaw !== null,
    momentum:Array.isArray(overviewRaw?.momentum),
    shotmap:Array.isArray(overviewRaw?.shotmap ?? overviewRaw?.shot_map),
  });

  const overview = canonicalOverviewSection(normalizeOverview(overviewRaw));
  const stats = canonicalStatsSection(statsRaw || {});
  const events = canonicalEventsSection(eventsRaw || []);
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
