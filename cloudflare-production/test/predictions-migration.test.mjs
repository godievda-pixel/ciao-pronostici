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

test('available prediction cards expose editable score, tournament identity and deadline', () => {
  const html = renderPredictionsScreen({
    mode:'predictions',
    data:{
      rules:{ exact_score:5, correct_goal_difference:3, correct_outcome:2, miss:0, deadline_minutes:15 },
      items:[{
        id:'ucl:601024', match_id:'ucl:601024', competition:'ucl',
        kickoff_at:'2026-09-20T19:00:00Z', deadline_at:'2026-09-20T18:45:00Z',
        prediction:{ home_score:2, away_score:1 },
        match:{
          id:'ucl:601024', competition:'ucl', kickoffAt:'2026-09-20T19:00:00Z', round:'1',
          home:{ id:1, name:'Milan' }, away:{ id:2, name:'Real Madrid' },
        },
      }],
    },
  });

  assert.match(html, /data-prediction-card/);
  assert.match(html, /data-prediction-competition="ucl"/);
  assert.match(html, /data-prediction-match-id="ucl:601024"/);
  assert.match(html, /data-prediction-home[^>]*value="2"/);
  assert.match(html, /data-prediction-away[^>]*value="1"/);
  assert.match(html, /data-prediction-feedback/);
  assert.match(html, /Milan/);
  assert.match(html, /Real Madrid/);
  assert.match(html, /18:45|20 сент/i);
  assert.match(html, /data-prediction-save[^>]*>Сохранить/);
  assert.match(html, /5 \/ 3 \/ 2 \/ 0/);
});

test('Serie A prediction card carries its round into the save surface', () => {
  const html = renderPredictionsScreen({
    mode:'predictions',
    data:{ items:[{
      id:'serie_a:77', match_id:'serie_a:77', competition:'serie_a',
      deadline_at:'2026-09-10T17:45:00Z',
      match:{
        id:'serie_a:77', competition:'serie_a', kickoffAt:'2026-09-10T18:00:00Z', round:'4',
        home:{ name:'Inter' }, away:{ name:'Milan' },
      },
    }] },
  });

  assert.match(html, /data-prediction-match-id="serie_a:77"/);
  assert.match(html, /data-prediction-round="4"/);
});

test('mine prediction cards show saved score and points without edit controls', () => {
  const html = renderPredictionsScreen({
    mode:'mine',
    data:{ items:[{
      competition:'serie_a', match_id:'serie_a:77', title:'Inter — Milan',
      home_score:1, away_score:2, points:5,
      match:{ home:{name:'Inter'}, away:{name:'Milan'}, kickoffAt:'2026-09-06T18:45:00Z' },
    }] },
  });

  assert.match(html, /Inter — Milan|Inter/);
  assert.match(html, /1\s*:\s*2/);
  assert.match(html, /\+5/);
  assert.doesNotMatch(html, /data-prediction-save/);
  assert.doesNotMatch(html, /data-prediction-home/);
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
