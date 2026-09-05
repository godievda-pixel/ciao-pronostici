import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ROUND511_ACTIVE_MATCH_CENTER_CSS,
  serieAMatchBootstrapFromCard,
} from '../src/v23.3/round51-1-active-match-center-ui.mjs';

function node({ textContent = '', src = '', datetime = '' } = {}) {
  return {
    textContent,
    getAttribute(name) {
      if (name === 'src') return src;
      if (name === 'datetime') return datetime;
      return '';
    },
  };
}

test('Round 51.1 active Match Center keeps five form results in one equal row', () => {
  assert.match(ROUND511_ACTIVE_MATCH_CENTER_CSS, /#ciao-v239-match-center-overlay \.cw233-mc-form-run\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(ROUND511_ACTIVE_MATCH_CENTER_CSS, /#ciao-v239-match-center-overlay \.cw233-mc-form-chip\{min-width:0;width:100%;height:24px/);
});

test('Round 51.1 active Match Center makes the signed-in user prediction prominent', () => {
  assert.match(ROUND511_ACTIVE_MATCH_CENTER_CSS, /#ciao-v239-match-center-overlay \.cw250-user-prediction b\{[^}]*font-size:32px/);
});

test('Round 51.1 can bootstrap Serie A Match Center crests from the already enriched Matches card', () => {
  const selectors = new Map([
    ['time[datetime]', node({ datetime:'2026-09-05T19:45:00Z' })],
    ['.cw232-match-team--home strong', node({ textContent:'Рома' })],
    ['.cw232-match-team--home img', node({ src:'https://img.test/roma.png' })],
    ['.cw232-match-team--away strong', node({ textContent:'Аталанта' })],
    ['.cw232-match-team--away img', node({ src:'https://img.test/atalanta.png' })],
  ]);
  const card = {
    dataset:{ cw232Match:'serie_a:900', cw232MatchState:'finished' },
    querySelector(selector) { return selectors.get(selector) || null; },
  };

  assert.deepEqual(serieAMatchBootstrapFromCard(card), {
    competition:'serie_a',
    matchId:'serie_a:900',
    kickoffAt:'2026-09-05T19:45:00Z',
    status:'finished',
    homeTeam:{ name:'Рома', crestUrl:'https://img.test/roma.png' },
    awayTeam:{ name:'Аталанта', crestUrl:'https://img.test/atalanta.png' },
  });
});

test('Round 51.1 active UI module is installed by the v23.3 entrypoint', async () => {
  const source = await readFile(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
  assert.match(source, /import '\.\/round51-1-active-match-center-ui\.mjs';/);
});
