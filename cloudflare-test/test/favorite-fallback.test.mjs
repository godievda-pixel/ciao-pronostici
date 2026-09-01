import test from 'node:test';
import assert from 'node:assert/strict';
import { applyScheduleSourcePatch } from '../scripts/build.mjs';

test('home prefetches full Serie A calendar and nearest stays calendar-only', () => {
  const source = `
  function __cw231HomeHtml() {
    const rawSchedule = __cw231RawScheduleMatches();
    const visible = [];
    const nearest = visible.length ? null : __cw231NearestMatch(rawSchedule);
    const body = visible.length ? 'matches' : 'empty';
    let dateLabel = '';
  }
  `;

  const patched = applyScheduleSourcePatch(source);

  assert.match(patched, /__cw209LoadSchedule/);
  assert.match(patched, /__cw209ScheduleLoading/);
  assert.match(patched, /__cw231NearestMatch\(rawSchedule\)/);
  assert.doesNotMatch(patched, /__cw211FavoriteMatch/);
  assert.doesNotMatch(patched, /favorite_team|favoriteRaw|__cw18ClubQuick/);
});
