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
  const [compatResponse, lifecycleResponse] = await Promise.all([
    fetchText('/v23.3/round31-match-center-stability.mjs', fetchImpl),
    fetchText('/v23.3/match-center-lifecycle.mjs', fetchImpl),
  ]);

  const compatText = compact(compatResponse.text);
  const lifecycleText = compact(lifecycleResponse.text);

  const noLegacyViewportOwner = !compatText.includes('syncViewportOwnership')
    && !compatText.includes('cw233-r31-match-center-owned')
    && !compatText.includes('MutationObserver')
    && !/overlay\.hidden\s*=\s*true/.test(compatText);

  const singleLifecycleOwner = lifecycleText.includes("MATCH_CENTER_OWNER_CLASS = 'cw238-match-center-owner'")
    && lifecycleText.includes("MATCH_CENTER_SUSPENDED_ATTR = 'cw238MatchCenterSuspended'")
    && lifecycleText.includes('export function suspendMatchSource')
    && lifecycleText.includes('export function restoreMatchSource')
    && lifecycleText.includes('ciao-v233-open-external-legacy-match')
    && lifecycleText.includes('ciao-v233-open-serie-a-match');

  const runtime = {
    status:compatResponse.status,
    responseOk:compatResponse.ok,
    round32BuildMarker:compatText.includes("USER_FEEDBACK_ROUND32_BUILD = '2026-09-04-r32'"),
    round38LifecycleMarker:compatText.includes("USER_FEEDBACK_ROUND38_LIFECYCLE_BUILD = '2026-09-04-r38-lifecycle'"),
    noLegacyViewportOwner,
  };

  const lifecycle = {
    status:lifecycleResponse.status,
    responseOk:lifecycleResponse.ok,
    singleLifecycleOwner,
    ownerClass:lifecycleText.includes('cw238-match-center-owner'),
    suspendedAttribute:lifecycleText.includes('cw238MatchCenterSuspended'),
    restoreMatchSource:lifecycleText.includes('restoreMatchSource'),
    noGlobalMutationObserver:!lifecycleText.includes('MutationObserver'),
  };

  const checks = [
    runtime.responseOk,
    runtime.round32BuildMarker,
    runtime.round38LifecycleMarker,
    runtime.noLegacyViewportOwner,
    lifecycle.responseOk,
    lifecycle.singleLifecycleOwner,
    lifecycle.ownerClass,
    lifecycle.suspendedAttribute,
    lifecycle.restoreMatchSource,
    lifecycle.noGlobalMutationObserver,
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
