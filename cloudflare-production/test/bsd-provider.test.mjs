import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BSD_BASE,
  BsdUpstreamError,
  fetchBsdMatches,
} from '../src/matches/bsd-provider.mjs';

function json(payload, status = 200, headers = {}) {
  return Response.json(payload, { status, headers });
}

function event(id, overrides = {}) {
  return {
    id,
    event_date: '2026-09-16T19:00:00Z',
    status: 'upcoming',
    round_name: 'League Phase',
    round_number: 1,
    home_team: { id: 77, name: 'Internazionale', country_code: 'IT' },
    away_team: { id: 359, name: 'Arsenal', country_code: 'GB' },
    ...overrides,
  };
}

test('provider resolves configured league aliases and nested current season', async () => {
  const requests = [];
  const fetchImpl = async url => {
    const value = String(url);
    requests.push(value);
    if (value.includes('/leagues/?')) return json({ count: 1, results: [{ id: 7, name: 'UEFA Champions League' }] });
    if (value.endsWith('/leagues/7/season/')) return json({ current_season: { id: 1800, year: 2026 } });
    if (value.includes('/teams/?')) return json({ count: 1, results: [{ id: 77, country_code: 'IT' }] });
    if (value.includes('/events/?')) return json({ count: 1, results: [event(9001)] });
    throw new Error(`unexpected URL ${value}`);
  };

  const matches = await fetchBsdMatches({
    competition: 'ucl', from: '2026-07-01', to: '2027-06-30', apiKey: 'test-key', fetchImpl,
  });

  assert.equal(BSD_BASE, 'https://sports.bzzoiro.com/api/v2');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].matchId, 'ucl:9001');
  assert.equal(requests.some(value => value.includes('/leagues/7/seasons/')), false);
  assert.equal(requests.some(value => value.includes('/teams/?') && value.includes('country_code=IT')), true);
});

test('provider falls back to seasons list and prefers is_current season', async () => {
  const requests = [];
  const fetchImpl = async url => {
    const value = String(url);
    requests.push(value);
    if (value.includes('/leagues/?')) return json({ count: 1, results: [{ id: 8, name: 'Europa League' }] });
    if (value.endsWith('/leagues/8/season/')) return json({ current_season: { name: '26/27' } });
    if (value.includes('/leagues/8/seasons/')) return json({ count: 2, results: [
      { id: 1700, year: 2025, is_current: false },
      { id: 1800, year: 2026, is_current: true },
    ] });
    if (value.includes('/teams/?')) return json({ count: 1, results: [{ id: 77, country_code: 'IT' }] });
    if (value.includes('/events/?')) {
      const parsed = new URL(value);
      assert.equal(parsed.searchParams.get('season_id'), '1800');
      return json({ count: 1, results: [event(9002)] });
    }
    throw new Error(`unexpected URL ${value}`);
  };

  const matches = await fetchBsdMatches({
    competition: 'uel', from: '2026-07-01', to: '2027-06-30', apiKey: 'test-key', fetchImpl,
  });

  assert.equal(matches.length, 1);
  assert.equal(requests.some(value => value.includes('/leagues/8/seasons/')), true);
});

test('provider chooses newest season when no season is explicitly current', async () => {
  const fetchImpl = async url => {
    const value = String(url);
    if (value.includes('/leagues/?')) return json({ count: 1, results: [{ id: 9, name: 'Conference League' }] });
    if (value.endsWith('/leagues/9/season/')) return json({});
    if (value.includes('/leagues/9/seasons/')) return json({ count: 3, results: [
      { id: 1500, year: 2025 },
      { id: 1900, year: 2026 },
      { id: 1800, year: 2026 },
    ] });
    if (value.includes('/teams/?')) return json({ count: 1, results: [{ id: 77, country_code: 'IT' }] });
    if (value.includes('/events/?')) {
      const parsed = new URL(value);
      assert.equal(parsed.searchParams.get('season_id'), '1900');
      return json({ count: 0, results: [] });
    }
    throw new Error(`unexpected URL ${value}`);
  };

  const matches = await fetchBsdMatches({
    competition: 'uecl', from: '2026-07-01', to: '2027-06-30', apiKey: 'test-key', fetchImpl,
  });
  assert.deepEqual(matches, []);
});

