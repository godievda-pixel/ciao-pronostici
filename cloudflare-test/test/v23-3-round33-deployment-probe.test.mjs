import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { probeRound33Deployment } from '../scripts/probe-round33-deployment.mjs';

function response(body, status = 200) {
  return new Response(body, { status, headers:{ 'content-type':'text/plain; charset=utf-8' } });
}

const shellFixture = `
  /* cw233-round33-match-center-overview-ownership */
  const __cw233Round33LegacyMatchTabContent = matchTabContent;
  function __cw233Round33SanitizeExternalOverviewHtml(html){
    const holder = document.createElement('div');
    holder.querySelectorAll?.('.cw14-form-card');
    if (/Контекст\\s+Серии\\s*[АA]/i.test(section?.textContent || '')) section.remove?.();
  }
  matchTabContent = function(d,key){
    const html = __cw233Round33LegacyMatchTabContent(d,key);
    if (!__cw233ExternalMatchContext || String(key || '') !== 'overview') return html;
    return __cw233Round33SanitizeExternalOverviewHtml(html);
  };
  matchesOverlay.dataset.cw233MatchCenterSuspended = '1';
  delete matchesOverlay.dataset.cw233MatchCenterSuspended;
  #ciao-v232-matches-overlay[data-cw233-match-center-suspended="1"]{
    display:none!important;
    visibility:hidden!important;
    pointer-events:none!important;
  }
`;

const runtimeFixture = `
  export const USER_FEEDBACK_ROUND32_BUILD = '2026-09-04-r32';
  const syncViewportOwnership = () => {};
`;

function fixtureFetch(overrides = {}) {
  const fixtures = {
    '/': shellFixture,
    '/v23.3/round31-match-center-stability.mjs': runtimeFixture,
    ...overrides,
  };
  return async input => {
    const path = new URL(String(input)).pathname;
    return Object.prototype.hasOwnProperty.call(fixtures, path)
      ? response(fixtures[path])
      : response('not found', 404);
  };
}

test('Round 33 deployment probe verifies external Overview preservation and Match Center ownership', async () => {
  const report = await probeRound33Deployment({ fetchImpl:fixtureFetch(), writeArtifact:false });
  assert.equal(report.ok, true);
  assert.equal(report.overview.round33Marker, true);
  assert.equal(report.overview.preservesLegacyOverview, true);
  assert.equal(report.overview.removesOnlySerieAContextAndForm, true);
  assert.equal(report.ownership.persistentSuspendedMarker, true);
  assert.equal(report.ownership.suspendedCssIsolation, true);
  assert.equal(report.runtime.noRound31OverviewReplacement, true);
  assert.equal(report.runtime.noRound31OverviewCaptureHijack, true);
});

test('Round 33 deployment probe rejects a sanitizer that no longer removes Form', async () => {
  await assert.rejects(
    probeRound33Deployment({
      fetchImpl:fixtureFetch({
        '/':shellFixture.replace("holder.querySelectorAll?.('.cw14-form-card');", ''),
      }),
      writeArtifact:false,
    }),
    /Round 33 deployment markers are incomplete/,
  );
});

test('Round 33 deployment probe rejects a reintroduced Round31 external Overview replacement', async () => {
  await assert.rejects(
    probeRound33Deployment({
      fetchImpl:fixtureFetch({
        '/v23.3/round31-match-center-stability.mjs':runtimeFixture + '\nconst nextHtml = renderRound31ExternalOverview(activeExternal.data);',
      }),
      writeArtifact:false,
    }),
    /Round 33 deployment markers are incomplete/,
  );
});

test('TEST workflow probes and uploads the Round 33 deployment observation on develop pushes', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url), 'utf8');
  assert.match(workflow, /name: Probe deployed Round 33 fixes/);
  assert.match(workflow, /if: github\.event_name == 'push'/);
  assert.match(workflow, /node scripts\/probe-round33-deployment\.mjs/);
  assert.match(workflow, /name: Upload Round 33 deployment observation/);
  assert.match(workflow, /ciao-v23-3-round33-deployment/);
  assert.match(workflow, /cloudflare-test\/artifacts\/v23-3-round33-deployment\.json/);
});
