import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

function json(payload, status = 200) { return Response.json(payload, { status }); }

function predictionNamespace(handler) {
  const names = [];
  const requests = [];
  return {
    names,
    requests,
    idFromName(name) { names.push(name); return `id:${name}`; },
    get() { return { fetch: async request => { requests.push(request); return handler(request); } }; },
  };
}

function env(ns, overrides = {}) {
  return {
    CIAO_ENV: 'test',
    PREDICTION_SEASON: '2026-27',
    PREDICTION_LEAGUE: ns,
    BSD_API_KEY: 'bsd-test',
    CIAO_WEB_API: {
      async fetch(request) {
        const body = await request.clone().json().catch(() => ({}));
        if (body.action === 'state') {
          return json({ ok: true, user: { id: 42, first_name: 'Daniil', username: 'ciao42' } });
        }
        return json({ ok: true });
      },
    },
    ASSETS: { fetch: async () => new Response('asset') },
    ...overrides,
  };
}

const origin = 'https://ciao-web-app-test.ciao-web.workers.dev';

test('POST predictions requires Telegram auth and never reaches Durable Object without it', async () => {
  const ns = predictionNamespace(async () => json({ ok: true }));
  const response = await worker.fetch(new Request(`${origin}/api/v23.3/predictions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ competition_key:'ucl', predictions:[{ match_id:'ucl:1', home_score:1, away_score:0 }] }),
  }), env(ns));
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error, 'telegram_auth_required');
  assert.equal(ns.requests.length, 0);
});

test('GET predictions returns authenticated rows from active TEST object', async () => {
  const ns = predictionNamespace(async request => {
    const url = new URL(request.url);
    assert.equal(url.pathname, '/user');
    assert.equal(url.searchParams.get('user_id'), 'telegram:42');
    assert.equal(url.searchParams.get('competition'), 'ucl');
    return json({ ok:true, predictions:[{ prediction_id:'p1', user_id:'telegram:42', match_id:'ucl:1' }] });
  });
  const response = await worker.fetch(new Request(`${origin}/api/v23.3/predictions?competition=ucl`, {
    headers: { 'x-telegram-init-data':'signed' },
  }), env(ns));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data[0].prediction_id, 'p1');
  assert.deepEqual(ns.names, ['prediction-league:test:2026-27']);
});

test('GET available rejects unsupported competition before provider and Durable Object reads', async () => {
  const ns = predictionNamespace(async () => json({ ok:true }));
  const response = await worker.fetch(new Request(`${origin}/api/v23.3/predictions/available?competition=invalid`, {
    headers: { 'x-telegram-init-data':'signed' },
  }), env(ns));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error, 'competition_not_supported');
  assert.equal(ns.requests.length, 0);
});

test('competition ranking requires a competition key', async () => {
  const ns = predictionNamespace(async () => json({ ok:true }));
  const response = await worker.fetch(new Request(`${origin}/api/v23.3/rankings?scope=competition`, {
    headers: { 'x-telegram-init-data':'signed' },
  }), env(ns));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error, 'competition_required');
  assert.equal(ns.requests.length, 0);
});

test('TEST reset rejects wrong token without Durable Object mutation', async () => {
  const ns = predictionNamespace(async () => json({ ok:true }));
  const response = await worker.fetch(new Request(`${origin}/api/v23.3/test/predictions/reset`, {
    method:'POST',
    headers:{ 'x-ciao-test-reset-token':'wrong' },
  }), env(ns, { TEST_RESET_TOKEN:'correct' }));
  const body = await response.json();
  assert.equal(response.status, 403);
  assert.equal(body.error, 'reset_forbidden');
  assert.equal(ns.requests.length, 0);
});

test('TEST reset rejects non-TEST origin even with correct token', async () => {
  const ns = predictionNamespace(async () => json({ ok:true }));
  const response = await worker.fetch(new Request('https://ciao-web.example/api/v23.3/test/predictions/reset', {
    method:'POST',
    headers:{ 'x-ciao-test-reset-token':'correct' },
  }), env(ns, { TEST_RESET_TOKEN:'correct' }));
  assert.equal(response.status, 403);
  assert.equal(ns.requests.length, 0);
});

test('valid TEST reset calls active prediction object exactly once', async () => {
  const stages = {
    predictions:{ok:true,affected:2},
    points:{ok:true,affected:2},
    ranking:{ok:true,affected:1},
    caches:{ok:true,affected:1},
  };
  const ns = predictionNamespace(async request => {
    assert.equal(new URL(request.url).pathname, '/reset');
    assert.deepEqual(await request.json(), { environment:'test', season:'2026-27' });
    return json({ ok:true, stages });
  });
  const response = await worker.fetch(new Request(`${origin}/api/v23.3/test/predictions/reset`, {
    method:'POST',
    headers:{ 'x-ciao-test-reset-token':'correct' },
  }), env(ns, { TEST_RESET_TOKEN:'correct' }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.data.stages, stages);
  assert.equal(ns.requests.length, 1);
  assert.deepEqual(ns.names, ['prediction-league:test:2026-27']);
});

test('healthz reports only non-sensitive prediction backend markers', async () => {
  const ns = predictionNamespace(async () => json({ ok:true }));
  const response = await worker.fetch(new Request(`${origin}/healthz`), env(ns, { TEST_RESET_TOKEN:'do-not-expose' }));
  const body = await response.json();
  assert.equal(body.prediction_backend, 'durable-object-sqlite');
  assert.equal(body.prediction_environment, 'test');
  assert.equal(body.prediction_season, '2026-27');
  assert.equal(body.prediction_do_configured, true);
  assert.equal(JSON.stringify(body).includes('do-not-expose'), false);
});
