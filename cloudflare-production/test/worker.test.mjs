import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { createWorker } from '../src/worker.js';
import { BsdUpstreamError } from '../src/matches/bsd-provider.mjs';

function env(overrides = {}) {
  return {
    BSD_API_KEY: 'fake-bsd-key',
    ASSETS: { fetch: async request => new Response(`asset:${new URL(request.url).pathname}`, { status: 200 }) },
    ...overrides,
  };
}

function req(path, options = {}) {
  return new Request(`https://ciao-web-app.example${path}`, options);
}

function authHeaders() {
  return { 'x-telegram-init-data': 'signed-client-data' };
}

function fakeCache() {
  const map = new Map();
  return {
    async match(request) {
      const key = typeof request === 'string' ? request : request.url;
      const response = map.get(key);
      return response ? response.clone() : undefined;
    },
    async put(request, response) {
      const key = typeof request === 'string' ? request : request.url;
      map.set(key, response.clone());
    },
  };
}

test('healthz reports BSD readiness and both deployed normalizer paths without exposing the secret', async () => {
  const response = await worker.fetch(req('/healthz'), env());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    ok: true,
    service: 'ciao-web-app',
    matches_provider: 'bsd-v2',
    bsd_configured: true,
    normalizer_probe: 'league-1',
    provider_normalizer_probe: 'league-1',
  });
  assert.equal(JSON.stringify(body).includes('fake-bsd-key'), false);

  const missing = await worker.fetch(req('/healthz'), env({ BSD_API_KEY: '' }));
  assert.equal((await missing.json()).bsd_configured, false);
});

test('matches API rejects unsupported methods, bad competitions and missing client gate', async () => {
  const custom = createWorker({ fetchMatches: async () => [] });

  const post = await custom.fetch(req('/api/cw22/matches?competition=ucl&from=2026-07-01&to=2027-06-30', {
    method: 'POST', headers: authHeaders(),
  }), env());
  assert.equal(post.status, 405);

  const bad = await custom.fetch(req('/api/cw22/matches?competition=serie_a&from=2026-07-01&to=2027-06-30', {
    headers: authHeaders(),
  }), env());
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, 'invalid_competition');

  const missingGate = await custom.fetch(req('/api/cw22/matches?competition=ucl&from=2026-07-01&to=2027-06-30'), env());
  assert.equal(missingGate.status, 401);
  assert.equal((await missingGate.json()).error, 'telegram_init_data_required');
});

test('matches API reports missing BSD secret without leaking configuration details', async () => {
  const custom = createWorker({ fetchMatches: async () => [] });
  const response = await custom.fetch(req('/api/cw22/matches?competition=ucl&from=2026-07-01&to=2027-06-30', {
    headers: authHeaders(),
  }), env({ BSD_API_KEY: '' }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: 'bsd_api_key_missing' });
});

test('matches API returns the canonical envelope with runtime revision and shields BSD with a 20 second URL cache', async () => {
  let calls = 0;
  const cache = fakeCache();
  const custom = createWorker({
    cache,
    fetchMatches: async ({ competition, from, to, apiKey }) => {
      calls += 1;
      assert.equal(apiKey, 'fake-bsd-key');
      return [{ matchId: `${competition}:1`, kickoffAt: `${from}T19:00:00Z`, to }];
    },
  });
  const url = '/api/cw22/matches?competition=ucl&from=2026-07-01&to=2027-06-30';

  const first = await custom.fetch(req(url, { headers: authHeaders() }), env());
  const firstBody = await first.json();
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('cache-control'), 'private, max-age=0');
  assert.deepEqual(firstBody, {
    ok: true,
    data: {
      competition: 'ucl',
      from: '2026-07-01',
      to: '2027-06-30',
      provider: 'bsd-v2',
      runtime_revision: 'cw22-matches-v2',
      matches: [{ matchId: 'ucl:1', kickoffAt: '2026-07-01T19:00:00Z', to: '2027-06-30' }],
    },
  });

  const second = await custom.fetch(req(url, { headers: { 'x-telegram-init-data': 'another-user' } }), env());
  assert.equal(second.status, 200);
  assert.equal(calls, 1);
});

test('debug_stage returns only injected safe stage probe metadata', async () => {
  const custom = createWorker({
    fetchMatches: async () => [],
    fetchStageProbe: async () => ({
      event_id: '1',
      round_name: 'Матчи',
      stage: null,
      phase: null,
      group_name: null,
      round_number: null,
      round: 1,
      matchday: null,
      normalized_stage_key: 'league-1',
      normalized_stage_label: 'Общий этап · 1 тур',
      normalized_round: 1,
    }),
  });
  const response = await custom.fetch(req('/api/cw22/matches?competition=ucl&from=2026-07-01&to=2027-06-30&debug_stage=1', {
    headers: authHeaders(),
  }), env());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.stage_probe.round_name, 'Матчи');
  assert.equal(body.data.stage_probe.round, 1);
  assert.equal(body.data.stage_probe.normalized_stage_key, 'league-1');
  assert.equal(JSON.stringify(body).includes('fake-bsd-key'), false);
});

test('BSD upstream errors expose safe diagnostics only', async () => {
  const custom = createWorker({
    fetchMatches: async () => { throw new BsdUpstreamError('events', 401, 'authentication_failed'); },
  });
  const response = await custom.fetch(req('/api/cw22/matches?competition=ucl&from=2026-07-01&to=2027-06-30', {
    headers: authHeaders(),
  }), env());
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.deepEqual(body, {
    ok: false,
    error: 'competition_upstream_failed',
    upstream_stage: 'events',
    upstream_status: 401,
    upstream_code: 'authentication_failed',
  });
  assert.equal(JSON.stringify(body).includes('fake-bsd-key'), false);
});

test('non API requests are delegated unchanged to Static Assets', async () => {
  let seen = null;
  const request = req('/releases/v22-5.html?x=1', { headers: { 'x-test': 'yes' } });
  const response = await worker.fetch(request, env({
    ASSETS: {
      fetch: async incoming => {
        seen = incoming;
        return new Response('asset-ok');
      },
    },
  }));
  assert.equal(await response.text(), 'asset-ok');
  assert.equal(seen, request);
});
