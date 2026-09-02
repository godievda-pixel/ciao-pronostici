function text(value) {
  return String(value ?? '').trim();
}

function teamIdentity(team = {}) {
  return text(team?.id || team?.name || team?.rawName).toLowerCase();
}

export function matchFingerprint(match = {}) {
  return [
    text(match.competition).toLowerCase(),
    text(match.stage).toLowerCase(),
    text(match.kickoffAt),
    teamIdentity(match.homeTeam),
    teamIdentity(match.awayTeam),
  ].join('|');
}

export function dedupeMatches(matches = []) {
  const byId = new Set();
  const byFingerprint = new Set();
  const result = [];

  for (const match of Array.isArray(matches) ? matches : []) {
    const id = text(match?.matchId);
    const fingerprint = matchFingerprint(match);
    if (id && byId.has(id)) continue;
    if (fingerprint && byFingerprint.has(fingerprint)) continue;
    if (id) byId.add(id);
    if (fingerprint) byFingerprint.add(fingerprint);
    result.push(match);
  }

  return result;
}
