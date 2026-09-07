import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBsdEvent } from '../src/matches/normalizer.mjs';

const italian = new Set(['77']);
const base = {
  event_date: '2026-09-16T19:00:00Z',
  round_name: 'League Phase',
  round_number: 1,
  home_team: { id: 77, name: 'Internazionale', country_code: 'IT' },
  away_team: { id: 359, name: 'Arsenal', country_code: 'GB' },
  home_score: 1,
  away_score: 1,
};

function normalized(status, id, extra = {}) {
  return normalizeBsdEvent({ ...base, id, status, ...extra }, 'ucl', { italianTeamIds: italian });
}

test('BSD halftime is a first-class state with current score and no minute label', () => {
  const match = normalized('ht', 901, { current_minute: 45 });
  assert.equal(match.status, 'halftime');
  assert.equal(match.homeScore, 1);
  assert.equal(match.awayScore, 1);
  assert.equal(match.minute, null);
});

test('BSD extra time is a first-class state with current score', () => {
  const match = normalized('et', 902, { current_minute: 107, home_score: 2 });
  assert.equal(match.status, 'extra_time');
  assert.equal(match.homeScore, 2);
  assert.equal(match.awayScore, 1);
  assert.equal(match.minute, null);
});

test('BSD live penalty shootout is a first-class state with current score', () => {
  const match = normalized('pen_live', 903, { home_score: 4, away_score: 3 });
  assert.equal(match.status, 'penalties');
  assert.equal(match.homeScore, 4);
  assert.equal(match.awayScore, 3);
  assert.equal(match.minute, null);
});

test('ordinary live keeps LIVE state and minute', () => {
  const match = normalized('in_progress', 904, { current_minute: 67, home_score: 2 });
  assert.equal(match.status, 'live');
  assert.equal(match.minute, 67);
  assert.equal(match.homeScore, 2);
});
