import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { profileFeedCheck } from '../scripts/probe-test-deployment.mjs';

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

test('deployment probe explicitly verifies v23.3 Home and Tables runtime markers', async () => {
  const source = await readFile(new URL('../scripts/probe-test-deployment.mjs', import.meta.url), 'utf8');

  assert.match(source, /id="ciao-v233-home"/);
  assert.match(source, /id="ciao-v233-tables"/);
  assert.match(source, /\/v23\.3\/home-integration\.mjs/);
  assert.match(source, /\/v23\.3\/tables-ui\.mjs/);
  assert.match(source, /hasHomeRuntime/);
  assert.match(source, /hasTablesRuntime/);
  assert.match(source, /deployed TEST is missing v23\.3 Tables runtime/);
});
