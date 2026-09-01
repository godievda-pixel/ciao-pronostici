import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

function schedulePayload() {
  return {
    ok: true,
    current_round: 3,
    rounds: [
      {
        number: 3,
        matches: [
          {
            id: 777,
            kickoff_at: '2026-09-12T18:45:00Z',
            home: { id: 1, name: 'Интер', logo: 'https://img.test/inter.png' },
            away: { id: 2, name: 'Милан', logo: 'https://img.test/milan.png' },
            is_finished: false,
            home_score: null,
            away_score: null,
          },
        ],
      },
    ],
  };
}

test('GET /api/v23.2/matches?competition=serie_a forwards Telegram auth to legacy schedule and normalizes response', async () => {
  let upstreamRequest = null;
  const env = {
    CIAO_WEB_API: {
      async fetch(request) {
        upstreamRequest = request;
        return Response.json(schedulePayload());
      },
    },
    ASSETS: { fetch: async () => new Response('asset') },
  };

  const request = new Request(
    'https://ciao-web-app-test.example/api/v23.2/matches?competition=serie_a',
    { headers: { 'x-telegram-init-data': 'tg-init-data' } },
  );

  const response = await worker.fetch(request, env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(new URL(upstreamRequest.url).pathname, '/api/ciao-schedule-fast-v1');
  assert.equal(upstreamRequest.method, 'POST');
  assert.equal(upstreamRequest.headers.get('content-type'), 'application/json');
  assert.equal(upstreamRequest.headers.get('x-telegram-init-data'), 'tg-init-data');
  assert.equal(await upstreamRequest.text(), '{}');

  assert.equal(body.ok, true);
  assert.equal(body.data.competition, 'serie_a');
  assert.equal(body.data.currentRound, 3);
  assert.equal(body.data.matches[0].matchId, 'serie_a:777');
  assert.equal(body.data.matches[0].round, 3);
  assert.equal(body.data.matches[0].status, 'scheduled');
});

test('v23.2 matches route rejects missing Telegram auth before calling upstream', async () => {
  let upstreamCalls = 0;
  const env = {
    CIAO_WEB_API: {
      async fetch() {
        upstreamCalls += 1;
        return Response.json(schedulePayload());
      },
    },
    ASSETS: { fetch: async () => new Response('asset') },
  };

  const response = await worker.fetch(
    new Request('https://ciao-web-app-test.example/api/v23.2/matches?competition=serie_a'),
    env,
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
  assert.equal(upstreamCalls, 0);
});

test('v23.2 matches route does not pretend unsupported competitions are ready', async () => {
  const env = {
    CIAO_WEB_API: { fetch: async () => Response.json(schedulePayload()) },
    ASSETS: { fetch: async () => new Response('asset') },
  };

  const response = await worker.fetch(
    new Request('https://ciao-web-app-test.example/api/v23.2/matches?competition=ucl', {
      headers: { 'x-telegram-init-data': 'tg-init-data' },
    }),
    env,
  );
  const body = await response.json();

  assert.equal(response.status, 501);
  assert.equal(body.ok, false);
  assert.equal(body.competition, 'ucl');
});
