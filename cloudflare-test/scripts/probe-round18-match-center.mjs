import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';

const MODULE_PATHS = Object.freeze({
  core:'/v23.3/match-center-core.mjs',
  dataClient:'/v23.3/data-client.mjs',
  sectionCache:'/v23.3/match-center-section-cache.mjs',
  sections:'/v23.3/match-center-sections.mjs',
  overview:'/v23.3/match-center-overview.mjs',
  stats:'/v23.3/match-center-stats.mjs',
  events:'/v23.3/match-center-events.mjs',
  lineups:'/v23.3/match-center-lineups.mjs',
  players:'/v23.3/match-center-players.mjs',
  theme:'/v23.3/match-center-theme.mjs',
  adapter:'/v23.3/serie-a-match-center-adapter.mjs',
  parity:'/v23.3/match-center-parity.mjs',
  bridge:'/v23.3/serie-a-legacy-bridge.mjs',
  deployment:'/v23.3/round18-deployment-marker.mjs',
});

const FIVE_TABS = Object.freeze(['overview','stats','events','lineups','players']);
const SECTION_MARKERS = Object.freeze([
  'COVERAGE_KEYS',
  'canonicalCoverage',
  'canonicalMatchCenterBase',
  'canonicalOverviewSection',
  'canonicalStatsSection',
  'canonicalEventsSection',
  'canonicalLineupsSection',
  'canonicalPlayersSection',
]);

export const ROUND18_DEPLOYMENT_MARKER = 'serie_a_legacy_parity_gate';
export const ROUND18_BUILD_MARKER = 'round18-match-center-parity-r2';

function sourceText(value) {
  return String(value ?? '');
}

export function evaluateRound18MatchCenterSources(sources = {}) {
  const core = sourceText(sources.core);
  const sections = sourceText(sources.sections);
  const adapter = sourceText(sources.adapter);
  const parity = sourceText(sources.parity);
  const bridge = sourceText(sources.bridge);
  const deployment = sourceText(sources.deployment);

  const checks = Object.freeze({
    deploymentIdentity:
      deployment.includes('ROUND18_BUILD_MARKER')
      && deployment.includes(ROUND18_BUILD_MARKER),
    matchCenterShell:
      core.includes('data-cw233-mc-view')
      && core.includes('patchMatchCenterOverlay'),
    fiveTabs:
      core.includes('MATCH_CENTER_TABS')
      && FIVE_TABS.every(tab => core.includes(`'${tab}'`) || core.includes(`"${tab}"`)),
    sectionContract:SECTION_MARKERS.every(marker => sections.includes(marker)),
    serieAAdapter:adapter.includes('adaptSerieALegacyMatchCenter'),
    serieALegacyParityGate:
      parity.includes('evaluateSerieAParity')
      && parity.includes(ROUND18_DEPLOYMENT_MARKER),
    serieALegacyBridge:bridge.includes('readSerieALegacyMatchCenterData'),
    serieALegacyDelegated:
      core.includes("payload?.competition === 'serie_a'")
      && core.includes('delegateSerieA')
      && core.includes("'legacy_unavailable'"),
    liveActiveTabReconciliation:
      core.includes('refreshLive')
      && /refreshSection\(state\.activeTab,\s*\{\s*force\s*:\s*true\s*\}\)/.test(core),
  });

  const missing = Object.freeze(
    Object.entries(checks)
      .filter(([, value]) => value !== true)
      .map(([key]) => key),
  );

  return Object.freeze({
    marker:ROUND18_DEPLOYMENT_MARKER,
    buildMarker:ROUND18_BUILD_MARKER,
    passed:missing.length === 0,
    checks,
    missing,
  });
}

async function fetchModule(path, origin, fetchImpl) {
  const url = new URL(path, origin);
  url.searchParams.set('probe', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const response = await fetchImpl(url, {
    headers:{
      'cache-control':'no-cache, no-store, max-age=0',
      pragma:'no-cache',
    },
  });
  const text = await response.text();
  return {
    path,
    ok:response.ok,
    status:response.status,
    bytes:Buffer.byteLength(text),
    text,
  };
}

export async function probeRound18MatchCenter({ origin = ORIGIN, fetchImpl = fetch } = {}) {
  const entries = await Promise.all(
    Object.entries(MODULE_PATHS).map(async ([key, path]) => [key, await fetchModule(path, origin, fetchImpl)]),
  );

  const sources = Object.fromEntries(entries.map(([key, row]) => [key, row.ok ? row.text : '']));
  const modules = Object.fromEntries(entries.map(([key, row]) => [key, {
    path:row.path,
    ok:row.ok,
    status:row.status,
    bytes:row.bytes,
  }]));
  const evaluation = evaluateRound18MatchCenterSources(sources);
  const report = {
    observedAt:new Date().toISOString(),
    origin,
    marker:ROUND18_DEPLOYMENT_MARKER,
    buildMarker:ROUND18_BUILD_MARKER,
    modules,
    passed:evaluation.passed,
    checks:evaluation.checks,
    missing:evaluation.missing,
  };

  await mkdir('artifacts', { recursive:true });
  await writeFile('artifacts/v23-3-round18-match-center.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));

  if (!Object.values(modules).every(row => row.ok)) {
    throw new Error('Round 18 deployed Match Center modules are unavailable');
  }
  if (!evaluation.passed) {
    throw new Error(`Round 18 Match Center deployment gate failed: ${evaluation.missing.join(',')}`);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await probeRound18MatchCenter();
}
