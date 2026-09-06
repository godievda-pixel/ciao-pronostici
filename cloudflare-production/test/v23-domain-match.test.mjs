import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalMatchId,
  isMatchEligible,
  normalizeProviderMatch,
} from '../../supabase/functions/ciao-v23-api/domain/match.mjs';

function match({
  competition = 'serie_a',
  homeCountry = 'IT',
  awayCountry = 'IT',
  stage = 'League phase',
  qualification = false,
} = {}) {
  return {
    competition,
    stage,
    isQualification: qualification,
    home: { id: '1', countryCode: homeCountry },
    away: { id: '2', countryCode: awayCountry },
  };
}

test('canonical match ids are prefixed exactly once', () => {
  assert.equal(canonicalMatchId('ucl', '12345'), 'ucl:12345');
  assert.equal(canonicalMatchId('ucl', 'ucl:12345'), 'ucl:12345');
  assert.throws(() => canonicalMatchId('ucl', 'uel:12345'), /match_competition_mismatch:uel/);
  assert.throws(() => canonicalMatchId('ucl', ''), /match_id_required/);
});

test('European match eligibility requires an Italian club and excludes qualification', () => {
  assert.equal(isMatchEligible(match({competition:'ucl', homeCountry:'IT', awayCountry:'GB'})), true);
  assert.equal(isMatchEligible(match({competition:'ucl', homeCountry:'ES', awayCountry:'GB'})), false);
  assert.equal(isMatchEligible(match({competition:'uel', homeCountry:'DE', awayCountry:'IT'})), true);
  assert.equal(isMatchEligible(match({competition:'uecl', homeCountry:'IT', awayCountry:'FR', stage:'Qualifying round', qualification:true})), false);
});

test('Coppa Italia starts at Round of 16 while Serie A remains eligible', () => {
  assert.equal(isMatchEligible(match({competition:'coppa_italia', stage:'Round of 32'})), false);
  assert.equal(isMatchEligible(match({competition:'coppa_italia', stage:'Round of 16'})), true);
  assert.equal(isMatchEligible(match({competition:'serie_a'})), true);
});

test('provider match normalization derives Italian relevance from stable team ids/country data', () => {
  const normalized = normalizeProviderMatch({
    id: 7788,
    season: { name: '2026/27' },
    round_name: 'League phase',
    round_number: 1,
    event_date: '2026-09-12T18:45:00Z',
    status: 'scheduled',
    home_team: { id: 10, name: 'Inter', country_code: '' },
    away_team: { id: 20, name: 'Liverpool', country_code: 'GB' },
  }, {
    competition: 'ucl',
    italianTeamIds: new Set(['10']),
  });

  assert.equal(normalized.id, 'ucl:7788');
  assert.equal(normalized.providerMatchId, '7788');
  assert.equal(normalized.home.countryCode, 'IT');
  assert.equal(normalized.away.countryCode, 'GB');
  assert.equal(normalized.isItalianRelevant, true);
  assert.equal(normalized.isQualification, false);
  assert.equal(normalized.kickoffAt, '2026-09-12T18:45:00Z');
});
