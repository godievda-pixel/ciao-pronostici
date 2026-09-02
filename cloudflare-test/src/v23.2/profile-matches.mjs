import { dedupeMatches } from './match-deduper.mjs';
import { normalizeTeamAlias } from './team-registry.mjs';

function text(value) {
  return String(value ?? '').trim();
}

function teamAliases(team = {}) {
  const values = [
    team?.name,
    team?.rawName,
    ...(Array.isArray(team?.aliases) ? team.aliases : []),
  ];
  return new Set(values.map(normalizeTeamAlias).filter(Boolean));
}

function teamMatchesIdentity(team, identity) {
  const wanted = teamAliases(identity);
  if (!wanted.size) return false;
  const offered = teamAliases(team);
  for (const alias of offered) {
    if (wanted.has(alias)) return true;
  }
  return false;
}

function flattenCompetitionData(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.matches)) return data.matches;

  const rows = [];
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) rows.push(...value);
    else if (Array.isArray(value?.matches)) rows.push(...value.matches);
  }
  return rows;
}

function chronological(matches) {
  return [...matches].sort((a, b) => {
    const aTime = Date.parse(a?.kickoffAt || '');
    const bTime = Date.parse(b?.kickoffAt || '');
    const safeA = Number.isFinite(aTime) ? aTime : Number.MAX_SAFE_INTEGER;
    const safeB = Number.isFinite(bTime) ? bTime : Number.MAX_SAFE_INTEGER;
    return safeA - safeB || text(a?.matchId).localeCompare(text(b?.matchId));
  });
}

export function matchesForClub(allCompetitionData, clubIdentity = {}) {
  const matches = flattenCompetitionData(allCompetitionData)
    .filter(match => (
      teamMatchesIdentity(match?.homeTeam, clubIdentity)
      || teamMatchesIdentity(match?.awayTeam, clubIdentity)
    ));
  return chronological(dedupeMatches(matches));
}

export function mergeClubMatches(legacyMatches = [], tournamentMatches = []) {
  return chronological(dedupeMatches([
    ...(Array.isArray(legacyMatches) ? legacyMatches : []),
    ...(Array.isArray(tournamentMatches) ? tournamentMatches : []),
  ]));
}

export function profileCompetitionMatches(allCompetitionData, clubIdentity = {}) {
  return matchesForClub(allCompetitionData, clubIdentity)
    .filter(match => match?.competition && match.competition !== 'serie_a');
}
