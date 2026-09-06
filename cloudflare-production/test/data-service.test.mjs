import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/modular/data/api-client.mjs';
import { createDataService } from '../src/modular/data/data-service.mjs';

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
  const result = await client.get('/api/modular/ping', { competition:'serie_a' });
  assert.deepEqual(result, { hello:'world' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers['x-telegram-init-data'], 'tg-init-123');
  assert.match(calls[0].url, /competition=serie_a/);
});

test('api client refuses authenticated app data requests without Telegram init data', async () => {
  const client = createApiClient({ initDataResolver: () => '', fetchImpl: async () => { throw new Error('must not fetch'); } });
  await assert.rejects(() => client.get('/api/modular/matches'), /telegram_auth_required/);
});

test('Data Service normalizes matches and isolates one competition failure', async () => {
  const apiClient = {
    async get(path, query) {
      assert.equal(path, '/api/modular/matches');
      if (query.competition === 'uel') throw Object.assign(new Error('uel down'), { status:503 });
      return { matches:[{
        id: query.competition === 'serie_a' ? 10 : 20,
        kickoff_at:'2026-09-10T18:00:00Z',
        home:{id:1,name:'A'}, away:{id:2,name:'B'},
      }] };
    },
  };
  const service = createDataService({ apiClient });
  const result = await service.loadAllMatches({ from:'2026-09-01', to:'2026-10-01' });
  assert.equal(result.matches.length, 4);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].competition, 'uel');
  assert.ok(result.matches.every(match => match.id.includes(':')));
});
