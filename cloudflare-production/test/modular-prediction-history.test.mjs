import test from 'node:test';
import assert from 'node:assert/strict';

const runtimeModule = await import('../../supabase/functions/ciao-core-api-fast-v6/modular-runtime.mjs');

test('saved modular predictions are enriched with real match identity without changing score or points', () => {
  assert.equal(typeof runtimeModule.enrichSavedPredictions, 'function');

  const items = [
    { competition:'serie_a', match_id:'serie_a:77', home_score:1, away_score:2, points:5 },
    { competition:'ucl', match_id:'ucl:601024', home_score:2, away_score:1, points:null },
  ];
  const matches = [
    {
      id:'serie_a:77', competition:'serie_a', kickoffAt:'2026-09-10T18:00:00Z', round:'4',
      home:{ name:'Inter' }, away:{ name:'Milan' },
    },
    {
      id:'ucl:601024', competition:'ucl', kickoffAt:'2026-09-20T19:00:00Z', round:'1',
      home:{ name:'Milan' }, away:{ name:'Real Madrid' },
    },
  ];

  const result = runtimeModule.enrichSavedPredictions({ items, matches });
  assert.equal(result[0].title, 'Inter — Milan');
  assert.equal(result[1].title, 'Milan — Real Madrid');
  assert.strictEqual(result[0].match, matches[0]);
  assert.strictEqual(result[1].match, matches[1]);
  assert.equal(result[0].home_score, 1);
  assert.equal(result[0].away_score, 2);
  assert.equal(result[0].points, 5);
  assert.equal(result[0].kickoff_at, '2026-09-10T18:00:00Z');
  assert.equal(result[0].round, '4');
});

test('saved prediction enrichment preserves unmatched history instead of dropping it', () => {
  assert.equal(typeof runtimeModule.enrichSavedPredictions, 'function');
  const item = { competition:'uel', match_id:'uel:old-1', home_score:0, away_score:0, points:2 };
  const result = runtimeModule.enrichSavedPredictions({ items:[item], matches:[] });
  assert.deepEqual(result, [item]);
});
