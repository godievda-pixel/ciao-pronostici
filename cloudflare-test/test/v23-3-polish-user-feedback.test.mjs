import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shouldIncludeMatch } from '../src/v23.2/match-normalizer.mjs';
import { normalizePredictionSeason } from '../src/v23.3/prediction-match-resolver.mjs';
import { normalizeStandingRows } from '../src/v23.3/standing-normalizer.mjs';
import { renderMatchesHub } from '../src/v23.2/matches-ui.mjs';

test('UEFA feeds include only matches with an Italian club', () => {
  assert.equal(shouldIncludeMatch({
    competition:'ucl',
    homeTeam:{name:'Интер',countryCode:''},
    awayTeam:{name:'Арсенал',countryCode:'ENG'},
  }), true);
  assert.equal(shouldIncludeMatch({
    competition:'uel',
    homeTeam:{name:'Аякс',countryCode:'NED'},
    awayTeam:{name:'Рома',countryCode:''},
  }), true);
  assert.equal(shouldIncludeMatch({
    competition:'uecl',
    homeTeam:{name:'Челси',countryCode:'ENG'},
    awayTeam:{name:'Бетис',countryCode:'ESP'},
  }), false);
  assert.equal(shouldIncludeMatch({
    competition:'coppa_italia',
    homeTeam:{name:'Сассуоло',countryCode:'ITA'},
    awayTeam:{name:'Фрозиноне',countryCode:'ITA'},
  }), true);
});

test('prediction season accepts BSD start-year notation', () => {
  assert.equal(normalizePredictionSeason('2026'), '2026-27');
  assert.equal(normalizePredictionSeason('2026/27'), '2026-27');
});

test('standing logos accept legacy and BSD logo_url variants', () => {
  const [row] = normalizeStandingRows({ rows:[{ position:1, team:{ id:'7', name:'Roma', logo_url:'https://img.example/roma.png' }, played:2, points:6 }] }, 'serie_a');
  assert.equal(row.team.crestUrl, 'https://img.example/roma.png');
});

test('predictions no longer block match rendering on ranking request or show a permanent full-screen loader', async () => {
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Загружаем прогнозы/);
  assert.doesNotMatch(source, /Promise\.all\(\s*\[\s*client\.available\('all'\)\s*,\s*client\.rankingMe/);
  assert.match(source, /client\.available\('all'\)/);
  assert.match(source, /client\.rankingMe\(\)\.then|void\s+client\.rankingMe\(\)/);
});

test('matches hub removes redundant Tournament and Italian-clubs captions', () => {
  const html = renderMatchesHub();
  assert.doesNotMatch(html, />Турнир</i);
  assert.doesNotMatch(html, /Матчи итальянских клубов/i);
});

test('tables mobile layout does not force a 650px horizontal table and uses premium row treatment', async () => {
  const source = await readFile(new URL('../src/v23.3/tables-ui.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /min-width:\s*650px/);
  assert.match(source, /border-spacing:\s*0\s+8px/);
  assert.match(source, /@media\(max-width:620px\)/);
  assert.match(source, /nth-child\(4\)|nth-child\(5\)|nth-child\(6\)|nth-child\(7\)/);
});
