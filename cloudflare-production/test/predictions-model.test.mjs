import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupPredictionMatches,
  previousLeagueRoundLabel,
  isStageLocked,
  predictionStatus,
  predictionCardView,
} from '../src/predictions/model.mjs';

test('previous round copy is derived from selected round', () => {
  assert.equal(previousLeagueRoundLabel('league-2'), '1-го тура');
  assert.equal(previousLeagueRoundLabel('league-3'), '2-го тура');
  assert.equal(previousLeagueRoundLabel('league-4'), '3-го тура');
  assert.equal(previousLeagueRoundLabel('league-8'), '7-го тура');
});

test('future stage is locked without requiring lock glyph metadata', () => {
  assert.equal(isStageLocked({ matches: [{ stage_locked: true }, { stage_locked: true }] }), true);
  assert.equal(isStageLocked({ matches: [{ stage_locked: false }] }), false);
  assert.equal(isStageLocked({ matches: [] }), false);
});

test('only live is classified as red status', () => {
  assert.deepEqual(predictionStatus({ status: 'live', minute: 86 }), { text: 'LIVE · 86′', tone: 'live' });
  assert.deepEqual(predictionStatus({ status: 'halftime' }), { text: 'ПЕРЕРЫВ', tone: 'neutral' });
  assert.deepEqual(predictionStatus({ status: 'extra_time' }), { text: 'ДОП. ВРЕМЯ', tone: 'neutral' });
  assert.deepEqual(predictionStatus({ status: 'penalties' }), { text: 'ПЕНАЛЬТИ', tone: 'neutral' });
  assert.deepEqual(predictionStatus({ status: 'finished' }), { text: 'МАТЧ ЗАВЕРШЁН', tone: 'neutral' });
});

test('missing prediction uses compact score plus secondary copy', () => {
  const vm = predictionCardView({ matchId: 'uel:123', prediction: null, status: 'scheduled' }, null);
  assert.equal(vm.predictionText, '— : —');
  assert.equal(vm.predictionMissing, true);
  assert.equal(vm.predictionMissingLabel, 'Прогноз не сделан');
});

test('draft wins over saved prediction without mutating source match', () => {
  const match = { matchId: 'uel:123', prediction: { home_score: 0, away_score: 0 }, status: 'scheduled' };
  const vm = predictionCardView(match, { h: 2, a: 1 });
  assert.equal(vm.predictionText, '2 : 1');
  assert.equal(vm.homeScore, 2);
  assert.equal(vm.awayScore, 1);
  assert.deepEqual(match.prediction, { home_score: 0, away_score: 0 });
});

test('prediction groups are ordered chronologically and keep stage identity', () => {
  const groups = groupPredictionMatches([
    { matchId:'uel:3', stageKey:'league-2', stageLabel:'Общий этап · 2 тур', stageOrder:2, kickoffAt:'2026-10-01T20:00:00Z' },
    { matchId:'uel:1', stageKey:'league-1', stageLabel:'Общий этап · 1 тур', stageOrder:1, kickoffAt:'2026-09-10T20:00:00Z' },
    { matchId:'uel:2', stageKey:'league-1', stageLabel:'Общий этап · 1 тур', stageOrder:1, kickoffAt:'2026-09-10T18:00:00Z' },
  ]);
  assert.deepEqual(groups.map(g => g.key), ['league-1','league-2']);
  assert.deepEqual(groups[0].matches.map(m => m.matchId), ['uel:2','uel:1']);
});
