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

function mergeTeam(previous, incoming) {
  const oldTeam = previous && typeof previous === 'object' ? previous : null;
  const newTeam = incoming && typeof incoming === 'object' ? incoming : null;
  if (!oldTeam) return newTeam;
  if (!newTeam) return oldTeam;
  const merged = { ...oldTeam, ...newTeam };
  if (!text(newTeam.name) && text(oldTeam.name)) merged.name = oldTeam.name;
  if (!text(newTeam.crestUrl) && text(oldTeam.crestUrl)) merged.crestUrl = oldTeam.crestUrl;
  return merged;
}

function canonicalBootstrap(match = {}, previous = null) {
  return Object.freeze({
    competition:text(match?.competition),
    matchId:text(match?.matchId),
    homeTeam:mergeTeam(previous?.homeTeam, match?.homeTeam) || null,
    awayTeam:mergeTeam(previous?.awayTeam, match?.awayTeam) || null,
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
  const previous = BOOTSTRAPS.get(key) || null;
  if (previous) BOOTSTRAPS.delete(key);
  BOOTSTRAPS.set(key, canonicalBootstrap(match, previous));
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
