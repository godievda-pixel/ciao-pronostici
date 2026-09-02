import { mkdir, writeFile } from 'node:fs/promises';
import {
  fetchBsdMatches,
  fetchBsdMatchSnapshot,
  fetchBsdStandings,
} from '../src/v23.2/bsd-provider.mjs';
import { isKnownTeamName } from '../src/v23.2/team-registry.mjs';

const API_KEY = 'probe-token';
const RANGE = Object.freeze({ from: '2026-07-01', to: '2027-06-30' });
const EXTERNAL_COMPETITIONS = Object.freeze(['coppa_italia', 'ucl', 'uel', 'uecl']);
const UEFA_COMPETITIONS = Object.freeze(['ucl', 'uel', 'uecl']);
const ITALIAN_RAW_NAMES = new Set([
  'Internazionale', 'Inter', 'AC Milan', 'Milan', 'Napoli', 'Roma', 'Juventus',
  'Fiorentina', 'Atalanta', 'Lazio', 'Bologna', 'Torino', 'Genoa', 'Como',
  'Udinese', 'Cagliari', 'Parma', 'Lecce', 'Hellas Verona', 'Sassuolo', 'Pisa',
  'Cremonese',
]);

const leagues = Object.freeze([
  { id: 10, name: 'Coppa Italia' },
  { id: 7, name: 'Champions League' },
  { id: 8, name: 'Europa League' },
  { id: 9, name: 'Conference League' },
]);
const seasons = Object.freeze({
  10: { id: 1810, name: 'Coppa Italia 2026/27', year: 2026, is_current: true },
  7: { id: 1807, name: 'Champions League 2026/27', year: 2026, is_current: true },
  8: { id: 1808, name: 'Europa League 2026/27', year: 2026, is_current: true },
  9: { id: 1809, name: 'Conference League 2026/27', year: 2026, is_current: true },
});

function event(id, leagueId, home, away, date, roundName, extra = {}) {
  return {
    id,
    league: { id: leagueId, name: leagues.find(item => item.id === leagueId)?.name || '' },
    season: seasons[leagueId],
    home_team: home,
    away_team: away,
    event_date: date,
    status: 'upcoming',
    round_name: roundName,
    ...extra,
  };
}

const eventsByLeague = Object.freeze({
  10: [
    event(
      1001,
      10,
      { id: 11, name: 'Pisa', country_code: 'IT' },
      { id: 12, name: 'Fiorentina', country_code: 'IT' },
      '2026-09-02T19:00:00+00:00',
      'Round of 32',
    ),
    event(
      1002,
      10,
      { id: 12, name: 'Fiorentina', country_code: 'IT' },
      { id: 11, name: 'Pisa', country_code: 'IT' },
      '2026-09-15T19:00:00+00:00',
      'Round of 32',
    ),
  ],
  7: [
    event(
      2001,
      7,
      { id: 77, name: 'Internazionale', country_code: 'IT' },
      { id: 359, name: 'Arsenal', country_code: 'GB' },
      '2026-09-16T19:00:00+00:00',
      'League Phase',
    ),
    event(
      2002,
      7,
      { id: 86, name: 'Barcelona', country_code: 'ES' },
      { id: 132, name: 'Bayern Munich', country_code: 'DE' },
      '2026-09-16T20:00:00+00:00',
      'League Phase',
    ),
  ],
  8: [
    event(
      3001,
      8,
      { id: 91, name: 'Roma', country_code: 'IT' },
      { id: 510, name: 'Benfica', country_code: 'PT' },
      '2026-09-17T19:00:00+00:00',
      'League Phase',
    ),
    event(
      3002,
      8,
      { id: 511, name: 'Porto', country_code: 'PT' },
      { id: 512, name: 'Ajax', country_code: 'NL' },
      '2026-09-17T20:00:00+00:00',
      'League Phase',
    ),
  ],
  9: [
    event(
      4001,
      9,
      { id: 12, name: 'Fiorentina', country_code: 'IT' },
      { id: 610, name: 'Levski Sofia', country_code: 'BG' },
      '2026-09-18T19:00:00+00:00',
      'League Phase',
    ),
    event(
      4002,
      9,
      { id: 611, name: 'Omonia Nicosia', country_code: 'CY' },
      { id: 612, name: 'Pafos FC', country_code: 'CY' },
      '2026-09-18T20:00:00+00:00',
      'League Phase',
    ),
  ],
});

