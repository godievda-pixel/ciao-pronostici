function text(value) {
  return String(value ?? '').trim();
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function canonicalMatchCenterSnapshot(match = {}, details = {}) {
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
    venue:text(details?.venue || match?.venue),
    events:Object.freeze(list(details?.events)),
    statistics:Object.freeze(list(details?.statistics)),
    lineups:Object.freeze(list(details?.lineups)),
    prediction:details?.prediction || null,
    predictionDeadline:text(details?.predictionDeadline || match?.predictionDeadline),
  });
}
