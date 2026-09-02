import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMatch,
  shouldIncludeMatch,
} from '../src/v23.2/match-normalizer.mjs';

const raw = {
  id: 101,
  season: '2026/27',
  stage: 'League phase',
  round: 1,
  kickoff_at: '2026-09-15T19:00:00Z',
  status: 'NS',
  home: { id: 10, name: 'Inter', country: 'Italy', logo: 'inter.png' },
  away: { id: 20, name: 'Arsenal', country: 'England', logo: 'arsenal.png' },
  home_score: null,
  away_score: null,
  prediction_deadline: '2026-09-15T18:59:59Z',
  version: 'feed-7',
};

test('normalizes a match to the canonical v23.2 shape', () => {
  const match = normalizeMatch(raw, 'ucl');
  assert.equal(match.matchId, 'ucl:101');
  assert.equal(match.competition, 'ucl');
  assert.equal(match.status, 'scheduled');
  assert.equal(match.homeTeam.countryCode, 'ITA');
  assert.equal(match.awayTeam.countryCode, 'ENG');
  assert.equal(match.homeScore, null);
  assert.equal(match.awayScore, null);
  assert.equal(match.predictionDeadline, '2026-09-15T18:59:59Z');
  assert.equal(match.homeSourceMatchId, '');
  assert.equal(match.awaySourceMatchId, '');
  assert.deepEqual(Object.keys(match), [
    'matchId',
    'competition',
    'season',
    'stage',
    'round',
    'kickoffAt',
    'status',
    'minute',
    'homeTeam',
    'awayTeam',
    'homeScore',
    'awayScore',
    'aggregateScore',
    'leg',
    'venue',
    'predictionDeadline',
    'homeSourceMatchId',
    'awaySourceMatchId',
    'rawVersion',
  ]);
});

test('preserves explicit source-match ids for knockout progression', () => {
  const match = normalizeMatch({
    ...raw,
    id: 103,
    home_source_match_id: 77,
    awaySourceMatchId: 'ucl:88',
  }, 'ucl');
  assert.equal(match.homeSourceMatchId, 'ucl:77');
  assert.equal(match.awaySourceMatchId, 'ucl:88');
});

test('includes all domestic matches but only Italian-club UEFA matches', () => {
  assert.equal(shouldIncludeMatch(normalizeMatch(raw, 'serie_a')), true);
  assert.equal(shouldIncludeMatch(normalizeMatch(raw, 'coppa_italia')), true);
  assert.equal(shouldIncludeMatch(normalizeMatch(raw, 'ucl')), true);

  const foreign = normalizeMatch({
    ...raw,
    id: 102,
    home: { id: 30, name: 'Real Madrid', country: 'Spain' },
    away: { id: 40, name: 'Bayern', country: 'Germany' },
  }, 'ucl');
  assert.equal(shouldIncludeMatch(foreign), false);

  const noCountryButItalian = normalizeMatch({
    ...raw,
    id: 104,
    home: { id: 77, name: 'Internazionale' },
    away: { id: 40, name: 'Bayern' },
  }, 'ucl');
  assert.equal(shouldIncludeMatch(noCountryButItalian), true);
});

test('maps provider statuses into the exact finite status set', () => {
  assert.equal(normalizeMatch({ ...raw, status: 'LIVE', minute: 67 }, 'ucl').status, 'live');
  assert.equal(normalizeMatch({ ...raw, status: 'FT' }, 'ucl').status, 'finished');
  assert.equal(normalizeMatch({ ...raw, status: 'PST' }, 'ucl').status, 'postponed');
  assert.equal(normalizeMatch({ ...raw, status: 'CANC' }, 'ucl').status, 'cancelled');
});