import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyScheduleSourcePatch,
  applyFavoriteMatchSourcePatch,
  applyFavoriteMatchResolverPatch,
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

test('favorite match resolver prefers full Serie A calendar so match center has a real id', () => {
  const source = `
  function __cw211FavoriteMatch(t,d){
    const id=Number(t?.id)||0,live=__cw2017ActiveLeagueMatches().find(m=>Number(m?.home?.id)===id||Number(m?.away?.id)===id);if(live)return {...live,id:Number(live.id),__kind:'live'};
    const next=d?.overview?.next_match||null;if(next)return {...next,id:Number(next.id||next.match_id)||0,__kind:'next'};return null;
  }
  `;

  const patched = applyFavoriteMatchResolverPatch(source);

  assert.match(patched, /__cw209Schedule\?\.rounds/);
  assert.match(patched, /home\?\.id/);
  assert.match(patched, /away\?\.id/);
  assert.match(patched, /kickoff_at/);
  assert.match(patched, /id:Number\(calendarMatch\.id\|\|calendarMatch\.match_id\)\|\|0/);
});

test('favorite club nearest-match card is born with the native match-center binding attribute', () => {
  const source = `
    return \`<div class="cw211-favorite-body"><div class="cw211-info-card"><small>Форма</small></div><div class="cw211-info-card"><small>\${m?.__kind==='live'?'Матч идёт':'Ближайший матч'}</small><div class="cw211-match-line"></div></div></div>\`;
  `;

  const patched = applyFavoriteMatchSourcePatch(source);

  assert.match(patched, /cw231-favorite-source-link/);
  assert.match(patched, /data-cw211-match="\$\{mid\}"/);
  assert.match(patched, /role="button"/);
  assert.match(patched, /tabindex="0"/);
});

test('runtime no longer depends on clicking a hidden match-center button', async () => {
  const js = await readFile(new URL('../src/ui-v23.1.js', import.meta.url), 'utf8');

  assert.doesNotMatch(js, /trigger\.click\(\)/);
  assert.doesNotMatch(js, /cw211-match-btn\[data-cw211-match\]/);
});
