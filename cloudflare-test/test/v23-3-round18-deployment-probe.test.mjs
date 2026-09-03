import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ROUND18_DEPLOYMENT_MARKER,
  evaluateRound18MatchCenterSources,
} from '../scripts/probe-round18-match-center.mjs';

const ROUND18_BROWSER_MODULES = Object.freeze([
  'match-center-core.mjs',
  'data-client.mjs',
  'match-center-section-cache.mjs',
  'match-center-sections.mjs',
  'match-center-overview.mjs',
  'match-center-stats.mjs',
  'match-center-events.mjs',
  'match-center-lineups.mjs',
  'match-center-players.mjs',
  'match-center-theme.mjs',
  'serie-a-match-center-adapter.mjs',
  'match-center-parity.mjs',
  'serie-a-legacy-bridge.mjs',
  'round18-deployment-marker.mjs',
]);

function passingSources() {
  return {
    core:`
      const MATCH_CENTER_TABS = ['overview','stats','events','lineups','players'];
      function patchMatchCenterOverlay() { return 'data-cw233-mc-view'; }
      async function refreshLive() { await refreshSection(state.activeTab, { force:true }); }
      if (payload?.competition === 'serie_a') return delegateSerieA(payload) ? 'legacy' : 'legacy_unavailable';
    `,
    sections:`
      const COVERAGE_KEYS = ['overview','stats','events','lineups','players','momentum','shotmap'];
      export function canonicalCoverage() {}
      export function canonicalMatchCenterBase() {}
      export function canonicalOverviewSection() {}
      export function canonicalStatsSection() {}
      export function canonicalEventsSection() {}
      export function canonicalLineupsSection() {}
      export function canonicalPlayersSection() {}
    `,
    adapter:`export function adaptSerieALegacyMatchCenter() {}`,
    parity:`
      export const SERIE_A_LEGACY_PARITY_GATE = 'serie_a_legacy_parity_gate';
      export function evaluateSerieAParity() {}
    `,
    bridge:`export function readSerieALegacyMatchCenterData() {}`,
    deployment:`export const ROUND18_BUILD_MARKER = 'round18-match-center-parity-r1';`,
  };
}

test('Round 18 deployment probe has an explicit legacy Serie A parity-gate marker', () => {
  assert.equal(ROUND18_DEPLOYMENT_MARKER, 'serie_a_legacy_parity_gate');
});

test('Round 18 build exposes a unique deployment identity and ships the full browser graph', async () => {
  const deploymentSource = await readFile(new URL('../src/v23.3/round18-deployment-marker.mjs', import.meta.url), 'utf8');
  assert.match(deploymentSource, /ROUND18_BUILD_MARKER/);
  assert.match(deploymentSource, /round18-match-center-parity-r1/);

  const { copyV233Modules } = await import('../scripts/build.mjs');
  const files = await copyV233Modules();
  for (const moduleName of ROUND18_BROWSER_MODULES) {
    assert.equal(files.includes(moduleName), true, `missing build module: ${moduleName}`);
    const built = await readFile(new URL(`../dist/v23.3/${moduleName}`, import.meta.url), 'utf8');
    assert.ok(built.length > 0, `empty build module: ${moduleName}`);
  }
});

test('Round 18 deployment probe requires identity, shell, five tabs, section contract, LIVE active-tab reconciliation and legacy Serie A delegation', () => {
  const result = evaluateRound18MatchCenterSources(passingSources());

  assert.equal(result.passed, true);
  assert.deepEqual(result.checks, {
    deploymentIdentity:true,
    matchCenterShell:true,
    fiveTabs:true,
    sectionContract:true,
    serieAAdapter:true,
    serieALegacyParityGate:true,
    serieALegacyBridge:true,
    serieALegacyDelegated:true,
    liveActiveTabReconciliation:true,
  });
  assert.deepEqual(result.missing, []);
});

test('Round 18 deployment probe fails closed when identity, parity marker or legacy delegation is missing', () => {
  const sources = passingSources();
  sources.deployment = '';
  sources.parity = `export function evaluateSerieAParity() {}`;
  sources.core = sources.core.replace("return delegateSerieA(payload) ? 'legacy' : 'legacy_unavailable';", "return 'canonical';");
  const result = evaluateRound18MatchCenterSources(sources);

  assert.equal(result.passed, false);
  assert.ok(result.missing.includes('deploymentIdentity'));
  assert.ok(result.missing.includes('serieALegacyParityGate'));
  assert.ok(result.missing.includes('serieALegacyDelegated'));
});

test('Round 18 TEST workflow probes the deployed PR branch after build with bounded retry', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url), 'utf8');
  const buildAt = workflow.indexOf('Build TEST artifact');
  const probeAt = workflow.indexOf('Probe deployed Round 18 Match Center');
  const nextStepAt = workflow.indexOf('\n      - name:', probeAt + 1);
  const probeBlock = workflow.slice(probeAt, nextStepAt === -1 ? workflow.length : nextStepAt);

  assert.ok(probeAt > buildAt);
  assert.doesNotMatch(probeBlock, /if: github\.event_name == 'push'/);
  assert.match(probeBlock, /for attempt in 1 2 3 4 5 6/);
  assert.match(probeBlock, /node scripts\/probe-round18-match-center\.mjs/);
  assert.match(probeBlock, /sleep 10/);
});