const standingsByLeague = Object.freeze({
  7: [
    { position: 1, team_id: 57, team_name: 'Real Madrid', played: 8, won: 6, drawn: 1, lost: 1, goals_for: 18, goals_against: 7, goal_difference: 11, pts: 19 },
    { position: 2, team_id: 77, team_name: 'Inter', played: 8, won: 5, drawn: 2, lost: 1, goals_for: 14, goals_against: 8, goal_difference: 6, pts: 17 },
  ],
  8: [
    { position: 1, team_id: 511, team_name: 'Porto', played: 8, won: 6, drawn: 1, lost: 1, goals_for: 17, goals_against: 8, goal_difference: 9, pts: 19 },
    { position: 2, team_id: 91, team_name: 'Roma', played: 8, won: 5, drawn: 2, lost: 1, goals_for: 15, goals_against: 9, goal_difference: 6, pts: 17 },
  ],
  9: [
    { position: 1, team_id: 611, team_name: 'Omonia Nicosia', played: 6, won: 4, drawn: 1, lost: 1, goals_for: 12, goals_against: 5, goal_difference: 7, pts: 13 },
    { position: 2, team_id: 12, team_name: 'Fiorentina', played: 6, won: 4, drawn: 0, lost: 2, goals_for: 11, goals_against: 6, goal_difference: 5, pts: 12 },
  ],
});

const requests = [];
const fetchImpl = async (url, options = {}) => {
  const parsed = new URL(String(url));
  const authorization = new Headers(options.headers).get('authorization');
  requests.push({
    path: parsed.pathname,
    query: parsed.search,
    authorized: authorization === `Token ${API_KEY}`,
  });

  if (parsed.pathname === '/api/v2/leagues/') {
    return Response.json({ count: leagues.length, next: null, results: leagues });
  }

  const seasonMatch = parsed.pathname.match(/^\/api\/v2\/leagues\/(\d+)\/season\/$/);
  if (seasonMatch) {
    return Response.json(seasons[Number(seasonMatch[1])] || {});
  }

  const standingsMatch = parsed.pathname.match(/^\/api\/v2\/leagues\/(\d+)\/standings\/$/);
  if (standingsMatch) {
    return Response.json({ standings: standingsByLeague[Number(standingsMatch[1])] || [] });
  }

  const detailMatch = parsed.pathname.match(/^\/api\/v2\/events\/(\d+)\/$/);
  if (detailMatch) {
    const id = Number(detailMatch[1]);
    if (id === 2001) {
      return Response.json(event(
        2001,
        7,
        { id: 77, name: 'Internazionale', country_code: 'IT' },
        { id: 359, name: 'Arsenal', country_code: 'GB' },
        '2026-09-16T19:00:00+00:00',
        'League Phase',
        { status: 'live', current_minute: 67, home_score: 2, away_score: 1 },
      ));
    }
    return Response.json({ code: 'not_found' }, { status: 404 });
  }

  if (parsed.pathname === '/api/v2/events/') {
    const leagueId = Number(parsed.searchParams.get('league_id'));
    const rows = eventsByLeague[leagueId] || [];
    return Response.json({ count: rows.length, next: null, results: rows });
  }

  throw new Error(`Unexpected BSD probe URL: ${parsed.pathname}${parsed.search}`);
};

function rawTeamName(team) {
  return String(team?.rawName || team?.name || '').trim();
}

function isItalianTeam(team) {
  const code = String(team?.countryCode || '').toUpperCase();
  if (code === 'IT' || code === 'ITA') return true;
  return ITALIAN_RAW_NAMES.has(rawTeamName(team));
}

