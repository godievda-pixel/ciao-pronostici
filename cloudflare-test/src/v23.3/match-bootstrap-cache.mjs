const MAX_BOOTSTRAPS = 100;
const BOOTSTRAPS = new Map();

function text(value) {
  return String(value ?? '').trim();
}

function keyFor(competition, matchId) {
  const competitionKey = text(competition);
  const id = text(matchId);
  return competitionKey && id ? `${competitionKey}|${id}` : '';
}

function canonicalBootstrap(match = {}) {
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
    venue:text(match?.venue),
    predictionDeadline:text(match?.predictionDeadline),
  });
}

export function rememberMatchBootstrap(match = {}) {
  const key = keyFor(match?.competition, match?.matchId);
  if (!key) return;
  if (BOOTSTRAPS.has(key)) BOOTSTRAPS.delete(key);
  BOOTSTRAPS.set(key, canonicalBootstrap(match));
  while (BOOTSTRAPS.size > MAX_BOOTSTRAPS) {
    const oldest = BOOTSTRAPS.keys().next().value;
    if (!oldest) break;
    BOOTSTRAPS.delete(oldest);
  }
}

export function getMatchBootstrap(competition, matchId) {
  const key = keyFor(competition, matchId);
  return key ? BOOTSTRAPS.get(key) || null : null;
}
