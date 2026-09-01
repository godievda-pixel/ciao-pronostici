import { getCompetitionConfig } from './competition-config.mjs';

export function sortChronologically(matches) {
  return [...matches].sort(
    (a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt),
  );
}

export function matchesForCompetition(matches, key) {
  getCompetitionConfig(key);
  return sortChronologically(
    matches.filter(match => match.competition === key),
  );
}

export function groupForCompetition(matches, key) {
  const config = getCompetitionConfig(key);
  const groups = new Map();

  for (const match of matchesForCompetition(matches, key)) {
    const rawKey = config.navigation === 'rounds' ? match.round : match.stage;
    const groupKey = String(rawKey ?? '');
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(match);
  }

  return [...groups.entries()].map(([groupKey, groupMatches]) => ({
    key: groupKey,
    matches: sortChronologically(groupMatches),
  }));
}

export function availablePredictions(matches, now = Date.now()) {
  return sortChronologically(matches.filter(match => {
    if (match.status === 'finished' || match.status === 'cancelled') return false;
    const deadline = Date.parse(match.predictionDeadline);
    return Number.isFinite(deadline) && deadline > now;
  }));
}

export function nextMatchForTeam(matches, teamId, now = Date.now()) {
  const wanted = String(teamId);
  return sortChronologically(matches).find(match => (
    Date.parse(match.kickoffAt) >= now
    && (match.homeTeam.id === wanted || match.awayTeam.id === wanted)
  )) || null;
}
