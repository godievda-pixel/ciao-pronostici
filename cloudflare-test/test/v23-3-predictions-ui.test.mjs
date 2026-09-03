import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PREDICTION_FILTERS,
  filterPredictionMatches,
  groupPredictionMatchesByDate,
  predictionCardState,
  mergeAuthoritativePrediction,
} from '../src/v23.3/predictions-ui.mjs';

test('prediction browser source contains no persistence fallback or legacy save action', async () => {
  const ui = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/v23.3/prediction-client.mjs', import.meta.url), 'utf8');
  const source = `${ui}\n${client}`;
  assert.doesNotMatch(source, /localStorage|indexedDB|supabase/i);
  assert.doesNotMatch(source, /save_predictions/);
  assert.match(source, /\/api\/v23\.3\/predictions/);
});

test('prediction filters contain only all plus the five real tournaments', () => {
  assert.deepEqual(PREDICTION_FILTERS.map(x => x.key), [
    'all','serie_a','coppa_italia','ucl','uel','uecl',
  ]);
});

test('all available grouping is chronological and stable', () => {
  const groups = groupPredictionMatchesByDate([
    { matchId:'ucl:2', kickoffAt:'2026-09-17T20:00:00Z' },
    { matchId:'ucl:1', kickoffAt:'2026-09-16T19:00:00Z' },
    { matchId:'uel:1', kickoffAt:'2026-09-16T21:00:00Z' },
  ]);
  assert.deepEqual(groups.map(g => g.key), ['2026-09-16','2026-09-17']);
  assert.deepEqual(groups[0].matches.map(x => x.matchId), ['ucl:1','uel:1']);
});

test('prediction filtering is tournament-only and rejects the retired unfilled pseudo-filter', () => {
  const rows = [
    { matchId:'ucl:1', competition:'ucl', state:'open', prediction:null },
    { matchId:'ucl:2', competition:'ucl', state:'open', prediction:{prediction_id:'p2'} },
    { matchId:'uel:1', competition:'uel', state:'locked', prediction:null },
  ];
  assert.deepEqual(filterPredictionMatches(rows, 'unfilled'), []);
  assert.deepEqual(filterPredictionMatches(rows, 'ucl').map(x => x.matchId), ['ucl:1','ucl:2']);
  assert.deepEqual(filterPredictionMatches(rows, 'all').map(x => x.matchId), ['ucl:1','ucl:2','uel:1']);
});

test('card state labels open saved locked and finished predictions', () => {
  assert.equal(predictionCardState({ state:'open', prediction:null }).label, 'Прогноз открыт');
  assert.equal(predictionCardState({ state:'open', prediction:{predicted_home:2,predicted_away:1} }).label, 'Твой прогноз: 2:1 ✓');
  assert.equal(predictionCardState({ state:'locked', prediction:null }).label, 'Прогноз закрыт');
  const finished = predictionCardState({
    state:'finished', homeScore:3, awayScore:1,
    prediction:{predicted_home:2,predicted_away:1,points:2},
  });
  assert.equal(finished.label, 'Итог: 3:1 · +2');
});

test('authoritative save merge preserves match order and replaces only prediction row', () => {
  const matches=[
    {matchId:'ucl:1',prediction:null},
    {matchId:'uel:2',prediction:null},
  ];
  const merged=mergeAuthoritativePrediction(matches,{prediction_id:'p1',match_id:'ucl:1',predicted_home:1,predicted_away:0});
  assert.deepEqual(merged.map(x=>x.matchId),['ucl:1','uel:2']);
  assert.equal(merged[0].prediction.prediction_id,'p1');
  assert.equal(merged[1],matches[1]);
});
