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
  /* cw233-round34-external-overview-form-only */
  function __cw233Round33IsFormSection(section){
    const heading = section.querySelector?.('.mc-section-title,.cw14-form-title,[data-section-title],h2,h3');
    const headingText = String(heading?.textContent || '').replace(/\\s+/g, ' ').trim();
    return /^Форма(?:\\s|$)/i.test(headingText);
  }
  function __cw233Round33SanitizeExternalOverviewHtml(html){
    const holder = document.createElement('div');
    holder.querySelectorAll?.('.cw14-form-card');
    for (const section of holder.querySelectorAll?.('.mc-section,section') || []) {
      if (__cw233Round33IsFormSection(section)) section.remove?.();
    }
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

const indexFixture = `
  import './round31-match-center-stability.mjs';
  import './round35-match-center-overview-fixes.mjs';
`;

const round35Fixture = `
  export const ROUND35_MATCH_CENTER_BUILD = '2026-09-04-r35';
  export const ROUND36_SERIE_A_HEADER_BUILD = '2026-09-04-r36';
  const ROUND35_CSS = \`
    #ciao-miniapp-root.match-center-open .cw18-match-context{
      --cw233-serie-context-bg:#071626;
      --cw233-serie-context-accent:#0c5aa8;
      --cw233-serie-context-accent-2:#287fc7;
    }
    #ciao-miniapp-root.match-center-open .cw232-competition[data-cw232-competition="serie_a"] > .cw232-competition__head{
      display:none!important;
    }
    #ciao-miniapp-root.match-center-open:is(
      [data-cw233-mc-competition="coppa_italia"],
      [data-cw233-mc-competition="ucl"],
      [data-cw233-mc-competition="uel"],
      [data-cw233-mc-competition="uecl"]
    ) [data-mc-tab-content="overview"] .mc-section:has(.cw14-form-card){display:none!important;}
  \`;
  function removeRound35ExternalOverviewForm(root) {
    const host = root.querySelector?.('[data-mc-tab-content="overview"]');
    for (const marker of host.querySelectorAll?.('.cw14-form-card') || []) {
      const section = marker.closest?.('.mc-section');
      const target = section || marker;
      target.remove?.();
    }
  }
  const observer = new Observer(() => removeRound35ExternalOverviewForm(root));
  observer.observe(root, { childList:true, subtree:true });
`;

function fixtureFetch(overrides = {}) {
  const fixtures = {
    '/': shellFixture,
    '/v23.3/round31-match-center-stability.mjs': runtimeFixture,
    '/v23.3/index.mjs': indexFixture,
    '/v23.3/round35-match-center-overview-fixes.mjs': round35Fixture,
    ...overrides,
  };
  return async input => {
    const path = new URL(String(input)).pathname;
    return Object.prototype.hasOwnProperty.call(fixtures, path)
      ? response(fixtures[path])
      : response('not found', 404);
  };
}

test('Round 33/36 deployment probe verifies final external Form removal, Serie A context palette and header ownership', async () => {
  const report = await probeRound33Deployment({ fetchImpl:fixtureFetch(), writeArtifact:false });
  assert.equal(report.ok, true);
  assert.equal(report.overview.round33Marker, true);
  assert.equal(report.overview.round34FormOnlyMarker, true);
  assert.equal(report.overview.preservesLegacyOverview, true);
  assert.equal(report.overview.removesOnlyExternalForm, true);
  assert.equal(report.ownership.persistentSuspendedMarker, true);
  assert.equal(report.ownership.suspendedCssIsolation, true);
  assert.equal(report.runtime.noRound31OverviewReplacement, true);
  assert.equal(report.runtime.noRound31OverviewCaptureHijack, true);
  assert.equal(report.round35Import.wired, true);
  assert.equal(report.round35Import.afterRound31, true);
  assert.equal(report.round35.buildMarker, true);
  assert.equal(report.round35.round36SerieAHeaderMarker, true);
  assert.equal(report.round35.externalFormSectionRemoval, true);
  assert.equal(report.round35.externalFormCssFailsafe, true);
  assert.equal(report.round35.serieAContextPalette, true);
  assert.equal(report.round35.serieAParentHeaderHidden, true);
  assert.equal(report.round35.lateMutationGuard, true);
});

test('Round 33/35 deployment probe rejects a sanitizer that no longer removes Form', async () => {
  await assert.rejects(
    probeRound33Deployment({
      fetchImpl:fixtureFetch({
        '/':shellFixture.replace("holder.querySelectorAll?.('.cw14-form-card');", ''),
      }),
      writeArtifact:false,
    }),
    /Round 33\/35 deployment markers are incomplete/,
  );
});

test('Round 33/35 deployment probe rejects external sanitizer that removes non-Form Serie A context', async () => {
  const withContextRemoval = shellFixture.replace(
    'if (__cw233Round33IsFormSection(section)) section.remove?.();',
    "if (__cw233Round33IsFormSection(section)) section.remove?.(); if (/Контекст\\s+Серии/i.test(section.textContent || '')) section.remove?.();",
  );
  await assert.rejects(
    probeRound33Deployment({ fetchImpl:fixtureFetch({ '/':withContextRemoval }), writeArtifact:false }),
    /Round 33\/35 deployment markers are incomplete/,
  );
});

test('Round 33/35 deployment probe rejects a reintroduced Round31 external Overview replacement', async () => {
  await assert.rejects(
    probeRound33Deployment({
      fetchImpl:fixtureFetch({
        '/v23.3/round31-match-center-stability.mjs':runtimeFixture + '\nconst nextHtml = renderRound31ExternalOverview(activeExternal.data);',
      }),
      writeArtifact:false,
    }),
    /Round 33\/35 deployment markers are incomplete/,
  );
});

test('Round 35 deployment probe rejects a runtime that hides only Form contents instead of the whole section', async () => {
  const broken = round35Fixture
    .replace('.mc-section:has(.cw14-form-card)', '.cw14-form-card')
    .replace("const section = marker.closest?.('.mc-section');", 'const section = null;');
  await assert.rejects(
    probeRound33Deployment({
      fetchImpl:fixtureFetch({ '/v23.3/round35-match-center-overview-fixes.mjs':broken }),
      writeArtifact:false,
    }),
    /Round 33\/35 deployment markers are incomplete/,
  );
});

test('Round 35 deployment probe rejects a runtime that loses the Serie A context palette', async () => {
  const broken = round35Fixture.replace('--cw233-serie-context-accent:#0c5aa8;', '');
  await assert.rejects(
    probeRound33Deployment({
      fetchImpl:fixtureFetch({ '/v23.3/round35-match-center-overview-fixes.mjs':broken }),
      writeArtifact:false,
    }),
    /Round 33\/35 deployment markers are incomplete/,
  );
});

test('Round 36 deployment probe rejects a runtime that leaks the parent Serie A tournament header', async () => {
  const broken = round35Fixture.replace(
    '#ciao-miniapp-root.match-center-open .cw232-competition[data-cw232-competition="serie_a"] > .cw232-competition__head{\n      display:none!important;\n    }',
    '',
  );
  await assert.rejects(
    probeRound33Deployment({
      fetchImpl:fixtureFetch({ '/v23.3/round35-match-center-overview-fixes.mjs':broken }),
      writeArtifact:false,
    }),
    /Round 33\/35 deployment markers are incomplete/,
  );
});

test('TEST workflow probes and uploads the Round 33/35 deployment observation on develop pushes', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url), 'utf8');
  assert.match(workflow, /name: Probe deployed Round 33 fixes/);
  assert.match(workflow, /if: github\.event_name == 'push'/);
  assert.match(workflow, /node scripts\/probe-round33-deployment\.mjs/);
  assert.match(workflow, /name: Upload Round 33 deployment observation/);
  assert.match(workflow, /ciao-v23-3-round33-deployment/);
  assert.match(workflow, /cloudflare-test\/artifacts\/v23-3-round33-deployment\.json/);
});
