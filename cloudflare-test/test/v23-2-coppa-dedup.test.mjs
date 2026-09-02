import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeMatches, matchFingerprint } from '../src/v23.2/match-deduper.mjs';

function match({
  id,
  kickoffAt = '2026-12-02T20:00:00Z',
  stage = 'Round of 16',
  homeId = '55',
  homeName = 'Фиорентина',
  awayId = '88',
  awayName = 'Торино',
  status = 'scheduled',
} = {}) {
  return {
    matchId: `coppa_italia:${id}`,
    competition: 'coppa_italia',
    stage,
    kickoffAt,
    status,
    homeTeam: { id: homeId, name: homeName },
    awayTeam: { id: awayId, name: awayName },
  };
}

test('Coppa Italia removes provider duplicates even when BSD event ids differ', () => {
  const first = match({ id: 1001 });
  const duplicate = match({ id: 1002 });

  assert.equal(matchFingerprint(first), matchFingerprint(duplicate));
  assert.deepEqual(dedupeMatches([first, duplicate]), [first]);
});

test('Coppa single-leg stage keeps the newest BSD record for the same tie even when venue/date changed', () => {
  const stale = match({
    id: 588045,
    stage: 'Round of 32',
    kickoffAt: '2026-09-02T13:00:00Z',
    homeId: '72',
    homeName: 'Пиза',
    awayId: '68',
    awayName: 'Фиорентина',
  });
  const current = match({
    id: 600983,
    stage: 'Round of 32',
    kickoffAt: '2026-09-15T19:00:00Z',
    homeId: '68',
    homeName: 'Фиорентина',
    awayId: '72',
    awayName: 'Пиза',
  });

  assert.deepEqual(dedupeMatches([stale, current]), [current]);
});

test('Coppa tie dedup prefers a played/live record over a newer scheduled duplicate', () => {
  const played = match({ id: 1001, stage: 'Quarter-finals', status: 'finished' });
  const staleScheduled = match({ id: 1002, stage: 'Quarter-finals', status: 'scheduled' });
  assert.deepEqual(dedupeMatches([played, staleScheduled]), [played]);
});

test('Coppa Italia keeps legitimate meetings in different stages', () => {
  const first = match({ id: 1001, kickoffAt: '2026-12-02T20:00:00Z', stage: 'Round of 16' });
  const later = match({ id: 1003, kickoffAt: '2027-02-03T20:00:00Z', stage: 'Semifinal' });

  assert.notEqual(matchFingerprint(first), matchFingerprint(later));
  assert.equal(dedupeMatches([first, later]).length, 2);
});

test('Coppa semifinals do not collapse two legs between the same teams', () => {
  const firstLeg = match({ id: 2001, kickoffAt: '2027-02-03T20:00:00Z', stage: 'Semifinal' });
  const secondLeg = match({
    id: 2002,
    kickoffAt: '2027-02-24T20:00:00Z',
    stage: 'Semifinal',
    homeId: '88',
    homeName: 'Торино',
    awayId: '55',
    awayName: 'Фиорентина',
  });
  assert.equal(dedupeMatches([firstLeg, secondLeg]).length, 2);
});
