import { CURRENT_API } from '../src/modular/data/api-contract.mjs';

export async function probeEndpoint(url, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation required');
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept:'application/json' },
    cache: 'no-store',
  });
  let payload = null;
  try { payload = await response.json(); } catch {}
  return {
    url,
    ok: response.ok,
    status: response.status,
    service: String(payload?.service || ''),
    version: payload?.version ?? null,
  };
}

export async function probeCurrentApi(options = {}) {
  const targets = [
    CURRENT_API.core,
    CURRENT_API.matchCenter,
    CURRENT_API.clubProfile,
    CURRENT_API.schedule,
  ];
  const results = [];
  for (const url of targets) {
    try { results.push(await probeEndpoint(url, options)); }
    catch (error) {
      results.push({ url, ok:false, status:0, service:'', version:null, error:String(error?.message || error) });
    }
  }
  return {
    mode: 'read-only',
    provider: CURRENT_API.provider.name,
    competitions: [...CURRENT_API.competitions],
    results,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  probeCurrentApi().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
