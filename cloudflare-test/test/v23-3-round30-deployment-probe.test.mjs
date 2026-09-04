import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { probeRound30Deployment } from '../scripts/probe-round30-deployment.mjs';

function response(body, status = 200) {
  return new Response(body, { status, headers:{ 'content-type':'text/plain; charset=utf-8' } });
}

function fixtureFetch(overrides = {}) {
  const fixtures = {
    '/v23.3/index.mjs': "import './round30-feedback-fixes.mjs'; round30FeedbackFixes: 'enabled'",
    '/v23.3/round30-feedback-fixes.mjs': `
      export const USER_FEEDBACK_ROUND30_BUILD = '2026-09-04-r30';
      #ciao-miniapp-root .cw233-ranking-page:has([data-cw233-rank-filter='overall'][aria-selected='true']),
      #ciao-miniapp-root .cw233-prediction-page:has([data-cw233-filter='all'][aria-selected='true']){
        --r11a:#546681;
        --r11b:#334158;
        --r11soft:rgba(255,255,255,.055);
        --r11line:rgba(255,255,255,.11);
      }
      #ciao-miniapp-root.match-center-open #ciao-v232-matches-overlay{display:none!important;}
      #ciao-miniapp-root.match-center-open .mc-back{display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;}
      #ciao-miniapp-root .cw233-ranking-stat{align-items:center!important;justify-content:center!important;text-align:center!important;}
    `,
    '/v23.3/ranking-ui.mjs': `
      function favoriteClub(row={}){ const team=row?.favorite_team||row?.favoriteTeam||{}; return '<img class="cw233-ranking-club-logo">'; }
    `,
    '/v23.3/prediction-auth.mjs': `
      export function normalizeFavoriteTeam(source={}){}
      const favoriteTeam = normalizeFavoriteTeam(user);
      if (favoriteTeam) result.favoriteTeam = favoriteTeam;
    `,
    '/v23.3/prediction-service.mjs': `
      const favoriteTeam = clubs.get(text(row?.user_id));
      if (favoriteTeam) enriched.favorite_team = favoriteTeam;
      if (authenticated.favoriteTeam) ranking.favorite_team = authenticated.favoriteTeam;
    `,
    ...overrides,
  };
  return async input => {
    const path = new URL(String(input)).pathname;
    return Object.prototype.hasOwnProperty.call(fixtures, path)
      ? response(fixtures[path])
      : response('not found', 404);
  };
}

test('Round 30 deployment probe verifies the shipped TEST runtime and favorite-club pipeline', async () => {
  const report = await probeRound30Deployment({ fetchImpl:fixtureFetch(), writeArtifact:false });
  assert.equal(report.ok, true);
  assert.equal(report.runtime.neutralOverallAndAll, true);
  assert.equal(report.runtime.matchCenterOwnsViewport, true);
  assert.equal(report.runtime.backArrowCentered, true);
  assert.equal(report.runtime.rankingStatsCentered, true);
  assert.equal(report.ranking.favoriteClubBadges, true);
  assert.equal(report.auth.favoriteTeamConditional, true);
  assert.equal(report.service.favoriteTeamConditional, true);
});

test('Round 30 deployment probe rejects a missing runtime marker', async () => {
  await assert.rejects(
    probeRound30Deployment({
      fetchImpl:fixtureFetch({ '/v23.3/round30-feedback-fixes.mjs':'export const USER_FEEDBACK_ROUND30_BUILD = "missing";' }),
      writeArtifact:false,
    }),
    /Round 30 deployment markers are incomplete/,
  );
});

test('TEST workflow probes and uploads the Round 30 deployment observation on develop pushes', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url), 'utf8');
  assert.match(workflow, /name: Probe deployed Round 30 fixes/);
  assert.match(workflow, /if: github\.event_name == 'push'/);
  assert.match(workflow, /node scripts\/probe-round30-deployment\.mjs/);
  assert.match(workflow, /name: Upload Round 30 deployment observation/);
  assert.match(workflow, /ciao-v23-3-round30-deployment/);
  assert.match(workflow, /cloudflare-test\/artifacts\/v23-3-round30-deployment\.json/);
});
