import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeMatches, matchFingerprint } from '../src/v23.2/match-deduper.mjs';

function match({ id, kickoffAt = '2026-12-02T20:00:00Z', stage = 'Round of 16' } = {}) {
  return {
    matchId: `coppa_italia:${id}`,
    competition: 'coppa_italia',
    stage,
    kickoffAt,
    homeTeam: { id: '55', name: 'Фиорентина' },
    awayTeam: { id: '88', name: 'Торино' },
  };
}

test('Coppa Italia removes provider duplicates even when BSD event ids differ', () => {
  const first = match({ id: 1001 });
  const duplicate = match({ id: 1002 });

  assert.equal(matchFingerprint(first), matchFingerprint(duplicate));
  assert.deepEqual(dedupeMatches([first, duplicate]), [first]);
});

test('Coppa Italia keeps legitimate later meetings between the same clubs', () => {
  const first = match({ id: 1001, kickoffAt: '2026-12-02T20:00:00Z', stage: 'Round of 16' });
  const later = match({ id: 1003, kickoffAt: '2027-02-03T20:00:00Z', stage: 'Semifinal' });

  assert.notEqual(matchFingerprint(first), matchFingerprint(later));
  assert.equal(dedupeMatches([first, later]).length, 2);
});
