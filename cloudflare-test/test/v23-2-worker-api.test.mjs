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

function espnTeams(ids) {
  return {
    sports: [{ leagues: [{ teams: ids.map(id => ({ team: { id: String(id) } })) }] }],
  };
}

function espnEvent(id, homeId, awayId) {
  return {
    id: String(id),
    date: '2026-09-16T19:00:00Z',
    season: { year: 2026, slug: 'league-phase' },
    status: { type: { state: 'pre', completed: false, name: 'STATUS_SCHEDULED' } },
    competitions: [{
      id: String(id),
      date: '2026-09-16T19:00:00Z',
      altGameNote: 'UEFA Champions League, League Phase',
      status: { type: { state: 'pre', completed: false, name: 'STATUS_SCHEDULED' } },
      competitors: [
        { id: String(homeId), homeAway: 'home', team: { id: String(homeId), displayName: `Team ${homeId}` } },
        { id: String(awayId), homeAway: 'away', team: { id: String(awayId), displayName: `Team ${awayId}` } },
      ],
    }],
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

test('v23.2 UEFA route uses ESPN bridge and returns only matches with Italian clubs', async () => {
  const previousFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async url => {
    const value = String(url);
    urls.push(value);
    if (value.includes('/ita.1/teams')) return Response.json(espnTeams([110]));
    if (value.includes('/ita.2/teams')) return Response.json(espnTeams([103]));
    if (value.includes('/uefa.champions/scoreboard')) {
      return Response.json({
        leagues: [{ name: 'UEFA Champions League' }],
        events: [espnEvent(1001, 110, 359), espnEvent(1002, 86, 132)],
      });
    }
    throw new Error(`unexpected URL ${value}`);
  };

  try {
    const env = {
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
    assert.equal(urls.some(url => url.includes('/uefa.champions/scoreboard?dates=20260901-20261031')), true);
    assert.equal(urls.some(url => url.includes('/ita.1/teams')), true);
    assert.equal(urls.some(url => url.includes('/ita.2/teams')), true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('v23.2 external competition route rejects invalid date range cleanly', async () => {
  const env = {
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
