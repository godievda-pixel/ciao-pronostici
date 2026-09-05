import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMatchCenterPlayers } from '../src/v23.3/match-center-players.mjs';

const context = {
  match:{
    homeTeam:{ name:'Интер' },
    awayTeam:{ name:'Ювентус' },
  },
};

const players = [
  { playerId:9, name:'Тюрам', teamName:'Интер', rating:7.6, minutes:84, goals:1, shots:3 },
  { playerId:10, name:'Лаутаро', teamName:'Интер', rating:8.7, minutes:90, goals:2, assists:1, xg:1.22, xa:0.31, shots:5, keyPasses:2 },
  { playerId:5, name:'Локателли', teamName:'Ювентус', rating:7.1, minutes:90, keyPasses:1 },
];

test('Round 50 Players redraw gives the best player a premium lead card while preserving rating order', () => {
  const html = renderMatchCenterPlayers(players, context);

  assert.match(html, /data-cw250-mc-players-redraw-style/);
  assert.match(html, /data-cw250-mc-player-card/);
  assert.match(html, /data-cw250-mc-player-rank="1"/);
  assert.match(html, /is-top-player/);
  assert.ok(html.indexOf('Лаутаро') < html.indexOf('Тюрам'));
  assert.ok(html.indexOf('Тюрам') < html.indexOf('Локателли'));
  assert.match(html, />8\.7</);
});

test('Round 50 Players renders provider metrics as separate chips and never fabricates missing values', () => {
  const html = renderMatchCenterPlayers(players, context);

  for (const metric of ['minutes','goals','assists','xg','xa','shots','keyPasses']) {
    assert.match(html, new RegExp(`data-cw250-mc-player-metric="${metric}"`));
  }
  assert.match(html, /90 мин/);
  assert.match(html, /2 гола/);
  assert.match(html, /1 ассист/);
  assert.match(html, /xG 1\.22/);
  assert.match(html, /xA 0\.31/);
  assert.match(html, /5 ударов/);
  assert.match(html, /2 ключ\. передачи/);
  assert.doesNotMatch(html, /undefined|null/);
});

test('Round 50 Players has a stable unavailable state and narrow-screen layout', () => {
  const html = renderMatchCenterPlayers([{ playerId:1, name:'Игрок без оценки', teamName:'Интер' }], context);

  assert.match(html, /Оценки игроков пока недоступны/);
  assert.match(html, /@media\(max-width:420px\)/);
  assert.doesNotMatch(html, /0\.0/);
});