test('provider paginates events with limit 200 and increasing offset', async () => {
  const eventOffsets = [];
  const fetchImpl = async url => {
    const value = String(url);
    if (value.includes('/leagues/?')) return json({ count: 1, results: [{ id: 10, name: 'Coppa Italia' }] });
    if (value.endsWith('/leagues/10/season/')) return json({ id: 2000, year: 2026 });
    if (value.includes('/events/?')) {
      const parsed = new URL(value);
      assert.equal(parsed.searchParams.get('league_id'), '10');
      assert.equal(parsed.searchParams.get('season_id'), '2000');
      assert.equal(parsed.searchParams.get('date_from'), '2026-07-01');
      assert.equal(parsed.searchParams.get('date_to'), '2027-06-30');
      assert.equal(parsed.searchParams.get('limit'), '200');
      const offset = Number(parsed.searchParams.get('offset'));
      eventOffsets.push(offset);
      if (offset === 0) {
        return json({ count: 201, results: Array.from({ length: 200 }, (_, i) => event(10000 + i, {
          round_name: 'Round of 32',
          home_team: { id: 1000 + i, name: `Home ${i}` },
          away_team: { id: 2000 + i, name: `Away ${i}` },
        })) });
      }
      return json({ count: 201, results: [event(10200, {
        round_name: 'Round of 32',
        home_team: { id: 1200, name: 'Home 200' },
        away_team: { id: 2200, name: 'Away 200' },
      })] });
    }
    throw new Error(`unexpected URL ${value}`);
  };

  const matches = await fetchBsdMatches({
    competition: 'coppa_italia', from: '2026-07-01', to: '2027-06-30', apiKey: 'test-key', fetchImpl,
  });

  assert.deepEqual(eventOffsets, [0, 200]);
  assert.equal(matches.length, 201);
});

test('provider fetches Italian team IDs for UEFA filters and drops non-Italian matches', async () => {
  const fetchImpl = async url => {
    const value = String(url);
    if (value.includes('/leagues/?')) return json({ count: 1, results: [{ id: 7, name: 'Champions League' }] });
    if (value.endsWith('/leagues/7/season/')) return json({ id: 1800 });
    if (value.includes('/teams/?')) return json({ count: 1, results: [{ id: 63, name: 'Milan' }] });
    if (value.includes('/events/?')) return json({ count: 2, results: [
      event(1, {
        home_team: { id: 359, name: 'Arsenal', country_code: 'GB' },
        away_team: { id: 500, name: 'Barcelona', country_code: 'ES' },
      }),
      event(2, {
        home_team: { id: 359, name: 'Arsenal', country_code: 'GB' },
        away_team: { id: 63, name: 'Milan' },
      }),
    ] });
    throw new Error(`unexpected URL ${value}`);
  };

  const matches = await fetchBsdMatches({
    competition: 'ucl', from: '2026-07-01', to: '2027-06-30', apiKey: 'test-key', fetchImpl,
  });
  assert.deepEqual(matches.map(match => match.sourceId), ['2']);
  assert.equal(matches[0].awayTeam.isItalian, true);
});

test('provider rejects ranges over 370 days before calling BSD', async () => {
  let calls = 0;
  await assert.rejects(
    fetchBsdMatches({
      competition: 'ucl', from: '2026-01-01', to: '2027-12-31', apiKey: 'test-key',
      fetchImpl: async () => { calls += 1; return json({}); },
    }),
    /Date range exceeds 370 days/,
  );
  assert.equal(calls, 0);
});

test('upstream diagnostics expose only stage status and code', async () => {
  const secret = 'super-secret-key';
  const fetchImpl = async () => json({
    error: 'invalid token',
    code: 'authentication_failed',
    detail: `rejected ${secret}`,
  }, 401);

  await assert.rejects(
    fetchBsdMatches({
      competition: 'ucl', from: '2026-07-01', to: '2027-06-30', apiKey: secret, fetchImpl,
    }),
    error => {
      assert.equal(error instanceof BsdUpstreamError, true);
      assert.equal(error.stage, 'leagues');
      assert.equal(error.status, 401);
      assert.equal(error.code, 'authentication_failed');
      assert.equal(error.message.includes(secret), false);
      assert.equal(error.message.includes('invalid token'), false);
      assert.equal(error.message.includes('rejected'), false);
      return true;
    },
  );
});