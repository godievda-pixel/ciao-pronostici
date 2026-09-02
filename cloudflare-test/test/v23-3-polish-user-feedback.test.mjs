import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shouldIncludeMatch } from '../src/v23.2/match-normalizer.mjs';
import { normalizePredictionSeason } from '../src/v23.3/prediction-match-resolver.mjs';
import { normalizeStandingRows } from '../src/v23.3/standing-normalizer.mjs';

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

test('predictions render available matches progressively without waiting for ranking and have no permanent loading copy', async () => {
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Загружаем прогнозы/);
  assert.doesNotMatch(source, /Promise\.all\(\s*\[\s*client\.available\('all'\)\s*,\s*client\.rankingMe/);
  assert.match(source, /loadPredictionCompetitionsProgressively/);
  assert.match(source, /client\.available\(competition\)/);
  assert.match(source, /void client\.rankingMe\(\)\.then/);
});

test('premium polish visually removes redundant tournament captions', async () => {
  const source = await readFile(new URL('../src/v23.3/premium-polish-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /cw232-tournament-card__eyebrow,.cw232-tournament-card__hint\{display:none!important\}/);
  assert.match(source, /grid-template-areas:\"title arrow\"/);
});

test('premium tables remove horizontal canvas and collapse secondary stats on mobile', async () => {
  const source = await readFile(new URL('../src/v23.3/premium-polish-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /min-width:0!important/);
  assert.match(source, /border-spacing:0 8px!important/);
  assert.match(source, /@media\(max-width:620px\)/);
  assert.match(source, /nth-child\(4\)/);
  assert.match(source, /nth-child\(7\)/);
  assert.match(source, /hydrateTableLogos/);
});
