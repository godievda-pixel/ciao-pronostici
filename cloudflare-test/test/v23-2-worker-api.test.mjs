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

function bsdEvent(id, homeId, awayId) {
  return {
    id,
    league: { id: 7, name: 'Champions League' },
    season: { id: 2607, name: 'Champions League 2026/27', year: 2026 },
    home_team: { id: homeId, name: homeId === 110 ? 'Internazionale' : `Team ${homeId}`, country_code: homeId === 110 ? 'IT' : 'GB' },
    away_team: { id: awayId, name: `Team ${awayId}`, country_code: 'GB' },
    event_date: '2026-09-16T19:00:00+00:00',
    status: 'upcoming',
    home_score: null,
    away_score: null,
    round_number: 1,
    round_name: 'League Phase',
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

test('v23.2 UEFA route uses BSD v2 with server token and returns only Italian-club matches', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const value = String(url);
    requests.push({ url: value, authorization: new Headers(options.headers).get('authorization') });

    if (value.includes('/api/v2/leagues/?')) {
      return Response.json({ count: 4, next: null, results: [
        { id: 7, name: 'Champions League', country: 'Europe' },
        { id: 8, name: 'Europa League', country: 'Europe' },
        { id: 9, name: 'Conference League', country: 'Europe' },
        { id: 10, name: 'Coppa Italia', country: 'Italy' },
      ] });
    }
    if (value.includes('/api/v2/leagues/7/season/')) {
      return Response.json({ id: 2607, name: 'Champions League 2026/27', year: 2026, is_current: true });
    }
    if (value.includes('/api/v2/teams/?')) {
      return Response.json({ count: 1, next: null, results: [
        { id: 110, name: 'Internazionale', country_code: 'IT' },
      ] });
    }
    if (value.includes('/api/v2/events/?')) {
      return Response.json({ count: 2, next: null, results: [
        bsdEvent(1001, 110, 359),
        bsdEvent(1002, 86, 132),
      ] });
    }
    throw new Error(`unexpected URL ${value}`);
  };

  try {
    const env = {
      BSD_API_KEY: 'bsd-test-key',
      CIAO_WEB_API: { fetch: async () => { throw new Error('legacy API must not be called'); } },
      ASSETS: { fetch: async () => new Response('asset') },
    };
    const response = await worker.fetch(
      new Request('https://ciao-web-app-test.example/api/v23.2/matches?competition=ucl&from=2026-09-01&to=2026-10-31', {
        headers: { 'x-telegram-init-data': 'tg-init-data' },
      }),
      env,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.data.competition, 'ucl');
    assert.equal(body.data.matches.length, 1);
    assert.equal(body.data.matches[0].matchId, 'ucl:1001');
    assert.equal(body.data.matches[0].homeTeam.countryCode, 'ITA');
    assert.equal(requests.every(item => item.authorization === 'Token bsd-test-key'), true);
    assert.equal(requests.some(item => item.url.includes('sports.bzzoiro.com/api/v2/leagues/')), true);
    assert.equal(requests.some(item => item.url.includes('/api/v2/leagues/7/season/')), true);
    assert.equal(requests.some(item => item.url.includes('/api/v2/teams/?') && item.url.includes('country_code=IT')), true);
    assert.equal(requests.some(item => item.url.includes('/api/v2/events/?') && item.url.includes('league_id=7') && item.url.includes('season_id=2607')), true);
    assert.equal(requests.some(item => item.url.includes('espn')), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('v23.2 external competition route rejects invalid date range cleanly', async () => {
  const env = {
    BSD_API_KEY: 'bsd-test-key',
    CIAO_WEB_API: { fetch: async () => Response.json(schedulePayload()) },
    ASSETS: { fetch: async () => new Response('asset') },
  };
  const response = await worker.fetch(
    new Request('https://ciao-web-app-test.example/api/v23.2/matches?competition=ucl&from=2026-10-31&to=2026-09-01', {
      headers: { 'x-telegram-init-data': 'tg-init-data' },
    }),
    env,
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'invalid_date_range');
});

test('v23.2 matches route rejects unknown competitions', async () => {
  const env = {
    CIAO_WEB_API: { fetch: async () => Response.json(schedulePayload()) },
    ASSETS: { fetch: async () => new Response('asset') },
  };

  const response = await worker.fetch(
    new Request('https://ciao-web-app-test.example/api/v23.2/matches?competition=world_cup', {
      headers: { 'x-telegram-init-data': 'tg-init-data' },
    }),
    env,
  );
  const body = await response.json();

  assert.equal(response.status, 501);
  assert.equal(body.ok, false);
  assert.equal(body.competition, 'world_cup');
});
