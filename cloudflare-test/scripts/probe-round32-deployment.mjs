import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const ARTIFACT_PATH = 'artifacts/v23-3-round32-deployment.json';

async function fetchText(path, fetchImpl) {
  const url = new URL(path, ORIGIN);
  url.searchParams.set('round32_probe', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const response = await fetchImpl(url, {
    headers:{ 'cache-control':'no-cache, no-store, max-age=0', pragma:'no-cache' },
  });
  return { status:response.status, ok:response.ok, text:await response.text() };
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export async function probeRound32Deployment({ fetchImpl = fetch, writeArtifact = true } = {}) {
  const [runtimeResponse, shellResponse] = await Promise.all([
    fetchText('/v23.3/round31-match-center-stability.mjs', fetchImpl),
    fetchText('/', fetchImpl),
  ]);

  const runtimeText = compact(runtimeResponse.text);
  const shellText = compact(shellResponse.text);

  const forbiddenOverlayHiddenMutation = /overlay\.hidden\s*=\s*true/.test(runtimeText);
  const forbiddenOverlayAriaMutation = /overlay\?\.setAttribute\?\.\(['"]aria-hidden['"]/.test(runtimeText);
  const forbiddenOverlayObserver = /observer\?\.observe\?\.\(matchesOverlay/.test(runtimeText);
  const forbiddenSubtreeObserver = /subtree\s*:\s*true/.test(runtimeText);

  const runtime = {
    status:runtimeResponse.status,
    responseOk:runtimeResponse.ok,
    buildMarker:runtimeText.includes("USER_FEEDBACK_ROUND32_BUILD = '2026-09-04-r32'"),
    syncViewportOwnership:runtimeText.includes('const syncViewportOwnership = () =>')
      && runtimeText.includes("root.classList?.contains?.('match-center-open')")
      && runtimeText.includes('html?.classList?.add?.(OWNED_CLASS)'),
    classOnlyObserver:/observer\?\.observe\?\.\(root,\s*\{\s*attributes:true,\s*attributeFilter:\['class'\]\s*\}\)/.test(runtimeText),
    cssViewportIsolation:runtimeText.includes('html.${OWNED_CLASS} #ciao-v232-matches-overlay')
      && runtimeText.includes('display:none!important'),
    noDirectOverlayStateMutation:!forbiddenOverlayHiddenMutation && !forbiddenOverlayAriaMutation,
    noSelfObservingOverlay:!forbiddenOverlayObserver && !forbiddenSubtreeObserver,
  };

  const lifecycle = {
    status:shellResponse.status,
    responseOk:shellResponse.ok,
    suspendOwnerPresent:shellText.includes('__cw233SuspendMatchesOverlay'),
    externalOpenWired:shellText.includes('ciao-v233-open-external-legacy-match'),
    serieAOpenWired:shellText.includes('ciao-v233-open-serie-a-match'),
    closeRestoreWired:shellText.includes('ciao-v233-legacy-match-center-closed'),
  };

  const checks = [
    runtime.responseOk,
    runtime.buildMarker,
    runtime.syncViewportOwnership,
    runtime.classOnlyObserver,
    runtime.cssViewportIsolation,
    runtime.noDirectOverlayStateMutation,
    runtime.noSelfObservingOverlay,
    lifecycle.responseOk,
    lifecycle.suspendOwnerPresent,
    lifecycle.externalOpenWired,
    lifecycle.serieAOpenWired,
    lifecycle.closeRestoreWired,
  ];

  const report = {
    ok:checks.every(Boolean),
    observedAt:new Date().toISOString(),
    origin:ORIGIN,
    runtime,
    lifecycle,
  };

  if (writeArtifact) {
    await mkdir('artifacts', { recursive:true });
    await writeFile(ARTIFACT_PATH, JSON.stringify(report, null, 2));
  }

  console.log(JSON.stringify(report));
  if (!report.ok) throw new Error('Round 32 deployment markers are incomplete');
  return report;
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isCli) {
  probeRound32Deployment().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
