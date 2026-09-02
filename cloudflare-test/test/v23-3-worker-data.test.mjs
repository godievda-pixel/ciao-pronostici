import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function leagueFetch(requests) {
  return async (url, options = {}) => {
    const value = String(url);
    const headers = new Headers(options.headers);
    requests.push({ url: value, authorization: headers.get('authorization') });

    if (value.includes('/api/v2/leagues/?')) {
      return json({ count: 1, results: [{ id: 7, name: 'Champions League' }] });
    }
    if (value.endsWith('/api/v2/leagues/7/season/')) {
      return json({ id: 1800, name: 'Champions League 2026/27', year: 2026, is_current: true });
    }
    if (value.includes('/api/v2/leagues/7/standings/')) {
      return json({ standings: [
        { position: 1, team_id: 57, team_name: 'Real Madrid', played: 8, won: 6, drawn: 1, lost: 1, goals_for: 18, goals_against: 7, goal_difference: 11, pts: 19 },
        { position: 2, team_id: 77, team_name: 'Inter', played: 8, won: 5, drawn: 2, lost: 1, goals_for: 14, goals_against: 8, goal_difference: 6, pts: 17 },
      ] });
    }
    if (value.includes('/api/v2/events/601024/')) {
      return json({
        id: 601024,
        league: { id: 7, name: 'Champions League' },
        season: { id: 1800, name: 'Champions League 2026/27' },
        home_team: { id: 57, name: 'Real Madrid', country_code: 'ES' },
        away_team: { id: 77, name: 'Inter', country_code: 'IT' },
        event_date: '2026-09-08T19:00:00+00:00',
        status: 'live',
        current_minute: 67,
        home_score: 2,
        away_score: 1,
      });
    }
    throw new Error(`unexpected URL ${value}`);
  };
}

function env(overrides = {}) {
  return {
    BSD_API_KEY: 'bsd-server-secret',
    CIAO_WEB_API: {
      async fetch() {
        return json({ ok: true });
      },
    },
    ASSETS: { fetch: async () => new Response('asset') },
    ...overrides,
  };
}

test('v23.3 standings route requires Telegram auth before any upstream call', async () => {
  let upstreamCalls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return json({});
  };

  try {
    const response = await worker.fetch(
      new Request('https://ciao-web-app-test.example/api/v23.3/standings?competition=ucl'),
      env({
        CIAO_WEB_API: {
          async fetch() {
            upstreamCalls += 1;
            return json({ ok: true });
          },
        },
      }),
    );
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, 'telegram_auth_required');
    assert.equal(upstreamCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('v23.3 UEFA standings route uses only the server BSD token and returns canonical rows', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = leagueFetch(requests);

  try {
    const response = await worker.fetch(
      new Request('https://ciao-web-app-test.example/api/v23.3/standings?competition=ucl', {
        headers: { 'x-telegram-init-data': 'telegram-user-init-data' },
      }),
      env(),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.data.competition, 'ucl');
    assert.equal(body.data.provider, 'bsd-v2');
    assert.equal(body.data.rows.length, 2);
    assert.equal(body.data.rows[0].team.name, 'Реал Мадрид');
    assert.equal(body.data.rows[0].points, 19);
    assert.equal(requests.every(item => item.authorization === 'Token bsd-server-secret'), true);
    assert.equal(requests.some(item => item.authorization?.includes('telegram-user-init-data')), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('v23.3 Serie A standings forwards the exact stable serie_a_table request contract', async () => {
  let upstreamRequest = null;
  const response = await worker.fetch(
    new Request('https://ciao-web-app-test.example/api/v23.3/standings?competition=serie_a', {
      headers: { 'x-telegram-init-data': 'tg-init-data' },
    }),
    env({
      CIAO_WEB_API: {
        async fetch(request) {
          upstreamRequest = request;
          return json({
            ok: true,
            serie_a_table: {
              updated_at: '2026-09-02T08:00:00Z',
              rows: [
                {
                  position: 1,
                  team: { id: 77, name: 'Интер', logo: 'https://img.test/inter.png' },
                  played: 3,
                  wins: 3,
                  draws: 0,
                  losses: 0,
                  goal_difference: 5,
                  points: 9,
                },
              ],
            },
          });
        },
      },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(new URL(upstreamRequest.url).pathname, '/api/ciao-core-api-fast-v4');
  assert.equal(upstreamRequest.method, 'POST');
  assert.equal(upstreamRequest.headers.get('content-type'), 'application/json');
  assert.equal(upstreamRequest.headers.get('x-telegram-init-data'), 'tg-init-data');
  assert.deepEqual(JSON.parse(await upstreamRequest.text()), { action: 'serie_a_table' });
  assert.equal(body.data.competition, 'serie_a');
  assert.equal(body.data.provider, 'ciao-web-api');
  assert.equal(body.data.rows[0].team.name, 'Интер');
  assert.equal(body.data.rows[0].points, 9);
});

test('v23.3 BSD match center returns canonical live score and minute', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = leagueFetch(requests);

  try {
    const response = await worker.fetch(
      new Request('https://ciao-web-app-test.example/api/v23.3/match-center?competition=ucl&match_id=ucl%3A601024', {
        headers: { 'x-telegram-init-data': 'tg-init-data' },
      }),
      env(),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.data.provider, 'bsd-v2');
    assert.equal(body.data.match.matchId, 'ucl:601024');
    assert.equal(body.data.match.status, 'live');
    assert.equal(body.data.match.minute, 67);
    assert.equal(body.data.match.homeScore, 2);
    assert.equal(body.data.match.awayScore, 1);
    assert.equal(requests.every(item => item.authorization === 'Token bsd-server-secret'), true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('v23.3 match center rejects competition/id mismatch before BSD lookup', async () => {
  let upstreamCalls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return json({});
  };

  try {
    const response = await worker.fetch(
      new Request('https://ciao-web-app-test.example/api/v23.3/match-center?competition=ucl&match_id=uel%3A601024', {
        headers: { 'x-telegram-init-data': 'tg-init-data' },
      }),
      env(),
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, 'competition_match_mismatch');
    assert.equal(upstreamCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('v23.3 match center requires Telegram auth before BSD lookup', async () => {
  let upstreamCalls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return json({});
  };

  try {
    const response = await worker.fetch(
      new Request('https://ciao-web-app-test.example/api/v23.3/match-center?competition=ucl&match_id=ucl%3A601024'),
      env(),
    );
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, 'telegram_auth_required');
    assert.equal(upstreamCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
