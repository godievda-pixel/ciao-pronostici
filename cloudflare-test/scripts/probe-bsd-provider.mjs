import { mkdir, writeFile } from 'node:fs/promises';
import { fetchBsdMatches } from '../src/v23.2/bsd-provider.mjs';

const requests = [];
const fetchImpl = async (url, options = {}) => {
  const value = String(url);
  const authorization = new Headers(options.headers).get('authorization');
  requests.push({ url: value, authorization });

  if (value.includes('/api/v2/leagues/?')) {
    return Response.json({ count: 1, next: null, results: [{ id: 7, name: 'Champions League', country: 'Europe' }] });
  }
  if (value.includes('/api/v2/leagues/7/season/')) {
    return Response.json({ id: 2607, name: 'Champions League 2026/27', year: 2026, is_current: true });
  }
  if (value.includes('/api/v2/events/?')) {
    return Response.json({ count: 2, next: null, results: [
      {
        id: 1001,
        league: { id: 7, name: 'Champions League' },
        season: { id: 2607, name: 'Champions League 2026/27', year: 2026 },
        home_team: { id: 110, name: 'Internazionale', country_code: 'IT' },
        away_team: { id: 359, name: 'Arsenal', country_code: 'GB' },
        event_date: '2026-09-16T19:00:00+00:00',
        status: 'upcoming',
        round_name: 'League Phase',
      },
      {
        id: 1002,
        league: { id: 7, name: 'Champions League' },
        season: { id: 2607, name: 'Champions League 2026/27', year: 2026 },
        home_team: { id: 86, name: 'Barcelona', country_code: 'ES' },
        away_team: { id: 132, name: 'Bayern Munich', country_code: 'DE' },
        event_date: '2026-09-16T20:00:00+00:00',
        status: 'upcoming',
        round_name: 'League Phase',
      },
    ] });
  }
  throw new Error(`Unexpected BSD probe URL: ${value}`);
};

const matches = await fetchBsdMatches({
  competition: 'ucl',
  from: '2026-07-01',
  to: '2027-06-30',
  apiKey: 'probe-token',
  fetchImpl,
});

if (matches.length !== 2 || matches[0].matchId !== 'ucl:1001' || matches[1].matchId !== 'ucl:1002') {
  throw new Error('BSD provider did not keep the complete UCL competition feed');
}
if (requests.some(item => item.url.includes('/teams/'))) {
  throw new Error('BSD provider unexpectedly requested an Italian-team filter');
}
if (!requests.length || requests.some(item => item.authorization !== 'Token probe-token')) {
  throw new Error('BSD provider did not authenticate every request');
}
if (requests.some(item => /espn/i.test(item.url))) {
  throw new Error('ESPN URL leaked into BSD provider flow');
}

const report = {
  ok: true,
  provider: 'bsd-football-v2',
  base: 'https://sports.bzzoiro.com/api/v2',
  requestCount: requests.length,
  requestPaths: requests.map(item => new URL(item.url).pathname),
  authScheme: 'Token',
  fullCompetitionFeed: true,
  sampleMatches: matches.slice(0, 2),
};

await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/bsd-provider-probe.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
