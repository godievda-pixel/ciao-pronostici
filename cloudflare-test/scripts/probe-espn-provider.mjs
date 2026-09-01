import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'artifacts/espn-provider-probe.json');
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const PROBES = Object.freeze([
  {
    key: 'coppa_italia',
    kind: 'scoreboard',
    url: `${ESPN_BASE}/ita.coppa_italia/scoreboard?dates=20260801-20260930`,
  },
  {
    key: 'ucl',
    kind: 'scoreboard',
    url: `${ESPN_BASE}/uefa.champions/scoreboard?dates=20260801-20260930`,
  },
  {
    key: 'uel',
    kind: 'scoreboard',
    url: `${ESPN_BASE}/uefa.europa/scoreboard?dates=20260801-20260930`,
  },
  {
    key: 'uecl',
    kind: 'scoreboard',
    url: `${ESPN_BASE}/uefa.europa.conf/scoreboard?dates=20260801-20260930`,
  },
  {
    key: 'italy_teams',
    kind: 'teams',
    url: `${ESPN_BASE}/ita.1/teams`,
  },
]);

function keys(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).sort()
    : [];
}

function scoreboardShape(json) {
  const event = Array.isArray(json?.events) ? json.events[0] : null;
  const competition = Array.isArray(event?.competitions) ? event.competitions[0] : null;
  const competitor = Array.isArray(competition?.competitors) ? competition.competitors[0] : null;
  return {
    rootKeys: keys(json),
    leagueKeys: keys(Array.isArray(json?.leagues) ? json.leagues[0] : null),
    eventCount: Array.isArray(json?.events) ? json.events.length : -1,
    eventKeys: keys(event),
    competitionKeys: keys(competition),
    competitorKeys: keys(competitor),
    teamKeys: keys(competitor?.team),
  };
}

function teamsShape(json) {
  const sport = Array.isArray(json?.sports) ? json.sports[0] : null;
  const league = Array.isArray(sport?.leagues) ? sport.leagues[0] : null;
  const teamEntry = Array.isArray(league?.teams) ? league.teams[0] : null;
  return {
    rootKeys: keys(json),
    sportKeys: keys(sport),
    leagueKeys: keys(league),
    teamCount: Array.isArray(league?.teams) ? league.teams.length : -1,
    teamEntryKeys: keys(teamEntry),
    teamKeys: keys(teamEntry?.team),
  };
}

export async function probeEspnProvider(fetchImpl = fetch) {
  const results = [];

  for (const probe of PROBES) {
    const response = await fetchImpl(probe.url, {
      headers: {
        accept: 'application/json',
        'cache-control': 'no-cache',
      },
    });
    const type = String(response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok || !type.includes('json')) {
      throw new Error(`${probe.key} probe failed: HTTP ${response.status} ${type}`);
    }

    const json = await response.json();
    const shape = probe.kind === 'teams' ? teamsShape(json) : scoreboardShape(json);
    if (probe.kind === 'scoreboard' && shape.eventCount <= 0) {
      throw new Error(`${probe.key} probe returned no events for validation window`);
    }
    if (probe.kind === 'teams' && shape.teamCount <= 0) {
      throw new Error(`${probe.key} probe returned no teams`);
    }

    results.push({
      key: probe.key,
      kind: probe.kind,
      status: response.status,
      contentType: type.split(';')[0],
      shape,
    });
  }

  return {
    observedAt: new Date().toISOString(),
    provider: 'espn-site-api',
    authentication: 'none',
    results,
  };
}

export async function main() {
  const result = await probeEspnProvider();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    provider: result.provider,
    probes: result.results.map(item => ({
      key: item.key,
      status: item.status,
      count: item.shape.eventCount ?? item.shape.teamCount,
    })),
    output: outputPath,
  }));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
