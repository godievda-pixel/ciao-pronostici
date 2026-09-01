import { mkdir, writeFile } from 'node:fs/promises';

const URL = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const EXPECTED = [
  'id="ciao-v232-core"',
  'id="ciao-v232-matches-ui"',
  'cw231-favorite-normalized-link',
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function probe() {
  const attempts = [];

  for (let index = 0; index < 9; index += 1) {
    const startedAt = new Date().toISOString();
    try {
      const response = await fetch(URL, {
        headers: {
          'cache-control': 'no-cache, no-store, max-age=0',
          pragma: 'no-cache',
        },
      });
      const html = await response.text();
      const markers = Object.fromEntries(EXPECTED.map(marker => [marker, html.includes(marker)]));
      attempts.push({
        attempt: index + 1,
        startedAt,
        status: response.status,
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

  const report = {
    url: URL,
    expected: EXPECTED,
    observedAt: new Date().toISOString(),
    attempts,
    latest: attempts.at(-1) || null,
  };

  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/test-deployment-probe.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.latest));
}

probe().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
