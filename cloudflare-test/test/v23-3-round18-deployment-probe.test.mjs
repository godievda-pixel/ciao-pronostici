import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ROUND18_DEPLOYMENT_MARKER,
  evaluateRound18MatchCenterSources,
} from '../scripts/probe-round18-match-center.mjs';

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
  };
}

test('Round 18 deployment probe has an explicit legacy Serie A parity-gate marker', () => {
  assert.equal(ROUND18_DEPLOYMENT_MARKER, 'serie_a_legacy_parity_gate');
});

test('Round 18 deployment probe requires shell, five tabs, section contract, LIVE active-tab reconciliation and legacy Serie A delegation', () => {
  const result = evaluateRound18MatchCenterSources(passingSources());

  assert.equal(result.passed, true);
  assert.deepEqual(result.checks, {
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

test('Round 18 deployment probe fails closed when parity marker or legacy delegation is missing', () => {
  const sources = passingSources();
  sources.parity = `export function evaluateSerieAParity() {}`;
  sources.core = sources.core.replace("return delegateSerieA(payload) ? 'legacy' : 'legacy_unavailable';", "return 'canonical';");
  const result = evaluateRound18MatchCenterSources(sources);

  assert.equal(result.passed, false);
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
