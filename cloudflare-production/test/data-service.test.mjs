import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/modular/data/api-client.mjs';
import { createDataService } from '../src/modular/data/data-service.mjs';

const CORE = 'https://example.test/functions/v1/ciao-core-api-fast-v6';

test('api client sends Telegram init data through one shared header', async () => {
  const calls = [];
  const client = createApiClient({
    initDataResolver: () => 'tg-init-123',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok:true, data:{ hello:'world' } }), {
        status:200,
        headers:{ 'content-type':'application/json' },
      });
    },
  });
  const result = await client.post(CORE, { action:'modular_matches', competition:'serie_a' });
  assert.deepEqual(result, { hello:'world' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, CORE);
  assert.equal(calls[0].init.headers['x-telegram-init-data'], 'tg-init-123');
});

test('api client refuses authenticated app data requests without Telegram init data', async () => {
  const client = createApiClient({ initDataResolver: () => '', fetchImpl: async () => { throw new Error('must not fetch'); } });
  await assert.rejects(() => client.post(CORE, { action:'modular_matches' }), /telegram_auth_required/);
});

test('Data Service uses the current core endpoint and normalizes matches while isolating one competition failure', async () => {
  const calls = [];
  const apiClient = {
    async post(url, body) {
      calls.push({ url, body });
      assert.equal(url, CORE);
      if (body.competition === 'uel') throw Object.assign(new Error('uel down'), { status:503 });
      return { matches:[{
        id: body.competition === 'serie_a' ? 10 : 20,
        kickoff_at:'2026-09-10T18:00:00Z',
        home:{id:1,name:'A'}, away:{id:2,name:'B'},
      }] };
    },
  };
  const service = createDataService({ apiClient, coreUrl:CORE });
  const result = await service.loadAllMatches({ from:'2026-09-01', to:'2026-10-01' });
  assert.equal(result.matches.length, 4);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].competition, 'uel');
  assert.ok(result.matches.every(match => match.id.includes(':')));
  assert.ok(calls.every(call => call.body.action === 'modular_matches'));
  assert.equal(calls.some(call => String(call.url).startsWith('/api/modular/')), false);
});

test('Data Service maps every modular capability to a current-core action', async () => {
  const calls=[];
  const apiClient={post:async(url,body)=>{calls.push({url,body});return body.action==='modular_matches'?{matches:[]}:{ok:true}}};
  const service=createDataService({apiClient,coreUrl:CORE});
  await service.loadMatches({competition:'ucl'});
  await service.loadStandings('ucl');
  await service.loadFavoriteClub();
  await service.loadPredictions({mode:'mine'});
  await service.savePredictions({competition:'ucl',predictions:[]});
  await service.loadRanking({scope:'europe'});
  await service.loadMatchCenter({competition:'ucl',matchId:'ucl:1',section:'stats'});
  assert.deepEqual(calls.map(x=>x.body.action),[
    'modular_matches','modular_standings','modular_favorite','modular_predictions','modular_save_predictions','modular_ranking','modular_match_center',
  ]);
});
