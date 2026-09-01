import { mkdir, writeFile } from 'node:fs/promises';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
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
const NAV_MARKERS = [
  "root.addEventListener('click'",
  'root.addEventListener("click"',
  "closest('[data-tab]')",
  'closest("[data-tab]")',
  "closest?.('[data-tab]')",
  'data-tab="calendar"',
  'stopPropagation()',
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

function snippets(text, markers) {
  return markers.map(marker => {
    const index = text.indexOf(marker);
    if (index < 0) return { marker, found: false };
    return {
      marker,
      found: true,
      index,
      snippet: text.slice(Math.max(0, index - 900), Math.min(text.length, index + 1800))
        .replace(/\s+/g, ' ')
        .trim(),
    };
  });
}

async function probeModules() {
  const rows = [];
  for (const path of MODULES) {
    try {
      const { response, text } = await fetchText(new globalThis.URL(path, ORIGIN));
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
  let latestHtml = '';

  for (let index = 0; index < 9; index += 1) {
    const startedAt = new Date().toISOString();
    try {
      const { response, text: html } = await fetchText(ORIGIN);
      latestHtml = html;
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
    url: ORIGIN,
    expected: EXPECTED,
    observedAt: new Date().toISOString(),
    attempts,
    latest: attempts.at(-1) || null,
    modules,
    navigation: snippets(latestHtml, NAV_MARKERS),
  };

  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/test-deployment-probe.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    latest: report.latest,
    modules,
    navigation: report.navigation.map(item => ({ marker: item.marker, found: item.found, index: item.index })),
  }));
}

probe().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
