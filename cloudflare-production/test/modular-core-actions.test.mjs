import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODULAR_ACTION_NAMES,
  createModularActionRouter,
} from '../../supabase/functions/ciao-core-api-fast-v6/modular-actions.mjs';

const REQUIRED = [
  'modular_matches',
  'modular_standings',
  'modular_favorite',
  'modular_predictions',
  'modular_save_predictions',
  'modular_ranking',
  'modular_match_center',
];

test('Core v6 exposes the complete modular action contract', () => {
  assert.deepEqual(MODULAR_ACTION_NAMES, REQUIRED);
});

test('modular matches and standings route all five competitions through one contract', async () => {
  const calls = [];
  const router = createModularActionRouter({
    loadMatches: async payload => { calls.push(['matches', payload]); return { matches:[payload.competition] }; },
    loadStandings: async payload => { calls.push(['standings', payload]); return { rows:[payload.competition] }; },
  });

  for (const competition of ['serie_a','coppa_italia','ucl','uel','uecl']) {
    const matches = await router('modular_matches', { competition, from:'2026-09-01', to:'2026-10-01' }, { userId:11 });
    assert.deepEqual(matches, { matches:[competition] });
    const standings = await router('modular_standings', { competition }, { userId:11 });
    assert.deepEqual(standings, { rows:[competition] });
  }

  assert.equal(calls.length, 10);
  await assert.rejects(() => router('modular_matches', { competition:'world_cup' }, { userId:11 }), /invalid_competition/);
});

test('Serie A prediction saves remain on the legacy prediction writer', async () => {
  const calls = [];
  const router = createModularActionRouter({
    saveSerieAPredictions: async payload => { calls.push(['legacy', payload]); return { ok:true, source:'legacy' }; },
    saveExternalPredictions: async payload => { calls.push(['external', payload]); return { ok:true, source:'external' }; },
  });

  const legacyPayload = {
    competition:'serie_a',
    round:4,
    predictions:[{ match_id:77, home_score:2, away_score:1 }],
  };
  const result = await router('modular_save_predictions', legacyPayload, { userId:11 });

  assert.deepEqual(result, { ok:true, source:'legacy' });
  assert.deepEqual(calls, [['legacy', legacyPayload]]);
});

test('external prediction saves are isolated from legacy cp_predictions', async () => {
  const calls = [];
  const router = createModularActionRouter({
    saveSerieAPredictions: async payload => { calls.push(['legacy', payload]); return { ok:true }; },
    saveExternalPredictions: async payload => { calls.push(['external', payload]); return { ok:true, source:'external' }; },
  });

  const payload = {
    competition:'ucl',
    predictions:[{ match_id:'ucl:601024', home_score:1, away_score:0, kickoff_at:'2026-09-20T19:00:00Z' }],
  };
  const result = await router('modular_save_predictions', payload, { userId:11 });

  assert.equal(result.source, 'external');
  assert.deepEqual(calls, [['external', payload]]);
});

test('favorite, predictions, ranking and match center remain injectable server actions', async () => {
  const seen = [];
  const router = createModularActionRouter({
    loadFavorite: async (payload, ctx) => { seen.push(['favorite', payload, ctx]); return { team:{ id:1 } }; },
    loadPredictions: async (payload, ctx) => { seen.push(['predictions', payload, ctx]); return { items:[] }; },
    loadRanking: async (payload, ctx) => { seen.push(['ranking', payload, ctx]); return { rows:[] }; },
    loadMatchCenter: async (payload, ctx) => { seen.push(['match-center', payload, ctx]); return { title:'ok' }; },
  });

  assert.deepEqual(await router('modular_favorite', {}, { userId:9 }), { team:{ id:1 } });
  assert.deepEqual(await router('modular_predictions', { mode:'mine' }, { userId:9 }), { items:[] });
  assert.deepEqual(await router('modular_ranking', { scope:'europe' }, { userId:9 }), { rows:[] });
  assert.deepEqual(await router('modular_match_center', { competition:'uel', match_id:'uel:12', section:'stats' }, { userId:9 }), { title:'ok' });
  assert.equal(seen.length, 4);
});
