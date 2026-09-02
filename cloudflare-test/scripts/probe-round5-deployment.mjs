import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const REQUIRED = Object.freeze([
  '/v23.3/index.mjs',
  '/v23.3/ranking-ui.mjs',
  '/v23.3/serie-a-legacy-bridge.mjs',
]);

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

async function fetchSource(path, { fetchImpl, origin }) {
  const url = new URL(path, origin);
  url.searchParams.set('round5_probe', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const response = await fetchImpl(url, {
    headers:{
      'cache-control':'no-cache, no-store, max-age=0',
      pragma:'no-cache',
    },
  });
  const source = await response.text();
  return { path, ok:response.ok, status:response.status, source };
}

function inspect(rows) {
  const byPath = new Map(rows.map(row => [row.path, row]));
  const index = byPath.get('/v23.3/index.mjs');
  const ranking = byPath.get('/v23.3/ranking-ui.mjs');
  const bridge = byPath.get('/v23.3/serie-a-legacy-bridge.mjs');

  const checks = Object.freeze({
    indexHasBridge:Boolean(index?.ok && index.source.includes("./serie-a-legacy-bridge.mjs")),
    rankingRound5:Boolean(
      ranking?.ok
      && ranking.source.includes('USER_FEEDBACK_ROUND5_BUILD')
      && ranking.source.includes('cw233-ranking-position-value')
      && ranking.source.includes('cw233-ranking-name')
      && ranking.source.includes('cw233-ranking-points-value')
      && ranking.source.includes('cw233-ranking-points-unit')
      && !ranking.source.includes('class="pos"')
      && !ranking.source.includes('class="person"')
      && !ranking.source.includes('class="pts"')
    ),
    serieAStableCrestBridge:Boolean(
      bridge?.ok
      && bridge.source.includes('/api/ciao-core-api-fast-v4')
      && bridge.source.includes("action:'state'")
      && bridge.source.includes('cw233-table-logo-fallback')
      && bridge.source.includes('hydrateSerieATableCrests')
    ),
  });
  return { checks, ok:Object.values(checks).every(Boolean) };
}

export async function probeRound5Deployment({
  fetchImpl = fetch,
  origin = DEFAULT_ORIGIN,
  attempts = 1,
  waitMs = 0,
} = {}) {
  let latest = null;
  const totalAttempts = Math.max(1, Math.trunc(Number(attempts) || 1));
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    const rows = await Promise.all(REQUIRED.map(path => fetchSource(path, { fetchImpl, origin })));
    const inspected = inspect(rows);
    latest = {
      ok:inspected.ok,
      attempt,
      observedAt:new Date().toISOString(),
      checks:inspected.checks,
      modules:rows.map(row => ({ path:row.path, ok:row.ok, status:row.status, bytes:Buffer.byteLength(row.source) })),
    };
    if (latest.ok) return latest;
    if (attempt < totalAttempts && waitMs > 0) await sleep(waitMs);
  }
  const error = new Error('round5_deployment_incomplete');
  error.report = latest;
  throw error;
}

async function runCli() {
  try {
    const report = await probeRound5Deployment({ attempts:10, waitMs:6_000 });
    await mkdir('artifacts', { recursive:true });
    await writeFile('artifacts/v23-3-round5-live.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } catch (error) {
    const report = error?.report || { ok:false, error:'round5_deployment_incomplete', observedAt:new Date().toISOString() };
    await mkdir('artifacts', { recursive:true });
    await writeFile('artifacts/v23-3-round5-live.json', JSON.stringify(report, null, 2));
    console.error(JSON.stringify(report));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runCli();
}
