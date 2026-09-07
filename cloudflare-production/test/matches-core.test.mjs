import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPETITION_KEYS,
  getCompetitionConfig,
  isExternalCompetition,
} from '../src/matches/competition-config.mjs';
import {
  normalizeBsdEvent,
  groupMatches,
  isItalianTeam,
} from '../src/matches/normalizer.mjs';

const italian = new Set(['77', '63', '73']);

function event(overrides = {}) {
  return {
    id: 100,
    event_date: '2026-09-16T19:00:00Z',
    status: 'upcoming',
    round_name: 'League Phase',
    round_number: 1,
    home_team: { id: 77, name: 'Internazionale', name_ru: 'Интер', country_code: 'IT' },
    away_team: { id: 359, name: 'Arsenal', country_code: 'GB' },
    ...overrides,
  };
}

test('production matches defines the five approved tournaments in display order', () => {
  assert.deepEqual(COMPETITION_KEYS, ['serie_a','coppa_italia','ucl','uel','uecl']);
  assert.equal(getCompetitionConfig('serie_a').title, 'Серия А');
  assert.equal(getCompetitionConfig('coppa_italia').title, 'Кубок Италии');
  assert.equal(getCompetitionConfig('ucl').title, 'Лига Чемпионов');
  assert.equal(getCompetitionConfig('uel').title, 'Лига Европы');
  assert.equal(getCompetitionConfig('uecl').title, 'Лига Конференций');
  assert.equal(isExternalCompetition('serie_a'), false);
  assert.equal(isExternalCompetition('ucl'), true);
  assert.throws(() => getCompetitionConfig('unknown'), /Unknown competition/);
});

test('BSD events normalize scheduled, live, finished, postponed and cancelled states', () => {
  const scheduled = normalizeBsdEvent(event({ id: 101, status: 'upcoming' }), 'ucl', { italianTeamIds: italian });
  const live = normalizeBsdEvent(event({
    id: 102,
    status: 'in_progress',
    current_minute: '67',
    home_score: 2,
    away_score: 1,
  }), 'ucl', { italianTeamIds: italian });
  const finished = normalizeBsdEvent(event({ id: 103, status: 'finished', home_score: '3', away_score: '2' }), 'ucl', { italianTeamIds: italian });
  const postponed = normalizeBsdEvent(event({ id: 104, status: 'postponed' }), 'ucl', { italianTeamIds: italian });
  const cancelled = normalizeBsdEvent(event({ id: 105, status: 'canceled' }), 'ucl', { italianTeamIds: italian });

  assert.equal(scheduled.status, 'scheduled');
  assert.equal(scheduled.homeScore, null);
  assert.equal(live.status, 'live');
  assert.equal(live.minute, 67);
  assert.equal(live.homeScore, 2);
  assert.equal(live.awayScore, 1);
  assert.equal(finished.status, 'finished');
  assert.equal(finished.homeScore, 3);
  assert.equal(finished.awayScore, 2);
  assert.equal(postponed.status, 'postponed');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(live.homeTeam.name, 'Интер');
  assert.equal(live.homeTeam.countryCode, 'ITA');
  assert.equal(live.homeTeam.crestUrl, 'https://sports.bzzoiro.com/img/team/77/?bg=transparent');
  assert.equal(live.awayTeam.crestUrl, 'https://sports.bzzoiro.com/img/team/359/?bg=transparent');
  assert.equal(isItalianTeam(live.homeTeam), true);
  assert.equal(isItalianTeam(live.awayTeam), false);
});

test('Coppa Italia rejects rounds before 1/16 and groups knockout stages chronologically', () => {
  const stages = [
    ['Round of 64', 201],
    ['Round of 32', 202],
    ['Round of 16', 203],
    ['Quarter-finals', 204],
    ['Semi-finals', 205],
    ['Final', 206],
  ];
  const matches = stages
    .map(([round_name, id], index) => normalizeBsdEvent(event({
      id,
      round_name,
      round_number: null,
      event_date: `2026-${String(9 + index).padStart(2, '0')}-16T19:00:00Z`,
    }), 'coppa_italia', { italianTeamIds: italian }))
    .filter(Boolean);

  assert.equal(matches.length, 5);
  const groups = groupMatches(matches, 'coppa_italia');
  assert.deepEqual(groups.map(group => group.key), ['r32','r16','qf','sf','final']);
  assert.deepEqual(groups.map(group => group.label), ['1/16 финала','1/8 финала','1/4 финала','1/2 финала','Финал']);
});

test('European competitions retain only Italian-club matches and order league rounds before knockouts', () => {
  const rows = [
    event({
      id: 301,
      round_name: 'League Phase',
      round_number: 3,
      home_team: { id: 359, name: 'Arsenal', country_code: 'GB' },
      away_team: { id: 500, name: 'Barcelona', country_code: 'ES' },
    }),
    event({ id: 302, round_name: 'League Stage', round_number: 3 }),
    event({
      id: 303,
      round_name: 'League Phase',
      round_number: 4,
      home_team: { id: 359, name: 'Arsenal', country_code: 'GB' },
      away_team: { id: 63, name: 'AC Milan', ru_name: 'Милан', country_code: '' },
    }),
    event({ id: 304, round_name: 'Knockout Phase Play-offs', round_number: null, event_date: '2027-02-18T20:00:00Z' }),
    event({ id: 305, round_name: 'Round of 16', round_number: null, event_date: '2027-03-10T20:00:00Z' }),
  ];

  const matches = rows
    .map(row => normalizeBsdEvent(row, 'ucl', { italianTeamIds: italian }))
    .filter(Boolean);

  assert.deepEqual(matches.map(match => match.sourceId), ['302','303','304','305']);
  assert.equal(matches[0].stageLabel, 'Общий этап · 3 тур');
  assert.equal(matches[1].awayTeam.name, 'Милан');
  assert.equal(matches[1].awayTeam.isItalian, true);

  const groups = groupMatches(matches, 'ucl');
  assert.deepEqual(groups.map(group => group.key), ['league-3','league-4','playoff','r16']);
  assert.deepEqual(groups.map(group => group.label), ['Общий этап · 3 тур','Общий этап · 4 тур','Стыковые матчи','1/8 финала']);
});

test('malformed events are isolated instead of throwing through the tournament', () => {
  assert.equal(normalizeBsdEvent(null, 'ucl', { italianTeamIds: italian }), null);
  assert.equal(normalizeBsdEvent(event({ id: null }), 'ucl', { italianTeamIds: italian }), null);
});
