import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { probeRound28Deployment } from '../scripts/probe-round28-deployment.mjs';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';

function response(body, status = 200) {
  return new Response(body, { status, headers:{ 'content-type':'text/plain; charset=utf-8' } });
}

function fixtureFetch(overrides = {}) {
  const bodies = {
    '/': `
      <script>
        /* cw233-round23-unified-state-fixes */
        function __cw233ExternalRuntimeId(detail) { return 9001; }
        matchViewId = __cw233ExternalRuntimeId(detail);
      </script>
    `,
    '/v23.3/legacy-match-center-theme.mjs': `
      export const LEGACY_MATCH_CENTER_THEME_BUILD = 'r28-match-center-fixes';
      #ciao-miniapp-root.match-center-open .mc-shell { border:0!important; outline:0!important; }
      #ciao-miniapp-root.match-center-open .mc-back { display:flex!important; }
      #ciao-miniapp-root.match-center-open .cw14-info-item,
      #ciao-miniapp-root.match-center-open .cw14-form-card {
        border:1px solid color-mix(in srgb,var(--cw233-mc-accent) 42%,rgba(255,255,255,.10))!important;
        background:linear-gradient(145deg,color-mix(in srgb,var(--cw233-mc-accent) 16%,var(--cw233-mc-bg)),color-mix(in srgb,var(--cw233-mc-accent-2) 10%,var(--cw233-mc-bg)))!important;
      }
    `,
    '/v23.2/matches-ui.mjs': `
      function matchCard(match) {
        return '<article class="cw232-match-card"><div class="cw232-match-card__meta"><span class="cw232-match-card__status">МАТЧ НЕ НАЧАЛСЯ</span><time class="cw232-match-card__kickoff"></time></div><span class="cw232-match-card__score">— : —</span><small>ОЖИДАЕМ НАЧАЛО</small></article>';
      }
      .cw232-competition{--cw232-match-accent:#0c5aa8;--cw232-match-accent-2:#287fc7}
      .cw232-competition[data-cw232-theme='coppa']{--cw232-match-accent:#ce2b37;--cw232-match-accent-2:#009246}
      .cw232-competition[data-cw232-theme='champions']{--cw232-match-accent:#3157ff;--cw232-match-accent-2:#7b42ff}
      .cw232-competition[data-cw232-theme='europa']{--cw232-match-accent:#f06722;--cw232-match-accent-2:#ff9b32}
      .cw232-competition[data-cw232-theme='conference']{--cw232-match-accent:#22a866;--cw232-match-accent-2:#55d68e}
      .cw232-group-tabs button[aria-selected='true']{background:linear-gradient(135deg,var(--cw232-match-accent),var(--cw232-match-accent-2))}
    `,
    ...overrides,
  };
  return async input => {
    const url = new URL(String(input), ORIGIN);
    return response(bodies[url.pathname] ?? '', bodies[url.pathname] === undefined ? 404 : 200);
  };
}

test('Round 28 live probe proves Match Center fixes and unified tournament cards on deployed TEST', async () => {
  const report = await probeRound28Deployment({ fetchImpl:fixtureFetch(), writeArtifact:false });
  assert.equal(report.ok, true);
  assert.equal(report.origin, ORIGIN);
  assert.equal(report.home.positiveExternalRuntimeId, true);
  assert.equal(report.matchCenter.round28ThemeBuild, true);
  assert.equal(report.matchCenter.backControlVisible, true);
  assert.equal(report.matchCenter.viewportFrameRemoved, true);
  assert.equal(report.matchCenter.premiumContextCards, true);
  assert.equal(report.matches.richScheduledCard, true);
  assert.equal(report.matches.allTournamentPalettes, true);
  assert.equal(report.matches.groupTabsThemed, true);
});

test('Round 28 live probe fails closed when rich match-card structure is missing', async () => {
  await assert.rejects(
    probeRound28Deployment({ fetchImpl:fixtureFetch({ '/v23.2/matches-ui.mjs':'old matches module' }), writeArtifact:false }),
    /Round 28 deployment markers are incomplete/,
  );
});

test('Round 28 live probe runs after deployment on develop push and uploads evidence', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url), 'utf8');
  assert.match(workflow, /Probe deployed Round 28 fixes/);
  assert.match(workflow, /node scripts\/probe-round28-deployment\.mjs/);
  assert.match(workflow, /name:\s*ciao-v23-3-round28-deployment/);
  assert.match(workflow, /path:\s*cloudflare-test\/artifacts\/v23-3-round28-deployment\.json/);
});
