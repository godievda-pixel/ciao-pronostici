import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  profileFeedCheck,
  standingsReleaseCheck,
} from '../scripts/probe-test-deployment.mjs';

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
    matches: [
      match('601024', 'ucl', team('57', 'Реал Мадрид', 'Real Madrid'), team('77', 'Интер', 'Inter')),
    ],
  }];

  const result = profileFeedCheck(rows);
  assert.equal(result.ok, true);
  assert.equal(result.team.name, 'Интер');
  assert.deepEqual(result.sampleMatchIds, ['ucl:601024']);
});

test('deployment standings gate accepts an unpublished empty table but still blocks real failures', () => {
  assert.deepEqual(
    standingsReleaseCheck({ competition: 'ucl', ok: true, rowCount: 0, hasForeignClub: false }),
    { pass: true, status: 'pending_provider' },
  );
  assert.deepEqual(
    standingsReleaseCheck({ competition: 'uel', ok: true, rowCount: 36, hasForeignClub: true }),
    { pass: true, status: 'ready' },
  );
  assert.deepEqual(
    standingsReleaseCheck({ competition: 'uecl', ok: false, rowCount: 0, hasForeignClub: false }),
    { pass: false, status: 'provider_error' },
  );
  assert.deepEqual(
    standingsReleaseCheck({ competition: 'ucl', ok: true, rowCount: 36, hasForeignClub: false }),
    { pass: false, status: 'missing_foreign_clubs' },
  );
});

test('deployment probe proves localization against the deployed TEST registry module', async () => {
  const source = await readFile(new URL('../scripts/probe-test-deployment.mjs', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /import \{ isKnownTeamName \} from '\.\.\/src\/v23\.2\/team-registry\.mjs'/);
  assert.match(source, /probeDeployedTeamRegistry/);
  assert.match(source, /\/v23\.2\/team-registry\.mjs/);
  assert.match(source, /data:text\/javascript;base64/);
  assert.match(source, /registry\.isKnownTeamName/);
  assert.match(source, /registry\.russianTeamName/);
  assert.match(source, /deployedRegistry/);
});

test('deployment probe explicitly verifies unified v23.3 Home and Tables runtime markers', async () => {
  const source = await readFile(new URL('../scripts/probe-test-deployment.mjs', import.meta.url), 'utf8');

  assert.match(source, /id="ciao-v233"/);
  assert.doesNotMatch(source, /id="ciao-v233-home"/);
  assert.doesNotMatch(source, /id="ciao-v233-tables"/);
  assert.match(source, /\/v23\.3\/index\.mjs/);
  assert.match(source, /\/v23\.3\/home-integration\.mjs/);
  assert.match(source, /\/v23\.3\/tables-ui\.mjs/);
  assert.match(source, /hasUnifiedRuntime/);
  assert.match(source, /hasHomeRuntime/);
  assert.match(source, /hasTablesRuntime/);
  assert.match(source, /deployed TEST is missing unified v23\.3 browser runtime/);
});

test('deployment probe explicitly verifies v23.3 canonical Match Center runtime and link resolver', async () => {
  const source = await readFile(new URL('../scripts/probe-test-deployment.mjs', import.meta.url), 'utf8');

  assert.match(source, /\/v23\.3\/match-center\.mjs/);
  assert.match(source, /\/v23\.3\/match-center-links\.mjs/);
  assert.match(source, /hasMatchCenterRuntime/);
  assert.match(source, /hasMatchCenterLinksRuntime/);
  assert.match(source, /createMatchCenterController/);
  assert.match(source, /openCanonicalMatchCenter/);
  assert.match(source, /resolveCanonicalMatchTarget/);
  assert.match(source, /installCanonicalMatchLinks/);
  assert.match(source, /\/api\/v23\.3\/match-center/);
  assert.match(source, /deployed TEST is missing v23\.3 Match Center runtime/);
  assert.match(source, /deployed TEST is missing v23\.3 Match Center links runtime/);
});
