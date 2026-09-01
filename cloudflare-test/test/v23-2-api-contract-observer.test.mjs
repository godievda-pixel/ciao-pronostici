import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverApiCalls,
  summarizeJsonShape,
} from '../src/v23.2/api-contract-observer.mjs';
import {
  safeCalls,
  observeContract,
} from '../scripts/inspect-api-contract.mjs';

test('discovers unique literal API calls and marks dynamic routes as non-concrete', () => {
  const source = `
    fetch('/api/schedule');
    fetch('/api/schedule');
    fetch('/api/matches?round=3', { method: 'GET' });
    fetch(\`/api/match/\${id}\`);
    fetch('/api/predictions', { method: 'POST', body: '{}' });
  `;

  assert.deepEqual(discoverApiCalls(source), [
    {
      route: '/api/match/${id}',
      method: 'GET',
      concrete: false,
      snippet: 'fetch(`/api/match/${id}`)',
    },
    {
      route: '/api/matches?round=3',
      method: 'GET',
      concrete: true,
      snippet: "fetch('/api/matches?round=3', { method: 'GET' })",
    },
    {
      route: '/api/predictions',
      method: 'POST',
      concrete: true,
      snippet: "fetch('/api/predictions', { method: 'POST', body: '{}' })",
    },
    {
      route: '/api/schedule',
      method: 'GET',
      concrete: true,
      snippet: "fetch('/api/schedule')",
    },
  ]);
});

test('summarizes JSON shape without retaining values', () => {
  const value = {
    ok: true,
    matches: [
      {
        id: 1,
        home: { id: 10, name: 'Inter' },
        away: { id: 20 },
      },
    ],
    meta: { round: 3, season: '2026/27' },
  };

  assert.deepEqual(summarizeJsonShape(value), {
    kind: 'object',
    keys: ['matches', 'meta', 'ok'],
    objectKeys: {
      matches: {
        kind: 'array',
        itemKeys: ['away', 'home', 'id'],
        nestedKeys: {
          away: ['id'],
          home: ['id', 'name'],
        },
      },
      meta: { kind: 'object', keys: ['round', 'season'] },
      ok: { kind: 'boolean' },
    },
  });

  const summary = JSON.stringify(summarizeJsonShape(value));
  assert.equal(summary.includes('Inter'), false);
  assert.equal(summary.includes('2026/27'), false);
});

test('safeCalls allows only concrete anonymous GET API calls', () => {
  const calls = [
    { route: '/api/schedule', method: 'GET', concrete: true },
    { route: '/api/match/${id}', method: 'GET', concrete: false },
    { route: '/api/predictions', method: 'POST', concrete: true },
    { route: '/api/user?id=42', method: 'GET', concrete: true },
  ];

  assert.deepEqual(safeCalls(calls).map(call => call.route), ['/api/schedule']);
});

test('observeContract stores schema only for successful JSON GET responses', async () => {
  const requests = [];
  const fetchImpl = async url => {
    requests.push(String(url));
    if (String(url).includes('/releases/v23.1/')) {
      return new Response("<script>fetch('/api/schedule')</script>", {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    }

    return Response.json({
      matches: [{ id: 1, home: { name: 'Inter' } }],
    });
  };

  const result = await observeContract({
    baseUrl: 'https://prod.example/releases/v23.1/',
    testOrigin: 'https://test.example',
    fetchImpl,
  });

  assert.equal(requests.at(-1), 'https://test.example/api/schedule');
  assert.equal(result.probes[0].status, 200);
  assert.deepEqual(result.probes[0].shape.keys, ['matches']);
  assert.equal(JSON.stringify(result).includes('Inter'), false);
});
