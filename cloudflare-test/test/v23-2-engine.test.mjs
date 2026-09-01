import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMatch } from '../src/v23.2/match-normalizer.mjs';
import {
  sortChronologically,
  matchesForCompetition,
  groupForCompetition,
  availablePredictions,
  nextMatchForTeam,
} from '../src/v23.2/tournament-engine.mjs';

const m = (id, competition, kickoff, extra = {}) => normalizeMatch({
  id,
  season: '2026/27',
  kickoff_at: kickoff,
  status: 'NS',
  home: {
    id: extra.homeId || 10,
    name: extra.homeName || 'Inter',
    country: 'Italy',
  },
  away: {
    id: extra.awayId || 20,
    name: extra.awayName || 'Opponent',
    country: extra.awayCountry || 'England',
  },
  round: extra.round ?? 1,
  stage: extra.stage || '',
  prediction_deadline: extra.deadline || kickoff,
}, competition);

const matches = [
  m(3, 'ucl', '2026-09-20T19:00:00Z', { stage: 'League phase' }),
  m(1, 'serie_a', '2026-09-05T18:45:00Z', { round: 3 }),
  m(2, 'coppa_italia', '2026-09-10T19:00:00Z', { stage: '1/16' }),
];

test('selectors preserve one chronological source of truth', () => {
  assert.deepEqual(
    sortChronologically(matches).map(match => match.matchId),
    ['serie_a:1', 'coppa_italia:2', 'ucl:3'],
  );
  assert.deepEqual(
    matchesForCompetition(matches, 'ucl').map(match => match.matchId),
    ['ucl:3'],
  );
});

test('league groups by round while cups group by stage', () => {
  assert.equal(groupForCompetition(matches, 'serie_a')[0].key, '3');
  assert.equal(groupForCompetition(matches, 'coppa_italia')[0].key, '1/16');
});

test('prediction availability uses predictionDeadline rather than match status', () => {
  const now = Date.parse('2026-09-05T18:00:00Z');
  assert.deepEqual(
    availablePredictions(matches, now).map(match => match.matchId),
    ['serie_a:1', 'coppa_italia:2', 'ucl:3'],
  );
});

test('favorite team next match scans every competition', () => {
  assert.equal(
    nextMatchForTeam(matches, '10', Date.parse('2026-09-01T00:00:00Z')).matchId,
    'serie_a:1',
  );
});
