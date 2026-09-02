import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchBsdMatchSnapshot,
  fetchBsdMatches,
  fetchBsdStandings,
} from '../src/v23.2/bsd-provider.mjs';

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function baseLeagueFetch(requests, eventFactory) {
  return async url => {
    const value = String(url);
    requests.push(value);

    if (value.includes('/api/v2/leagues/?')) {
      return json({ count: 1, results: [{ id: 7, name: 'Champions League' }] });
    }
    if (value.endsWith('/api/v2/leagues/7/season/')) {
      return json({ id: 1800, name: 'Champions League 2026/27', year: 2026, is_current: true });
    }
    if (value.includes('/api/v2/leagues/7/standings/')) {
      return json({
        standings: [
          { position: 1, team_id: 57, team_name: 'Real Madrid', played: 8, won: 6, drawn: 1, lost: 1, goals_for: 18, goals_against: 7, goal_difference: 11, pts: 19 },
          { position: 2, team_id: 77, team_name: 'Inter', played: 8, won: 5, drawn: 2, lost: 1, goals_for: 14, goals_against: 8, goal_difference: 6, pts: 17 },
        ],
      });
    }
    if (value.includes('/api/v2/events/601024/')) {
      return json(eventFactory?.() || {
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
    if (value.includes('/api/v2/events/?')) {
      return json({ count: 2, results: [
        {
          id: 601024,
          league: { id: 7, name: 'Champions League' },
          season: { id: 1800, name: 'Champions League 2026/27' },
          home_team: { id: 57, name: 'Real Madrid', country_code: 'ES' },
          away_team: { id: 77, name: 'Inter', country_code: 'IT' },
          event_date: '2026-09-08T19:00:00+00:00',
          status: 'upcoming',
        },
        {
          id: 601025,
          league: { id: 7, name: 'Champions League' },
          season: { id: 1800, name: 'Champions League 2026/27' },
          home_team: { id: 80, name: 'Bayern Munich', country_code: 'DE' },
          away_team: { id: 57, name: 'Real Madrid', country_code: 'ES' },
          event_date: '2026-09-09T19:00:00+00:00',
          status: 'upcoming',
        },
      ] });
    }
    throw new Error(`unexpected URL ${value}`);
  };
}

test('BSD full UEFA feed keeps foreign-vs-foreign matches and no longer requests Italian-team filter', async () => {
  const requests = [];
  const matches = await fetchBsdMatches({
    competition: 'ucl',
    from: '2026-09-01',
    to: '2026-09-30',
    apiKey: 'test-key',
    fetchImpl: baseLeagueFetch(requests),
  });

  assert.deepEqual(matches.map(match => match.matchId), ['ucl:601024', 'ucl:601025']);
  assert.equal(requests.some(value => value.includes('/teams/')), false);
});

test('BSD standings returns full canonical rows including foreign clubs', async () => {
  const requests = [];
  const rows = await fetchBsdStandings({
    competition: 'ucl',
    apiKey: 'test-key',
    fetchImpl: baseLeagueFetch(requests),
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].competition, 'ucl');
  assert.equal(rows[0].team.name, 'Реал Мадрид');
  assert.equal(rows[0].played, 8);
  assert.equal(rows[0].wins, 6);
  assert.equal(rows[0].draws, 1);
  assert.equal(rows[0].losses, 1);
  assert.equal(rows[0].goalsFor, 18);
  assert.equal(rows[0].goalsAgainst, 7);
  assert.equal(rows[0].goalDifference, 11);
  assert.equal(rows[0].points, 19);
  assert.equal(requests.some(value => value.includes('/leagues/7/standings/') && value.includes('season_id=1800')), true);
});

test('BSD match snapshot resolves canonical id and preserves live score and minute', async () => {
  const requests = [];
  const match = await fetchBsdMatchSnapshot({
    competition: 'ucl',
    matchId: 'ucl:601024',
    apiKey: 'test-key',
    fetchImpl: baseLeagueFetch(requests),
  });

  assert.equal(match.matchId, 'ucl:601024');
  assert.equal(match.status, 'live');
  assert.equal(match.minute, 67);
  assert.equal(match.homeScore, 2);
  assert.equal(match.awayScore, 1);
  assert.equal(requests.some(value => value.includes('/events/601024/')), true);
});

test('BSD match snapshot rejects competition/id mismatch before event lookup', async () => {
  let calls = 0;
  await assert.rejects(
    fetchBsdMatchSnapshot({
      competition: 'ucl',
      matchId: 'uel:601024',
      apiKey: 'test-key',
      fetchImpl: async () => {
        calls += 1;
        return json({});
      },
    }),
    /competition/i,
  );
  assert.equal(calls, 0);
});
