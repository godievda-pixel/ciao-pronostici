import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyScheduleSourcePatch,
  applyFavoriteHtmlSourcePatch,
} from '../scripts/build.mjs';

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

test('favorite home card resolves its clickable id through the same normalized Serie A calendar as Today', () => {
  const source = `
  function __cw231FavoriteHtml() {
    const host = document.createElement('div');
    host.innerHTML = __cw231LegacyHomeAndPredict();
    return host.querySelector('.cw18-favorite-home,.cw2017-favorite-reminder')?.outerHTML || '';
  }
  `;

  const patched = applyFavoriteHtmlSourcePatch(source);

  assert.match(patched, /__cw231RawScheduleMatches\(\)/);
  assert.match(patched, /CiaoV23Today\.normalizeMatch/);
  assert.match(patched, /match\?\.matchId/);
  assert.match(patched, /card\.dataset\.cw231Action = 'match'/);
  assert.match(patched, /card\.dataset\.cw231Match = String\(match\.matchId\)/);
});

test('favorite home match card renders both clubs with logos and calendar status', () => {
  const source = `
  function __cw231FavoriteHtml() {
    const host = document.createElement('div');
    host.innerHTML = __cw231LegacyHomeAndPredict();
    return host.querySelector('.cw18-favorite-home,.cw2017-favorite-reminder')?.outerHTML || '';
  }
  `;

  const patched = applyFavoriteHtmlSourcePatch(source);

  assert.match(patched, /__cw231Logo\(match\.homeTeam\)/);
  assert.match(patched, /__cw231Logo\(match\.awayTeam\)/);
  assert.match(patched, /match\.homeTeam\?\.name/);
  assert.match(patched, /match\.awayTeam\?\.name/);
  assert.match(patched, /__cw231Status\(match\)/);
  assert.match(patched, /__cw231Score\(match\)/);
  assert.match(patched, /match\.status === 'live'/);
  assert.match(patched, /cw231-favorite-match-teams/);
  assert.match(patched, /cw231-favorite-match-status/);
  assert.match(patched, /card\.querySelector\('\.cw211-prediction'\)/);
});

test('favorite home match premium styles keep the whole card interactive', async () => {
  const css = await readFile(new URL('../src/ui-v23.1.css', import.meta.url), 'utf8');

  assert.match(css, /\.cw231-favorite-source-link/);
  assert.match(css, /\.cw231-favorite-match-teams/);
  assert.match(css, /\.cw231-favorite-team img/);
  assert.match(css, /\.cw231-favorite-match-score/);
  assert.match(css, /\.cw231-favorite-match-status/);
});

test('runtime no longer depends on clicking a hidden match-center button', async () => {
  const js = await readFile(new URL('../src/ui-v23.1.js', import.meta.url), 'utf8');

  assert.doesNotMatch(js, /trigger\.click\(\)/);
  assert.doesNotMatch(js, /cw211-match-btn\[data-cw211-match\]/);
});
