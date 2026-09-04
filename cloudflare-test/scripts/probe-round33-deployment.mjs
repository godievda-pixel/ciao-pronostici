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
  const [shellResponse, runtimeResponse, indexResponse, round35Response] = await Promise.all([
    fetchText('/', fetchImpl),
    fetchText('/v23.3/round31-match-center-stability.mjs', fetchImpl),
    fetchText('/v23.3/index.mjs', fetchImpl),
    fetchText('/v23.3/round35-match-center-overview-fixes.mjs', fetchImpl),
  ]);

  const shellText = compact(shellResponse.text);
  const runtimeText = compact(runtimeResponse.text);
  const indexText = compact(indexResponse.text);
  const round35Text = compact(round35Response.text);
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

  const round35Import = {
    status:indexResponse.status,
    responseOk:indexResponse.ok,
    wired:indexText.includes("import './round35-match-center-overview-fixes.mjs'"),
    afterRound31:indexText.indexOf("import './round35-match-center-overview-fixes.mjs'")
      > indexText.indexOf("import './round31-match-center-stability.mjs'"),
  };

  const round35 = {
    status:round35Response.status,
    responseOk:round35Response.ok,
    buildMarker:round35Text.includes("ROUND35_MATCH_CENTER_BUILD = '2026-09-04-r35'"),
    externalFormSectionRemoval:round35Text.includes("querySelector?.('[data-mc-tab-content=\"overview\"]')")
      && round35Text.includes("querySelectorAll?.('.cw14-form-card')")
      && round35Text.includes("closest?.('.mc-section')")
      && round35Text.includes('target.remove?.()'),
    externalFormCssFailsafe:round35Text.includes('data-cw233-mc-competition="coppa_italia"')
      && round35Text.includes('data-cw233-mc-competition="ucl"')
      && round35Text.includes('data-cw233-mc-competition="uel"')
      && round35Text.includes('data-cw233-mc-competition="uecl"')
      && round35Text.includes('.mc-section:has(.cw14-form-card)')
      && round35Text.includes('display:none!important')
      && !round35Text.includes('data-cw233-mc-competition="serie_a"'),
    serieAContextPalette:round35Text.includes('.cw18-match-context')
      && round35Text.includes('--cw233-serie-context-bg:#071626')
      && round35Text.includes('--cw233-serie-context-accent:#0c5aa8')
      && round35Text.includes('--cw233-serie-context-accent-2:#287fc7'),
    lateMutationGuard:round35Text.includes('new Observer')
      && round35Text.includes('{ childList:true, subtree:true }')
      && round35Text.includes('removeRound35ExternalOverviewForm(root)'),
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
    round35Import.responseOk,
    round35Import.wired,
    round35Import.afterRound31,
    round35.responseOk,
    round35.buildMarker,
    round35.externalFormSectionRemoval,
    round35.externalFormCssFailsafe,
    round35.serieAContextPalette,
    round35.lateMutationGuard,
  ];

  const report = {
    ok:checks.every(Boolean),
    observedAt:new Date().toISOString(),
    origin:ORIGIN,
    overview,
    ownership,
    runtime,
    round35Import,
    round35,
  };

  if (writeArtifact) {
    await mkdir('artifacts', { recursive:true });
    await writeFile(ARTIFACT_PATH, JSON.stringify(report, null, 2));
  }

  console.log(JSON.stringify(report));
  if (!report.ok) throw new Error('Round 33/35 deployment markers are incomplete');
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
