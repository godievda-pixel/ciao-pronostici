import test from 'node:test';
import assert from 'node:assert/strict';
import { createPredictionsDataClient } from '../src/predictions/data-client.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('external state uses ciao-external-predictions state action', async () => {
  const calls = [];
  const client = createPredictionsDataClient({
    getInitData: () => 'telegram-init',
    fetchImpl: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return jsonResponse({ ok: true, data: { competition: 'uel', matches: [] } });
    },
  });
  const state = await client.loadExternalState('uel');
  assert.equal(state.competition, 'uel');
  assert.match(calls[0].url, /ciao-external-predictions$/);
  assert.equal(calls[0].body.action, 'state');
  assert.equal(calls[0].body.competition, 'uel');
  assert.equal(calls[0].init.headers['x-telegram-init-data'], 'telegram-init');
  assert.equal(calls[0].init.cache, 'no-store');
});

test('external save uses save_predictions and canonical string ids', async () => {
  const calls = [];
  const client = createPredictionsDataClient({
    getInitData: () => 'tg',
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return jsonResponse({ ok: true, data: { saved: 1 } });
    },
  });
  const items = [{ match_id: 'uel:123', home_score: 1, away_score: 0 }];
  const result = await client.saveExternalPredictions('uel', items);
  assert.equal(result.saved, 1);
  assert.deepEqual(calls[0].body, {
    action: 'save_predictions',
    competition: 'uel',
    predictions: items,
  });
  assert.equal(typeof calls[0].body.predictions[0].match_id, 'string');
});

test('Serie A state and save keep the existing core API contract', async () => {
  const calls = [];
  const client = createPredictionsDataClient({
    getInitData: () => 'tg',
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ url, body });
      if (body.action === 'state') return jsonResponse({ ok: true, selected_round: 7, round: { matches: [] } });
      return jsonResponse({ ok: true, saved: 1 });
    },
  });
  const state = await client.loadSerieAState(7);
  assert.equal(state.selected_round, 7);
  await client.saveSerieAPredictions(7, [{ match_id: 99, home_score: 2, away_score: 1 }]);
  assert.match(calls[0].url, /ciao-core-api-fast-v4$/);
  assert.deepEqual(calls[0].body, { action: 'state', round: 7 });
  assert.deepEqual(calls[1].body, {
    action: 'save_predictions',
    round: 7,
    predictions: [{ match_id: 99, home_score: 2, away_score: 1 }],
  });
});

test('API error is surfaced without returning stale success', async () => {
  const client = createPredictionsDataClient({
    getInitData: () => 'tg',
    fetchImpl: async () => jsonResponse({ ok: false, error: 'feature_disabled' }, 503),
  });
  await assert.rejects(() => client.loadExternalState('uel'), /feature_disabled/);
});
