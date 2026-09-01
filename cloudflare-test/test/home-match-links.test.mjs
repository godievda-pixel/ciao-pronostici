import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyScheduleSourcePatch } from '../scripts/build.mjs';

test('nearest Serie A card has both club logos and opens match center', () => {
  const source = `
  function __cw231HomeHtml() {
    const rawSchedule = __cw231RawScheduleMatches();
    const visible = [];
    const nearest = visible.length ? null : __cw231NearestMatch(rawSchedule);
    const body = visible.length
      ? \`<div class="cw231-today-list">\${visible.map(__cw231TodayCard).join('')}</div>\`
      : \`<div class="cw231-empty"><b>Сегодня матчей нет</b></div>\`;
    let dateLabel = '';
  }
  `;

  const patched = applyScheduleSourcePatch(source);

  assert.match(patched, /__cw231Logo\(nearest\.homeTeam\)/);
  assert.match(patched, /__cw231Logo\(nearest\.awayTeam\)/);
  assert.match(patched, /data-cw231-action="match"/);
  assert.match(patched, /data-cw231-match="\$\{nearest\.matchId\}"/);
  assert.match(patched, /data-cw231-round="\$\{Number\(nearest\.raw\?\.round_number\) \|\| 0\}"/);
});

test('favorite club nearest-match card is promoted to the existing match-center trigger', async () => {
  const js = await readFile(new URL('../src/ui-v23.1.js', import.meta.url), 'utf8');

  assert.match(js, /cw211-match-btn\[data-cw211-match\]/);
  assert.match(js, /dataset\.cw211Match/);
  assert.match(js, /cw231-favorite-match-card/);
  assert.match(js, /tabIndex\s*=\s*0/);
});
