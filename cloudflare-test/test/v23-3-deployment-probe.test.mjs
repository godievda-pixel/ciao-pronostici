import test from 'node:test';
import assert from 'node:assert/strict';
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
