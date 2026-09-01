import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  discoverApiCalls,
  summarizeJsonShape,
} from '../src/v23.2/api-contract-observer.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'artifacts/api-contract-observed.json');

const PERSONAL_ROUTE_PATTERN = /(?:user|profile|prediction|rank|auth|telegram|admin|me)(?:\/|\?|$)/i;

export function safeCalls(calls) {
  return calls.filter(call =>
    call.method === 'GET'
    && call.concrete
    && call.route.startsWith('/api/')
    && !PERSONAL_ROUTE_PATTERN.test(call.route)
    && !/[?&](?:user|user_id|telegram|tg|token|auth|prediction)=/i.test(call.route)
  );
}

function contentType(response) {
  return String(response.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

export async function observeContract({ baseUrl, testOrigin, fetchImpl = fetch }) {
  const baseResponse = await fetchImpl(baseUrl, {
    headers: { 'cache-control': 'no-cache' },
  });
  if (!baseResponse.ok) {
    throw new Error(`base fetch failed: HTTP ${baseResponse.status}`);
  }

  const source = await baseResponse.text();
  const calls = discoverApiCalls(source);
  const safe = safeCalls(calls);
  const probes = [];

  for (const call of safe) {
    const url = new URL(call.route, testOrigin).toString();
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'cache-control': 'no-cache',
        },
        redirect: 'manual',
      });
      const type = contentType(response);
      const probe = {
        route: call.route,
        status: response.status,
        contentType: type,
      };

      if (response.ok && type.includes('json')) {
        probe.shape = summarizeJsonShape(await response.json());
      }

      probes.push(probe);
    } catch (error) {
      probes.push({
        route: call.route,
        status: 0,
        contentType: '',
        error: error?.name || 'Error',
      });
    }
  }

  return {
    observedAt: new Date().toISOString(),
    baseUrl,
    testOrigin,
    calls,
    safeGetRoutes: safe.map(call => call.route),
    probes,
  };
}

export async function main() {
  const baseUrl = process.env.BASE_URL
    || 'https://ciao-web-app.ciao-web.workers.dev/releases/v23.1/';
  const testOrigin = process.env.TEST_ORIGIN
    || 'https://ciao-web-app-test.ciao-web.workers.dev';

  const result = await observeContract({ baseUrl, testOrigin });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    discovered: result.calls.length,
    safeGetRoutes: result.safeGetRoutes.length,
    probed: result.probes.length,
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
