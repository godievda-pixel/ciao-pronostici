import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverApiCalls,
  discoverApiRouteLiterals,
  extractSourceHints,
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
    { route: '/api/match/${id}', method: 'GET', concrete: false, snippet: 'fetch(`/api/match/${id}`)' },
    { route: '/api/matches?round=3', method: 'GET', concrete: true, snippet: "fetch('/api/matches?round=3', { method: 'GET' })" },
    { route: '/api/predictions', method: 'POST', concrete: true, snippet: "fetch('/api/predictions', { method: 'POST', body: '{}' })" },
    { route: '/api/schedule', method: 'GET', concrete: true, snippet: "fetch('/api/schedule')" },
  ]);
});

test('discovers static API route literals even when fetch uses constants', () => {
  const source = `
    const API_BASE = '/api/ciao-core-api-fast-v4';
    const MATCH_API = '/api/ciao-match-center-fast-v3';
    const SCHEDULE = '/api/ciao-schedule-fast-v1';
    fetch(API_BASE, { method: 'POST' });
    post(SCHEDULE, {});
    const duplicate = '/api/ciao-schedule-fast-v1';
  `;

  assert.deepEqual(discoverApiRouteLiterals(source), [
    '/api/ciao-core-api-fast-v4',
    '/api/ciao-match-center-fast-v3',
    '/api/ciao-schedule-fast-v1',
  ]);
});

test('extracts bounded source hints around known schedule, score, card and network markers', () => {
  const source = `
    async function __cw209LoadSchedule() { return apiJson('/schedule'); }
    function boardStatus(match) { return match.live_status || match.status; }
    function boardScore(match) { return match.home_score + ':' + match.away_score; }
    function __cw9CalendarCard(match) { return match.home.name + match.away.name; }
    function __cw231RawScheduleMatches() { return selectedRound.matches || []; }
    const API_BASE = '/api';
    async function apiJson(path) { return fetch(API_BASE + path).then(r => r.json()); }
  `;

  const hints = extractSourceHints(source);
  assert.equal(hints.some(hint => hint.marker === '__cw209LoadSchedule'), true);
  assert.equal(hints.some(hint => hint.marker === 'boardStatus'), true);
  assert.equal(hints.some(hint => hint.marker === 'boardScore'), true);
  assert.equal(hints.some(hint => hint.marker === '__cw9CalendarCard'), true);
  assert.equal(hints.some(hint => hint.marker === '__cw231RawScheduleMatches'), true);
  assert.equal(hints.some(hint => hint.marker === 'fetch('), true);
  assert.equal(hints.every(hint => hint.snippet.length <= 900), true);
  assert.equal(hints.some(hint => hint.snippet.includes('match.home_score')), true);
});

test('summarizes JSON shape without retaining values', () => {
  const value = {
    ok: true,
    matches: [{ id: 1, home: { id: 10, name: 'Inter' }, away: { id: 20 } }],
    meta: { round: 3, season: '2026/27' },
  };

  assert.deepEqual(summarizeJsonShape(value), {
    kind: 'object',
    keys: ['matches', 'meta', 'ok'],
    objectKeys: {
      matches: { kind: 'array', itemKeys: ['away', 'home', 'id'], nestedKeys: { away: ['id'], home: ['id', 'name'] } },
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

test('observeContract stores schema only for successful JSON GET responses and static source facts', async () => {
  const requests = [];
  const fetchImpl = async url => {
    requests.push(String(url));
    if (String(url).includes('/releases/v23.1/')) {
      return new Response("<script>const SCHEDULE='/api/schedule'; async function __cw209LoadSchedule(){return fetch('/api/schedule')}</script>", {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    }
    return Response.json({ matches: [{ id: 1, home: { name: 'Inter' } }] });
  };

  const result = await observeContract({
    baseUrl: 'https://prod.example/releases/v23.1/',
    testOrigin: 'https://test.example',
    fetchImpl,
  });

  assert.equal(requests.at(-1), 'https://test.example/api/schedule');
  assert.equal(result.probes[0].status, 200);
  assert.deepEqual(result.probes[0].shape.keys, ['matches']);
  assert.deepEqual(result.routeLiterals, ['/api/schedule']);
  assert.equal(result.sourceHints.some(hint => hint.marker === '__cw209LoadSchedule'), true);
  assert.equal(JSON.stringify(result).includes('Inter'), false);
});