function collectUnknownTeamNames(matchesByCompetition, standingsByCompetition) {
  const unknownTeamNames = new Set();
  for (const matches of Object.values(matchesByCompetition)) {
    for (const match of matches) {
      for (const team of [match?.homeTeam, match?.awayTeam]) {
        const raw = rawTeamName(team);
        if (raw && !isKnownTeamName(raw)) unknownTeamNames.add(raw);
      }
    }
  }
  for (const rows of Object.values(standingsByCompetition)) {
    for (const row of rows) {
      const raw = rawTeamName(row?.team);
      if (raw && !isKnownTeamName(raw)) unknownTeamNames.add(raw);
    }
  }
  return [...unknownTeamNames].sort((a, b) => a.localeCompare(b));
}

const matchesByCompetition = {};
for (const competition of EXTERNAL_COMPETITIONS) {
  matchesByCompetition[competition] = await fetchBsdMatches({
    competition,
    ...RANGE,
    apiKey: API_KEY,
    fetchImpl,
  });
}

const standingsByCompetition = {};
for (const competition of UEFA_COMPETITIONS) {
  standingsByCompetition[competition] = await fetchBsdStandings({
    competition,
    apiKey: API_KEY,
    fetchImpl,
  });
}

const snapshot = await fetchBsdMatchSnapshot({
  competition: 'ucl',
  matchId: 'ucl:2001',
  apiKey: API_KEY,
  fetchImpl,
});

const foreignVsForeign = Object.fromEntries(UEFA_COMPETITIONS.map(competition => [
  competition,
  matchesByCompetition[competition].some(match => !isItalianTeam(match.homeTeam) && !isItalianTeam(match.awayTeam)),
]));
const unknownTeamNames = collectUnknownTeamNames(matchesByCompetition, standingsByCompetition);
const coppaMatches = matchesByCompetition.coppa_italia;
const duplicateTie = {
  inputCount: eventsByLeague[10].length,
  outputCount: coppaMatches.length,
  collapsed: eventsByLeague[10].length === 2 && coppaMatches.length === 1,
  keptMatchId: coppaMatches[0]?.matchId || null,
};

if (EXTERNAL_COMPETITIONS.some(competition => !matchesByCompetition[competition]?.length)) {
  throw new Error('BSD provider probe has an empty external competition feed');
}
if (UEFA_COMPETITIONS.some(competition => !standingsByCompetition[competition]?.length)) {
  throw new Error('BSD provider probe has an empty UEFA standings feed');
}
if (Object.values(foreignVsForeign).some(value => value !== true)) {
  throw new Error('BSD provider probe did not retain a foreign-vs-foreign UEFA fixture');
}
if (!duplicateTie.collapsed || duplicateTie.keptMatchId !== 'coppa_italia:1002') {
  throw new Error('BSD provider probe failed the Coppa single-leg duplicate guard');
}
if (snapshot.matchId !== 'ucl:2001' || snapshot.status !== 'live' || snapshot.homeScore !== 2 || snapshot.awayScore !== 1 || snapshot.minute !== 67) {
  throw new Error('BSD provider probe failed the live snapshot contract');
}
if (requests.some(item => !item.authorized)) {
  throw new Error('BSD provider did not authenticate every request');
}
if (requests.some(item => item.path.includes('/teams/'))) {
  throw new Error('BSD provider unexpectedly requested an Italian-team filter');
}
if (requests.some(item => /espn/i.test(item.path))) {
  throw new Error('ESPN URL leaked into BSD provider flow');
}

const report = {
  ok: true,
  provider: 'bsd-football-v2',
  base: 'https://sports.bzzoiro.com/api/v2',
  requestCount: requests.length,
  requestPaths: requests.map(item => item.path),
  authScheme: 'Token',
  competitions: Object.fromEntries(EXTERNAL_COMPETITIONS.map(competition => [competition, {
    matchCount: matchesByCompetition[competition].length,
    standingsCount: standingsByCompetition[competition]?.length ?? null,
    foreignVsForeign: foreignVsForeign[competition] ?? null,
  }])),
  unknownTeamNames,
  duplicateTie,
  snapshot: {
    competition: snapshot.competition,
    matchId: snapshot.matchId,
    status: snapshot.status,
    minute: snapshot.minute,
    homeScore: snapshot.homeScore,
    awayScore: snapshot.awayScore,
  },
};

await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/bsd-provider-probe.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
