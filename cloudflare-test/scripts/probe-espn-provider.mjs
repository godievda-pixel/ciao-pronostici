import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildEspnScoreboardUrl,
  fetchEspnMatches,
  fetchItalianEspnTeamIds,
} from '../src/v23.2/espn-provider.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'artifacts/espn-provider-probe.json');
const RANGE = Object.freeze({ from: '2026-07-01', to: '2027-06-30' });
const COMPETITIONS = Object.freeze(['coppa_italia', 'ucl', 'uel', 'uecl']);

async function fetchRawCount(competition, fetchImpl) {
  const url = buildEspnScoreboardUrl(competition, RANGE.from, RANGE.to);
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json',
      'cache-control': 'no-cache',
    },
  });
  const type = String(response.headers.get('content-type') || '').toLowerCase();
  if (!response.ok || !type.includes('json')) {
    return { status: response.status, contentType: type, rawCount: -1 };
  }
  const json = await response.json();
  return {
    status: response.status,
    contentType: type.split(';')[0],
    rawCount: Array.isArray(json?.events) ? json.events.length : -1,
  };
}

export async function probeEspnProvider(fetchImpl = fetch) {
  const italianTeamIds = await fetchItalianEspnTeamIds({ fetchImpl });
  const results = [];

  for (const competition of COMPETITIONS) {
    try {
      const raw = await fetchRawCount(competition, fetchImpl);
      const matches = await fetchEspnMatches({
        competition,
        from: RANGE.from,
        to: RANGE.to,
        fetchImpl,
      });
      results.push({
        competition,
        ...raw,
        finalCount: matches.length,
        sample: matches.slice(0, 3).map(match => ({
          matchId: match.matchId,
          kickoffAt: match.kickoffAt,
          home: match.homeTeam?.name,
          away: match.awayTeam?.name,
          stage: match.stage,
          round: match.round,
        })),
      });
    } catch (error) {
      results.push({
        competition,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    observedAt: new Date().toISOString(),
    provider: 'espn-site-api',
    range: RANGE,
    italianTeamCount: italianTeamIds.size,
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
    range: result.range,
    italianTeamCount: result.italianTeamCount,
    probes: result.results.map(item => ({
      competition: item.competition,
      status: item.status,
      rawCount: item.rawCount,
      finalCount: item.finalCount,
      error: item.error,
      sample: item.sample,
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
