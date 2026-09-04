import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const ARTIFACT_PATH = 'artifacts/v23-3-round33-deployment.json';

async function fetchText(path, fetchImpl) {
  const url = new URL(path, ORIGIN);
  url.searchParams.set('round33_probe', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const response = await fetchImpl(url, {
    headers:{ 'cache-control':'no-cache, no-store, max-age=0', pragma:'no-cache' },
  });
  return { status:response.status, ok:response.ok, text:await response.text() };
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export async function probeRound33Deployment({ fetchImpl = fetch, writeArtifact = true } = {}) {
  const [shellResponse, runtimeResponse] = await Promise.all([
    fetchText('/', fetchImpl),
    fetchText('/v23.3/round31-match-center-stability.mjs', fetchImpl),
  ]);

  const shellText = compact(shellResponse.text);
  const runtimeText = compact(runtimeResponse.text);
  const sanitizerStart = shellText.indexOf('function __cw233Round33IsFormSection');
  const sanitizerEnd = sanitizerStart >= 0
    ? shellText.indexOf('matchTabContent = function', sanitizerStart)
    : -1;
  const sanitizerText = sanitizerStart >= 0 && sanitizerEnd > sanitizerStart
    ? shellText.slice(sanitizerStart, sanitizerEnd)
    : '';

  const overview = {
    status:shellResponse.status,
    responseOk:shellResponse.ok,
    round33Marker:shellText.includes('cw233-round33-match-center-overview-ownership'),
    round34FormOnlyMarker:shellText.includes('cw233-round34-external-overview-form-only'),
    preservesLegacyOverview:shellText.includes('const __cw233Round33LegacyMatchTabContent = matchTabContent')
      && shellText.includes('const html = __cw233Round33LegacyMatchTabContent(d,key)')
      && shellText.includes("String(key || '') !== 'overview'")
      && shellText.includes('return __cw233Round33SanitizeExternalOverviewHtml(html)'),
    removesOnlyExternalForm:!!sanitizerText
      && sanitizerText.includes("querySelectorAll?.('.cw14-form-card')")
      && sanitizerText.includes('Форма')
      && !sanitizerText.includes('Контекст')
      && !sanitizerText.includes('Серии'),
  };

  const ownership = {
    persistentSuspendedMarker:shellText.includes("matchesOverlay.dataset.cw233MatchCenterSuspended = '1'")
      && shellText.includes('delete matchesOverlay.dataset.cw233MatchCenterSuspended'),
    suspendedCssIsolation:shellText.includes('data-cw233-match-center-suspended="1"')
      && shellText.includes('display:none!important')
      && shellText.includes('visibility:hidden!important')
      && shellText.includes('pointer-events:none!important'),
  };

  const runtime = {
    status:runtimeResponse.status,
    responseOk:runtimeResponse.ok,
    noRound31OverviewReplacement:!runtimeText.includes('const nextHtml = renderRound31ExternalOverview(activeExternal.data)'),
    noRound31OverviewCaptureHijack:!/stopImmediatePropagation\?\.\(\)[\s\S]{0,600}renderExternalOverview\(\)/.test(runtimeText),
  };

  const checks = [
    overview.responseOk,
    overview.round33Marker,
    overview.round34FormOnlyMarker,
    overview.preservesLegacyOverview,
    overview.removesOnlyExternalForm,
    ownership.persistentSuspendedMarker,
    ownership.suspendedCssIsolation,
    runtime.responseOk,
    runtime.noRound31OverviewReplacement,
    runtime.noRound31OverviewCaptureHijack,
  ];

  const report = {
    ok:checks.every(Boolean),
    observedAt:new Date().toISOString(),
    origin:ORIGIN,
    overview,
    ownership,
    runtime,
  };

  if (writeArtifact) {
    await mkdir('artifacts', { recursive:true });
    await writeFile(ARTIFACT_PATH, JSON.stringify(report, null, 2));
  }

  console.log(JSON.stringify(report));
  if (!report.ok) throw new Error('Round 33 deployment markers are incomplete');
  return report;
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isCli) {
  probeRound33Deployment().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
