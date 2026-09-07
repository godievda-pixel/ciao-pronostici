import test from 'node:test';
import assert from 'node:assert/strict';
import { multitournamentRuntimeSource } from '../scripts/multitournament-runtime.mjs';
import { normalizeBsdEvent } from '../src/matches/normalizer.mjs';

const runtime = () => multitournamentRuntimeSource();

function event(overrides = {}) {
  return {
    id: 9001,
    event_date: '2026-09-08T19:00:00Z',
    status: 'upcoming',
    round_name: '',
    stage: 'league-phase',
    round_number: 1,
    home_team: { id: 63, name: 'AC Milan', country_code: 'IT' },
    away_team: { id: 37, name: 'Benfica', country_code: 'PT' },
    ...overrides,
  };
}

test('external kickoff uses the device timezone instead of forcing Rome', () => {
  const s = runtime();
  assert.doesNotMatch(s, /timeZone\s*:\s*['"]Europe\/Rome['"]/);
  assert.match(s, /Intl\.DateTimeFormat\('ru-RU',\{hour:'2-digit',minute:'2-digit'\}\)/);
});

test('stage switcher uses compact single-line labels while the section keeps the full stage title', () => {
  const s = runtime();
  assert.match(s, /function __cwMtStageShortLabel\(/);
  assert.match(s, /return league\[1\]\+' тур'/);
  assert.match(s, /if\(key==='playoff'\)return 'Стыки'/);
  assert.match(s, /white-space:nowrap/);
  assert.match(s, /data-cwmt-stage=/);
  assert.match(s, /cwmt-stage-title/);
});

test('tournament back control is aligned in the same row as the cover title', () => {
  const s = runtime();
  assert.match(s, /cwmt-cover-row/);
  assert.match(s, /class=\"cwmt-back\"[\s\S]*<h2>/);
  assert.doesNotMatch(s, /\.cwmt-back\{position:absolute/);
});

test('BSD club names are localized to Russian with provider Russian names still taking precedence', () => {
  const italianIds = new Set(['63', '73']);
  const milanBenfica = normalizeBsdEvent(event(), 'ucl', { italianTeamIds: italianIds });
  assert.equal(milanBenfica.homeTeam.name, 'Милан');
  assert.equal(milanBenfica.awayTeam.name, 'Бенфика');

  const juventusNec = normalizeBsdEvent(event({
    id: 9002,
    home_team: { id: 73, name: 'Juventus', country_code: 'IT' },
    away_team: { id: 171, name: 'NEC Nijmegen', country_code: 'NL' },
  }), 'uel', { italianTeamIds: italianIds });
  assert.equal(juventusNec.homeTeam.name, 'Ювентус');
  assert.equal(juventusNec.awayTeam.name, 'НЕК Неймеген');

  const explicit = normalizeBsdEvent(event({
    id: 9003,
    home_team: { id: 63, name: 'AC Milan', name_ru: 'Милан RU', country_code: 'IT' },
  }), 'ucl', { italianTeamIds: italianIds });
  assert.equal(explicit.homeTeam.name, 'Милан RU');
});
