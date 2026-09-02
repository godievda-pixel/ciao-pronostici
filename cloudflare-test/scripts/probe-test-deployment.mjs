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
  "querySelectorAll('.nav",
  'querySelectorAll(".nav',
  '.nav button',
  'dataset.tab',
  'data-tab="calendar"',
  'stopPropagation()',
  '#ciao-miniapp-root{',
  '#ciao-miniapp-root {',
  '.scoreboard-card',
  '.board-team',
  'class="logo"',
  'loading="lazy"',
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

async function probeHealth() {
  try {
    const { response, text } = await fetchText(new globalThis.URL('/healthz', ORIGIN));
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return {
      status: response.status,
      ok: Boolean(response.ok && json?.ok),
      service: json?.service || null,
      build: json?.build || null,
      matchesProvider: json?.matches_provider || null,
      bsdConfigured: typeof json?.bsd_configured === 'boolean' ? json.bsd_configured : null,
    };
  } catch (error) {
    return { status: 0, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function probeLiveCompetition() {
  const url = new globalThis.URL('/api/v23.2/matches', ORIGIN);
  url.searchParams.set('competition', 'ucl');
  url.searchParams.set('from', '2026-07-01');
  url.searchParams.set('to', '2027-06-30');
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'cache-control': 'no-cache, no-store, max-age=0',
        'x-telegram-init-data': 'deployment-probe',
      },
    });
    let payload = null;
    try { payload = await response.json(); } catch {}
    const matches = Array.isArray(payload?.data?.matches) ? payload.data.matches : [];
    return {
      status: response.status,
      ok: Boolean(response.ok && payload?.ok),
      provider: payload?.data?.provider || payload?.provider || null,
      competition: payload?.data?.competition || payload?.competition || null,
      matchCount: matches.length,
      sample: matches.slice(0, 3).map(match => ({
        matchId: match?.matchId || null,
        kickoffAt: match?.kickoffAt || null,
        home: match?.homeTeam?.name || null,
        away: match?.awayTeam?.name || null,
      })),
      error: payload?.error || null,
      upstreamStage: payload?.upstream_stage || null,
      upstreamStatus: payload?.upstream_status ?? null,
      upstreamCode: payload?.upstream_code || null,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      matchCount: 0,
      error: error instanceof Error ? error.message : String(error),
      upstreamStage: null,
      upstreamStatus: null,
      upstreamCode: null,
    };
  }
}

function snippets(text, markers) {
  return markers.map(marker => {
    const index = text.indexOf(marker);
    if (index < 0) return { marker, found: false };
    return {
      marker,
      found: true,
      index,
      snippet: text.slice(Math.max(0, index - 1200), Math.min(text.length, index + 2600))
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
        hasTournamentCapture: path.endsWith('/matches-ui.mjs')
          ? text.includes('event.stopPropagation?.();') && text.includes('controller.openCompetition(card.dataset.cw232Competition)')
          : undefined,
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

  const [modules, health, liveUcl] = await Promise.all([
    probeModules(),
    probeHealth(),
    probeLiveCompetition(),
  ]);
  const matchesModule = modules.find(item => item.path.endsWith('/matches-ui.mjs'));
  const report = {
    url: ORIGIN,
    expected: EXPECTED,
    observedAt: new Date().toISOString(),
    attempts,
    latest: attempts.at(-1) || null,
    health,
    liveUcl,
    modules,
    navigation: snippets(latestHtml, NAV_MARKERS),
  };

  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/test-deployment-probe.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    latest: report.latest,
    health,
    liveUcl,
    modules,
    navigation: report.navigation.map(item => ({ marker: item.marker, found: item.found, index: item.index })),
  }));

  if (!matchesModule?.hasTournamentCapture) {
    throw new Error('deployed TEST does not contain tournament capture navigation fix');
  }
  if (health.bsdConfigured === true && (!liveUcl.ok || liveUcl.matchCount < 1)) {
    throw new Error(
      `deployed TEST BSD UCL probe failed: status=${liveUcl.status}`
      + ` stage=${liveUcl.upstreamStage || 'unknown'}`
      + ` upstreamStatus=${liveUcl.upstreamStatus ?? 'unknown'}`
      + ` code=${liveUcl.upstreamCode || 'unknown'}`
      + ` error=${liveUcl.error || 'none'} matches=${liveUcl.matchCount}`,
    );
  }
}

probe().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
