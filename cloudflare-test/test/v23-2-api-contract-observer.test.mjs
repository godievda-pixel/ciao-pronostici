import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverApiCalls,
  summarizeJsonShape,
} from '../src/v23.2/api-contract-observer.mjs';

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
