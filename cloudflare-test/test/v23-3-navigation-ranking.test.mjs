import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NAVIGATION_LABELS } from '../src/v23.3/navigation-ui.mjs';
import { RANKING_FILTERS, withRankingPositions } from '../src/v23.3/ranking-ui.mjs';

test('v23.3 bottom navigation is exactly the agreed six-tab structure', () => {
  assert.deepEqual(NAVIGATION_LABELS, {
    predict:'Главная',
    mine:'Прогнозы',
    table:'Рейтинг',
    calendar:'Матчи',
    seriea:'Таблицы',
    profile:'Профиль',
  });
});

test('predictions attach to legacy mine tab and never hijack Home predict tab', async () => {
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /data-tab="mine"/);
  assert.doesNotMatch(source, /data-tab="predict"/);
});

test('prediction and ranking overlays explicitly close sibling v23.3 overlays before opening', async () => {
  const predictionSource = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  const rankingSource = await readFile(new URL('../src/v23.3/ranking-ui.mjs', import.meta.url), 'utf8');
  assert.match(predictionSource, /ciao-v233-ranking-overlay/);
  assert.match(predictionSource, /ciao-v233-tables-overlay/);
  assert.match(rankingSource, /ciao-v233-predictions-overlay/);
  assert.match(rankingSource, /ciao-v233-tables-overlay/);
});

test('ranking filters expose overall plus all five competitions', () => {
  assert.deepEqual(RANKING_FILTERS.map(item => item.key), [
    'overall','serie_a','coppa_italia','ucl','uel','uecl',
  ]);
});

test('ranking positions preserve deterministic server order', () => {
  const rows = withRankingPositions([
    {user_id:'u1',points:10},
    {user_id:'u2',points:9},
  ]);
  assert.deepEqual(rows.map(row => [row.position,row.user_id]), [[1,'u1'],[2,'u2']]);
});

test('ranking UI uses prediction client and contains no browser persistence path', async () => {
  const source = await readFile(new URL('../src/v23.3/ranking-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /createPredictionClient/);
  assert.doesNotMatch(source, /localStorage|indexedDB|supabase|save_predictions/i);
});
