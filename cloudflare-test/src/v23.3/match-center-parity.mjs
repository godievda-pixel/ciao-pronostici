export const SERIE_A_LEGACY_PARITY_GATE = 'serie_a_legacy_parity_gate';

const PARITY_KEYS = Object.freeze([
  'hero',
  'form',
  'matchInfo',
  'predictions',
  'momentum',
  'shotmap',
  'stats',
  'events',
  'lineups',
  'players',
  'navigation',
  'live',
]);

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function array(value) {
  return Array.isArray(value) ? value : null;
}

function hasText(value) {
  return String(value ?? '').trim().length > 0;
}

function hasHero(legacy, canonical) {
  const match = object(legacy?.match);
  const base = object(canonical?.base);
  return Boolean(
    match
    && base
    && hasText(base.matchId)
    && hasText(base.competition)
    && hasText(base.homeTeam?.name)
    && hasText(base.awayTeam?.name)
  );
}

function hasForm(legacy, canonical) {
  const legacyForm = object(legacy?.overview_meta?.form ?? legacy?.overviewMeta?.form);
  const canonicalForm = object(canonical?.overview?.form);
  return Boolean(
    legacyForm
    && canonicalForm
    && array(legacyForm.home)
    && array(legacyForm.away)
    && array(canonicalForm.home)
    && array(canonicalForm.away)
  );
}

function hasMatchInfo(legacy, canonical) {
  const overview = object(legacy?.overview_meta ?? legacy?.overviewMeta);
  return Boolean(
    overview
    && (object(overview.venue) || object(overview.referee))
    && canonical?.overview
    && (hasText(canonical.overview?.venue?.name) || hasText(canonical.overview?.referee?.name))
  );
}

function hasPredictions(legacy, canonical) {
  const overview = object(legacy?.overview_meta ?? legacy?.overviewMeta);
  return Boolean(
    overview
    && object(overview.prediction)
    && object(overview.predictionSplit ?? overview.prediction_split)
    && canonical?.overview?.prediction
    && canonical?.overview?.predictionSplit
  );
}

function hasMomentum(legacy, canonical) {
  const overview = object(legacy?.overview_meta ?? legacy?.overviewMeta);
  return Boolean(
    array(overview?.momentum)
    && canonical?.coverage?.momentum === true
    && Array.isArray(canonical?.overview?.momentum)
  );
}

function hasShotmap(legacy, canonical) {
  const overview = object(legacy?.overview_meta ?? legacy?.overviewMeta);
  return Boolean(
    array(overview?.shotmap ?? overview?.shot_map)
    && canonical?.coverage?.shotmap === true
    && Array.isArray(canonical?.overview?.shotmap)
  );
}

function hasStats(legacy, canonical) {
  return Boolean(
    object(legacy?.stats?.stats ?? legacy?.stats)
    && canonical?.coverage?.stats === true
    && object(canonical?.stats)
  );
}

function hasEvents(legacy, canonical) {
  return Boolean(
    array(legacy?.incidents?.incidents ?? legacy?.incidents)
    && canonical?.coverage?.events === true
    && Array.isArray(canonical?.events)
  );
}

function hasLineups(legacy, canonical) {
  return Boolean(
    object(legacy?.lineups?.lineups ?? legacy?.lineups)
    && canonical?.coverage?.lineups === true
    && object(canonical?.lineups)
  );
}

function hasPlayers(legacy, canonical) {
  return Boolean(
    array(legacy?.player_stats?.player_stats ?? legacy?.playerStats ?? legacy?.player_stats)
    && canonical?.coverage?.players === true
    && Array.isArray(canonical?.players)
  );
}

export function evaluateSerieAParity(legacyFixture = {}, canonicalFixture = {}) {
  const legacy = object(legacyFixture) || {};
  const canonical = object(canonicalFixture) || {};
  const checks = Object.freeze({
    hero:hasHero(legacy, canonical),
    form:hasForm(legacy, canonical),
    matchInfo:hasMatchInfo(legacy, canonical),
    predictions:hasPredictions(legacy, canonical),
    momentum:hasMomentum(legacy, canonical),
    shotmap:hasShotmap(legacy, canonical),
    stats:hasStats(legacy, canonical),
    events:hasEvents(legacy, canonical),
    lineups:hasLineups(legacy, canonical),
    players:hasPlayers(legacy, canonical),
    navigation:legacy?.capabilities?.navigation === true && canonical?.capabilities?.navigation === true,
    live:legacy?.capabilities?.live === true && canonical?.capabilities?.live === true,
  });
  const missing = Object.freeze(PARITY_KEYS.filter(key => checks[key] !== true));
  return Object.freeze({
    passed:missing.length === 0,
    missing,
    checks,
  });
}

export { PARITY_KEYS };
