import test from 'node:test';
import assert from 'node:assert/strict';
import { createPredictionBridge, PREDICTION_HOME_OWNERSHIP } from '../src/modular/data/prediction-bridge.mjs';
import { DEFAULT_PREDICTION_MODE, renderPredictionsScreen, createPredictionsController } from '../src/modular/screens/predictions.mjs';

test('predictions move off Home and default to Прогнозы with two inner controls', () => {
  assert.equal(PREDICTION_HOME_OWNERSHIP, false);
  assert.equal(DEFAULT_PREDICTION_MODE, 'predictions');
  const html = renderPredictionsScreen({ mode:DEFAULT_PREDICTION_MODE, data:{ items:[] } });
  assert.match(html, /<h2>Прогнозы<\/h2>/);
  assert.match(html, /data-prediction-mode="predictions"[^>]*>Прогнозы/);
  assert.match(html, /data-prediction-mode="mine"[^>]*>Мои прогнозы/);
  assert.match(html, /data-prediction-mode="predictions"[^>]*class="[^"]*is-active/);
});

test('prediction bridge passes persistence payload, deadline and scoring fields through unchanged', async () => {
  const calls = [];
  const payload = {
    action:'save_predictions',
    predictions:[{ match_id:77, home_score:2, away_score:1, deadline_at:'2026-09-10T17:45:00Z' }],
    rules:{ exact_score:5, correct_goal_difference:3, correct_outcome:2, miss:0, deadline_minutes:15 },
  };
  const bridge = createPredictionBridge({
    loadAvailable:async()=>({ items:[payload.predictions[0]], rules:payload.rules }),
    loadMine:async()=>({ items:[] }),
    save:async value=>{ calls.push(value); return { ok:true }; },
  });
  const loaded = await bridge.load('predictions');
  assert.deepEqual(loaded.rules, payload.rules);
  await bridge.save(payload);
  assert.strictEqual(calls[0], payload);
});

test('predictions controller switches to Мои прогнозы without duplicating persistence logic', async () => {
  const loaded = [];
  const rendered = [];
  const bridge = {
    async load(mode){ loaded.push(mode); return { items:[{ id:mode }] }; },
    async save(value){ return value; },
  };
  const controller = createPredictionsController({ bridge, render:html=>rendered.push(html) });
  await controller.start();
  await controller.selectMode('mine');
  assert.deepEqual(loaded, ['predictions','mine']);
  assert.equal(controller.state().mode, 'mine');
  assert.match(rendered.at(-1), /data-prediction-mode="mine"[^>]*class="[^"]*is-active/);
});
