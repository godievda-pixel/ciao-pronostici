import { CURRENT_API } from '../src/modular/data/api-contract.mjs';

const CHECKS = Object.freeze([
  ['core', CURRENT_API.core],
  ['matchCenter', CURRENT_API.matchCenter],
  ['clubProfile', CURRENT_API.clubProfile],
  ['live', CURRENT_API.live],
  ['schedule', CURRENT_API.schedule],
  ['predictionInsights', CURRENT_API.predictionInsights],
]);

async function probe(name, url, fetchImpl = fetch) {
  const started = Date.now();
  try {
    const response = await fetchImpl(url, { method:'GET', headers:{ 'cache-control':'no-cache' } });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
    return {
      name,
      ok: response.ok,
      status: response.status,
      service: payload?.service || null,
      version: payload?.version ?? null,
      latency_ms: Date.now() - started,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      status: 0,
      service: null,
      version: null,
      latency_ms: Date.now() - started,
      error: String(error?.message || error),
    };
  }
}

export async function probeCurrentApi({ fetchImpl = fetch } = {}) {
  const checks = [];
  for (const [name, url] of CHECKS) checks.push(await probe(name, url, fetchImpl));
  return {
    ok: checks.every(x => x.ok),
    provider: CURRENT_API.provider.name,
    competitions: [...CURRENT_API.competitions],
    checks,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  probeCurrentApi().then(result => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  }).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
