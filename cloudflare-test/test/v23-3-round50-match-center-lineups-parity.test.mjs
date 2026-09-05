import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMatchCenterLineups } from '../src/v23.3/match-center-lineups.mjs';

const context = {
  match:{
    homeTeam:{ name:'Интер' },
    awayTeam:{ name:'Ювентус' },
  },
};

const starters = (prefix) => Array.from({ length:11 }, (_, index) => ({
  playerId:index + 1,
  name:`${prefix} ${index + 1}`,
  shirtNumber:index + 1,
  position:index === 0 ? 'GK' : index < 5 ? 'DF' : index < 9 ? 'MF' : 'FW',
}));

const section = {
  home:{
    formation:'3-5-2',
    coach:'Симоне Индзаги',
    starters:starters('Интер'),
    substitutes:[{ playerId:31, name:'Фраттези', shirtNumber:16, position:'MF' }],
  },
  away:{
    formation:'4-3-3',
    coach:'Тиаго Мотта',
    starters:starters('Юве'),
    substitutes:[{ playerId:41, name:'Йылдыз', shirtNumber:10, position:'FW' }],
  },
};

test('Round 50 Lineups redraw has a premium team-switch stage and active-team identity', () => {
  const html = renderMatchCenterLineups(section, context);

  assert.match(html, /data-cw250-mc-lineups-redraw-style/);
  assert.match(html, /data-cw250-mc-lineup-stage/);
  assert.match(html, /data-cw250-mc-lineup-switch/);
  assert.match(html, /data-cw250-mc-pitch-team="home"/);
  assert.match(html, /data-cw250-mc-pitch-team="away"/);
  assert.match(html, /data-cw250-mc-pitch-head/);
  assert.match(html, /Интер/);
  assert.match(html, /3-5-2/);
  assert.match(html, /Симоне Индзаги/);
  assert.match(html, /Ювентус/);
  assert.match(html, /4-3-3/);
  assert.match(html, /Тиаго Мотта/);
});

test('Round 50 Lineups keeps pitch and authoritative starter/bench lists together', () => {
  const html = renderMatchCenterLineups(section, context);

  assert.match(html, /data-cw233-mc-pitch/);
  assert.match(html, /data-cw250-mc-starting-xi/);
  assert.match(html, />Стартовый состав</);
  assert.match(html, /data-cw250-mc-bench/);
  assert.match(html, />Запасные</);
  assert.match(html, /Фраттези/);
  assert.match(html, /Йылдыз/);
  assert.match(html, /data-cw233-mc-lineup-list/);
});

test('Round 50 Lineups keeps deterministic fallback and responsive geometry', () => {
  const html = renderMatchCenterLineups({
    home:{ formation:'???', coach:'Тренер', starters:[{ name:'Один', shirtNumber:1 }] },
    away:{ formation:'4-3-3', starters:starters('Гости') },
  }, context);

  assert.match(html, /Схема недоступна/);
  assert.match(html, /@media\(max-width:420px\)/);
  assert.match(html, /\.cw250-mc-lineup-stage/);
  assert.doesNotMatch(html, /undefined|null/);
});
