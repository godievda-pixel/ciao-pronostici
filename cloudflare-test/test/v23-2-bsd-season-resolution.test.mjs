import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBsdMatches } from '../src/v23.2/bsd-provider.mjs';

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

test('BSD provider falls back to the seasons list when current-season payload has no root id', async () => {
  const requests = [];
  const fetchImpl = async url => {
    const value = String(url);
    requests.push(value);

    if (value.includes('/api/v2/leagues/?')) {
      return json({ count: 1, results: [{ id: 7, name: 'Champions League' }] });
    }
    if (value.endsWith('/api/v2/leagues/7/season/')) {
      return json({ current_season: { name: 'UEFA Champions League 26/27' } });
    }
    if (value.includes('/api/v2/leagues/7/seasons/')) {
      return json({
        count: 2,
        results: [
          { id: 1700, name: 'UEFA Champions League 25/26', year: 2025, is_current: false },
          { id: 1800, name: 'UEFA Champions League 26/27', year: 2026, is_current: true },
        ],
      });
    }
    if (value.includes('/api/v2/teams/?')) {
      return json({ count: 1, results: [{ id: 110, name: 'Internazionale', country_code: 'IT' }] });
    }
    if (value.includes('/api/v2/events/?')) {
      const parsed = new URL(value);
      assert.equal(parsed.searchParams.get('league_id'), '7');
      assert.equal(parsed.searchParams.get('season_id'), '1800');
      return json({ count: 1, results: [{
        id: 9001,
        home_team: { id: 110, name: 'Internazionale', country_code: 'IT' },
        away_team: { id: 359, name: 'Arsenal', country_code: 'GB' },
        event_date: '2026-09-16T19:00:00+00:00',
        status: 'upcoming',
        round_name: 'League Phase',
      }] });
    }
    throw new Error(`unexpected URL ${value}`);
  };

  const matches = await fetchBsdMatches({
    competition: 'ucl',
    from: '2026-07-01',
    to: '2027-06-30',
    apiKey: 'test-key',
    fetchImpl,
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0].matchId, 'ucl:9001');
  assert.equal(requests.some(value => value.includes('/api/v2/leagues/7/seasons/')), true);
});

test('BSD provider accepts a nested current season object without needing a fallback list', async () => {
  const requests = [];
  const fetchImpl = async url => {
    const value = String(url);
    requests.push(value);

    if (value.includes('/api/v2/leagues/?')) {
      return json({ count: 1, results: [{ id: 7, name: 'Champions League' }] });
    }
    if (value.endsWith('/api/v2/leagues/7/season/')) {
      return json({ current_season: { id: 1800, name: 'UEFA Champions League 26/27', is_current: true } });
    }
    if (value.includes('/api/v2/teams/?')) {
      return json({ count: 1, results: [{ id: 110, name: 'Internazionale', country_code: 'IT' }] });
    }
    if (value.includes('/api/v2/events/?')) {
      return json({ count: 1, results: [{
        id: 9002,
        home_team: { id: 110, name: 'Internazionale', country_code: 'IT' },
        away_team: { id: 359, name: 'Arsenal', country_code: 'GB' },
        event_date: '2026-09-16T19:00:00+00:00',
        status: 'upcoming',
      }] });
    }
    throw new Error(`unexpected URL ${value}`);
  };

  const matches = await fetchBsdMatches({
    competition: 'ucl',
    from: '2026-07-01',
    to: '2027-06-30',
    apiKey: 'test-key',
    fetchImpl,
  });

  assert.equal(matches.length, 1);
  assert.equal(requests.some(value => value.includes('/api/v2/leagues/7/seasons/')), false);
});
