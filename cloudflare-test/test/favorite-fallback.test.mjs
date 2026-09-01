import test from 'node:test';
import assert from 'node:assert/strict';
import { applyScheduleSourcePatch } from '../scripts/build.mjs';

test('today nearest falls back to favorite overview next_match', () => {
  const source = `
    const nearest = visible.length ? null : __cw231NearestMatch(rawSchedule);
    const body = visible.length ? 'matches' : 'empty';
    let dateLabel = '';
  `;

  const patched = applyScheduleSourcePatch(source);

  assert.match(patched, /__cw211FavoriteMatch/);
  assert.match(patched, /__cw18ClubQuick/);
  assert.match(patched, /favorite_team/);
  assert.match(patched, /__cw231NearestMatch\(favoriteRaw \? \[favoriteRaw\] : \[\]\)/);
});
