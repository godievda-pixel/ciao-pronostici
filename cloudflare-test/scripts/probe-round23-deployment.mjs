import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const ARTIFACT_PATH = 'artifacts/v23-3-round23-deployment.json';

async function fetchText(path, fetchImpl) {
  const url = new URL(path, ORIGIN);
  url.searchParams.set('round23_probe', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const response = await fetchImpl(url, {
    headers:{
      'cache-control':'no-cache, no-store, max-age=0',
      pragma:'no-cache',
    },
  });
  return { status:response.status, ok:response.ok, text:await response.text() };
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function blockHas(text, selector, declaration) {
  const normalized = compact(text);
  const at = normalized.indexOf(selector);
  if (at < 0) return false;
  const close = normalized.indexOf('}', at);
  if (close < 0) return false;
  return normalized.slice(at, close + 1).includes(declaration);
}

export async function probeRound23Deployment({ fetchImpl = fetch, writeArtifact = true } = {}) {
  const [homeResponse, matchCenterResponse, predictionsResponse, matchesResponse] = await Promise.all([
    fetchText('/', fetchImpl),
    fetchText('/v23.3/legacy-match-center-theme.mjs', fetchImpl),
    fetchText('/v23.3/round11-performance-themes.mjs', fetchImpl),
    fetchText('/v23.3/round10-regression-fixes.mjs', fetchImpl),
  ]);

  const homeText = compact(homeResponse.text);
  const matchCenterText = compact(matchCenterResponse.text);
  const predictionsText = compact(predictionsResponse.text);
  const matchesText = compact(matchesResponse.text);

  const home = {
    status:homeResponse.status,
    responseOk:homeResponse.ok,
    round23StateMarker:homeText.includes('cw233-round23-unified-state-fixes'),
  };

  const matchCenter = {
    status:matchCenterResponse.status,
    responseOk:matchCenterResponse.ok,
    serieAPalette:matchCenterText.includes('--cw233-mc-accent:#0c5aa8')
      && matchCenterText.includes('--cw233-mc-accent-2:#287fc7'),
    duplicateBackRemoved:blockHas(
      matchCenterText,
      '#ciao-miniapp-root.match-center-open:not([data-cw233-mc-competition]) .mc-back',
      'display:none!important',
    ),
    toolbarFrameRemoved:blockHas(
      matchCenterText,
      '#ciao-miniapp-root.match-center-open .mc-toolbar',
      'border-bottom:0!important',
    ),
    contextSurfacesThemed:matchCenterText.includes('.cw20-stat-mini')
      && matchCenterText.includes('.cw20-player-row')
      && matchCenterText.includes('.cw20-event-card')
      && matchCenterText.includes('background:var(--cw233-mc-surface)!important'),
    lineupSwitchThemed:blockHas(
      matchCenterText,
      '#ciao-miniapp-root.match-center-open .mc-lineup-switch button',
      'background:var(--cw233-mc-surface)!important',
    ) && matchCenterText.includes('linear-gradient(135deg,var(--cw233-mc-accent),var(--cw233-mc-accent-2))'),
  };

  const predictions = {
    status:predictionsResponse.status,
    responseOk:predictionsResponse.ok,
    serieAPalette:predictionsText.includes('--r11a:#0c5aa8;--r11b:#287fc7')
      && predictionsText.includes('linear-gradient(165deg,#071626 0%,#061321 48%,#050f1a 100%)'),
  };

  const matches = {
    status:matchesResponse.status,
    responseOk:matchesResponse.ok,
    serieAAmbience:matchesText.includes("data-cw233-round10-theme='serie-a'")
      && matchesText.includes('#071626')
      && matchesText.includes('rgba(12,90,168,')
      && matchesText.includes('rgba(40,127,199,'),
  };

  const checks = [
    home.responseOk,
    home.round23StateMarker,
    matchCenter.responseOk,
    matchCenter.serieAPalette,
    matchCenter.duplicateBackRemoved,
    matchCenter.toolbarFrameRemoved,
    matchCenter.contextSurfacesThemed,
    matchCenter.lineupSwitchThemed,
    predictions.responseOk,
    predictions.serieAPalette,
    matches.responseOk,
    matches.serieAAmbience,
  ];

  const report = {
    ok:checks.every(Boolean),
    observedAt:new Date().toISOString(),
    origin:ORIGIN,
    home,
    matchCenter,
    predictions,
    matches,
  };

  if (writeArtifact) {
    await mkdir('artifacts', { recursive:true });
    await writeFile(ARTIFACT_PATH, JSON.stringify(report, null, 2));
  }

  console.log(JSON.stringify(report));
  if (!report.ok) throw new Error('Round 23 deployment markers are incomplete');
  return report;
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isCli) {
  probeRound23Deployment().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
