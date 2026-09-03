const COVERAGE_KEYS = Object.freeze([
  'overview',
  'stats',
  'events',
  'lineups',
  'players',
  'momentum',
  'shotmap',
]);

function text(value) {
  return String(value ?? '').trim();
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
    coverage:canonicalCoverage(coverage),
  });
}

export { COVERAGE_KEYS };
