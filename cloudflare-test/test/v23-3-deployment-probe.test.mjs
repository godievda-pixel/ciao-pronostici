import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  profileFeedCheck,
  standingsReleaseCheck,
} from '../scripts/probe-test-deployment-v233.mjs';

const deploymentProbeUrl = new URL('../scripts/probe-test-deployment-v233.mjs', import.meta.url);

function team(id, name, rawName, countryCode = '') {
  return { id, name, rawName, countryCode };
}

function match(id, competition, homeTeam, awayTeam) {
  return {
    matchId: `${competition}:${id}`,
    competition,
    kickoffAt: '2026-09-08T19:00:00Z',
    status: 'scheduled',
    homeTeam,
    awayTeam,
  };
}

test('deployment profile probe recognizes a known Italian club even when BSD omits countryCode', () => {
  const rows = [{
    competition: 'ucl',
    matches: [match('601024', 'ucl', team('57', 'Реал Мадрид', 'Real Madrid'), team('77', 'Интер', 'Inter'))],
  }];
  const result = profileFeedCheck(rows);
  assert.equal(result.ok, true);
  assert.equal(result.team.name, 'Интер');
  assert.deepEqual(result.sampleMatchIds, ['ucl:601024']);
});

test('deployment standings gate accepts an unpublished empty table but still blocks real failures', () => {
  assert.deepEqual(standingsReleaseCheck({ competition:'ucl', ok:true, rowCount:0, hasForeignClub:false }), { pass:true, status:'pending_provider' });
  assert.deepEqual(standingsReleaseCheck({ competition:'uel', ok:true, rowCount:36, hasForeignClub:true }), { pass:true, status:'ready' });
  assert.deepEqual(standingsReleaseCheck({ competition:'uecl', ok:false, rowCount:0, hasForeignClub:false }), { pass:false, status:'provider_error' });
  assert.deepEqual(standingsReleaseCheck({ competition:'ucl', ok:true, rowCount:36, hasForeignClub:false }), { pass:false, status:'missing_foreign_clubs' });
});

test('deployment probe proves localization against the deployed TEST registry module', async () => {
  const source = await readFile(deploymentProbeUrl, 'utf8');
  assert.match(source, /probeDeployedRegistry/);
  assert.match(source, /\/v23\.2\/team-registry\.mjs/);
  assert.match(source, /data:text\/javascript;base64/);
  assert.match(source, /registry\.isKnownTeamName/);
  assert.match(source, /allUnknownTeamNames/);
  assert.match(source, /releaseHeldForUnknownTeams/);
});

test('deployment probe hard-gates only the Home SERIE A 2026/27 label; reset notice remains diagnostic', async () => {
  const source = await readFile(deploymentProbeUrl, 'utf8');
  assert.match(source, /HOME_SEASON_LABEL\s*=\s*'SERIE A 2026\/27'/);
  assert.match(source, /RESET_NOTICE_TEXT\s*=\s*'Начало нового сезона!'/);
  assert.match(source, /homeSeasonLabelAbsent/);
  assert.match(source, /homeResetNoticePresent/);
  assert.doesNotMatch(source, /deployed TEST is missing the Home new-season notice/);
});

test('deployment probe verifies unified v23.3 Home Tables Predictions Ranking premium polish and navigation runtimes', async () => {
  const source = await readFile(deploymentProbeUrl, 'utf8');
  assert.match(source, /id="ciao-v233"/);
  assert.match(source, /\/v23\.3\/index\.mjs/);
  assert.match(source, /\/v23\.3\/home-integration\.mjs/);
  assert.match(source, /\/v23\.3\/tables-ui\.mjs/);
  assert.match(source, /\/v23\.3\/predictions-ui\.mjs/);
  assert.match(source, /\/v23\.3\/ranking-ui\.mjs/);
  assert.match(source, /\/v23\.3\/navigation-ui\.mjs/);
  assert.match(source, /\/v23\.3\/premium-polish-ui\.mjs/);
  assert.match(source, /predictionsEnabled/);
  assert.match(source, /rankingEnabled/);
  assert.match(source, /hasPremiumPolish/);
  assert.match(source, /italianOnly/);
  assert.doesNotMatch(source, /predictionsBlocked/);
});

test('deployment probe verifies v23.3 canonical Match Center runtime and link resolver', async () => {
  const source = await readFile(deploymentProbeUrl, 'utf8');
  assert.match(source, /\/v23\.3\/match-center\.mjs/);
  assert.match(source, /\/v23\.3\/match-center-links\.mjs/);
  assert.match(source, /hasMatchCenterRuntime/);
  assert.match(source, /hasMatchCenterLinksRuntime/);
  assert.match(source, /createMatchCenterController/);
  assert.match(source, /openCanonicalMatchCenter/);
  assert.match(source, /resolveCanonicalMatchTarget/);
  assert.match(source, /installCanonicalMatchLinks/);
  assert.match(source, /\/api\/v23\.3\/match-center/);
});

test('deployment probe requires Durable Object prediction health markers and unauthenticated route guard', async () => {
  const source = await readFile(deploymentProbeUrl, 'utf8');
  assert.match(source, /predictionBackend/);
  assert.match(source, /durable-object-sqlite/);
  assert.match(source, /predictionEnvironment/);
  assert.match(source, /predictionSeason/);
  assert.match(source, /2026-27/);
  assert.match(source, /predictionDoConfigured/);
  assert.match(source, /probePredictionAuthGuard/);
  assert.match(source, /telegram_auth_required/);
  assert.match(source, /status\s*!==\s*401|status\s*===\s*401/);
});
