import { normalizeMatch, shouldIncludeMatch } from './match-normalizer.mjs';

export const ESPN_COMPETITION_SLUGS = Object.freeze({
  coppa_italia: 'ita.coppa_italia',
  ucl: 'uefa.champions',
  uel: 'uefa.europa',
  uecl: 'uefa.europa.conf',
});

function text(value) {
  return String(value ?? '').trim();
}

function seasonLabel(year) {
  const value = Number(year);
  if (!Number.isFinite(value) || value < 1900) return '';
  return `${value}/${String(value + 1).slice(-2)}`;
}

function statusCode(event, competition) {
  const type = competition?.status?.type || event?.status?.type || {};
  const name = text(type.name).toUpperCase();
  const detail = text(type.description || type.detail).toUpperCase();

  if (name.includes('POSTPON') || detail.includes('POSTPON')) return 'PST';
  if (name.includes('CANCEL') || detail.includes('CANCEL')) return 'CANC';
  if (type.completed || type.state === 'post') return 'FT';
  if (type.state === 'in') return 'LIVE';
  return 'NS';
}

function minuteFrom(competition) {
  const value = text(
    competition?.status?.displayClock
    || competition?.status?.type?.detail,
  );
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function titleCaseSlug(value) {
  return text(value)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function stageFrom(event, competition, leagueName) {
  const note = text(competition?.altGameNote);
  if (note) {
    const prefix = `${text(leagueName)},`;
    if (prefix !== ',' && note.toLowerCase().startsWith(prefix.toLowerCase())) {
      return note.slice(prefix.length).trim();
    }
    const comma = note.indexOf(',');
    if (comma >= 0) return note.slice(comma + 1).trim();
  }

  const slug = text(event?.season?.slug);
  const labels = {
    'league-phase': 'League Phase',
    'knockout-round-playoffs': 'Knockout Round Playoffs',
    'round-of-16': 'Round of 16',
    'rd-of-16': 'Round of 16',
    quarterfinals: 'Quarterfinals',
    semifinals: 'Semifinals',
    final: 'Final',
  };
  return labels[slug] || titleCaseSlug(slug);
}

function toTeam(competitor, italianTeamIds) {
  const team = competitor?.team || {};
  const id = text(team.id ?? competitor?.id);
  return {
    id,
    name: text(team.displayName || team.name),
    logo: text(team.logo || team.logos?.[0]?.href),
    country_code: italianTeamIds.has(id) ? 'ITA' : '',
  };
}

function scoreFor(competitor, status) {
  if (status !== 'LIVE' && status !== 'FT') return null;
  const value = text(competitor?.score);
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function extractEspnTeamIds(payload) {
  const ids = new Set();
  const leagues = Array.isArray(payload?.sports?.[0]?.leagues)
    ? payload.sports[0].leagues
    : [];

  for (const league of leagues) {
    const teams = Array.isArray(league?.teams) ? league.teams : [];
    for (const entry of teams) {
      const id = text(entry?.team?.id);
      if (id) ids.add(id);
    }
  }

  return [...ids].sort();
}

export function adaptEspnScoreboard(payload, competition, options = {}) {
  if (!Object.prototype.hasOwnProperty.call(ESPN_COMPETITION_SLUGS, competition)) {
    throw new Error(`Unsupported ESPN competition: ${competition}`);
  }

  const italianTeamIds = options.italianTeamIds instanceof Set
    ? options.italianTeamIds
    : new Set(options.italianTeamIds || []);
  const leagueName = text(payload?.leagues?.[0]?.name);
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const matches = [];

  for (const event of events) {
    try {
      const providerCompetition = Array.isArray(event?.competitions)
        ? event.competitions[0]
        : null;
      if (!providerCompetition) continue;

      const competitors = Array.isArray(providerCompetition.competitors)
        ? providerCompetition.competitors
        : [];
      const home = competitors.find(item => item?.homeAway === 'home') || competitors[0];
      const away = competitors.find(item => item?.homeAway === 'away') || competitors[1];
      if (!home || !away) continue;

      const status = statusCode(event, providerCompetition);
      const raw = {
        id: text(event?.id || providerCompetition?.id),
        season: seasonLabel(event?.season?.year),
        kickoff_at: text(providerCompetition?.date || event?.date),
        status,
        minute: status === 'LIVE' ? minuteFrom(providerCompetition) : null,
        stage: stageFrom(event, providerCompetition, leagueName),
        home: toTeam(home, italianTeamIds),
        away: toTeam(away, italianTeamIds),
        home_score: scoreFor(home, status),
        away_score: scoreFor(away, status),
        venue: text(
          providerCompetition?.venue?.fullName
          || event?.venue?.fullName
          || event?.venue?.displayName,
        ),
        rawVersion: 'espn-site-v2',
      };
      if (!raw.id) continue;

      const match = normalizeMatch(raw, competition);
      if (shouldIncludeMatch(match)) matches.push(match);
    } catch {
      // One malformed provider event must not break the whole competition feed.
    }
  }

  return matches.sort((a, b) =>
    Date.parse(a.kickoffAt || 0) - Date.parse(b.kickoffAt || 0)
    || a.matchId.localeCompare(b.matchId)
  );
}
