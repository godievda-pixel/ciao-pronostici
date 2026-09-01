import { mkdir, writeFile } from 'node:fs/promises';

const URL = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const EXPECTED = [
  'id="ciao-v232-core"',
  'id="ciao-v232-matches-ui"',
  'cw231-favorite-normalized-link',
];
const MODULES = [
  '/v23.2/index.mjs',
  '/v23.2/matches-ui.mjs',
  '/v23.2/data-client.mjs',
  '/v23.2/competition-config.mjs',
  '/v23.2/tournament-engine.mjs',
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
    },
  });
  return { response, text: await response.text() };
}

async function probeModules() {
  const rows = [];
  for (const path of MODULES) {
    try {
      const { response, text } = await fetchText(new URL(path, URL));
      rows.push({
        path,
        status: response.status,
        contentType: response.headers.get('content-type'),
        contentSecurityPolicy: response.headers.get('content-security-policy'),
        bytes: Buffer.byteLength(text),
        hasInstallMatchesUi: path.endsWith('/matches-ui.mjs') ? text.includes('installMatchesUi') : undefined,
        hasCoreMarker: path.endsWith('/index.mjs') ? text.includes('CiaoV232Core') : undefined,
      });
    } catch (error) {
      rows.push({
        path,
        status: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return rows;
}

async function probe() {
  const attempts = [];

  for (let index = 0; index < 9; index += 1) {
    const startedAt = new Date().toISOString();
    try {
      const { response, text: html } = await fetchText(URL);
      const markers = Object.fromEntries(EXPECTED.map(marker => [marker, html.includes(marker)]));
      attempts.push({
        attempt: index + 1,
        startedAt,
        status: response.status,
        contentType: response.headers.get('content-type'),
        contentSecurityPolicy: response.headers.get('content-security-policy'),
        cfRay: response.headers.get('cf-ray'),
        age: response.headers.get('age'),
        etag: response.headers.get('etag'),
        markers,
        bytes: Buffer.byteLength(html),
      });
      if (response.ok && EXPECTED.every(marker => markers[marker])) break;
    } catch (error) {
      attempts.push({
        attempt: index + 1,
        startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (index < 8) await sleep(10_000);
  }

  const modules = await probeModules();
  const report = {
    url: URL,
    expected: EXPECTED,
    observedAt: new Date().toISOString(),
    attempts,
    latest: attempts.at(-1) || null,
    modules,
  };

  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/test-deployment-probe.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ latest: report.latest, modules }));
}

probe().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
