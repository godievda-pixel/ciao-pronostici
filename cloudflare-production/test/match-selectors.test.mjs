import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSerieAClubIndex,
  involvesSerieAClub,
  selectNearestClubMatch,
  selectCalcioToday,
  selectCompetitionFixtures,
} from '../src/modular/data/selectors.mjs';
import { normalizeMatch } from '../src/modular/data/match-normalizer.mjs';

const standings = [
  { team_id: 109, team_name: 'Juventus', aliases: ['Juve'] },
  { team_id: 110, team_name: 'Inter' },
  { team_id: 111, team_name: 'Milan' },
];
const clubs = createSerieAClubIndex(standings);

function match(id, competition, kickoffAt, home, away, extra = {}) {
  return normalizeMatch({ id, kickoff_at: kickoffAt, home, away, ...extra }, competition);
}

test('nearest favorite-club match is selected across all competitions', () => {
  const now = new Date('2026-09-06T10:00:00Z');
  const matches = [
    match(1, 'serie_a', '2026-09-10T18:00:00Z', {id:109,name:'Juventus'}, {id:200,name:'Roma'}),
    match(2, 'ucl', '2026-09-08T19:00:00Z', {id:300,name:'Arsenal'}, {id:109,name:'Juventus'}),
    match(3, 'coppa_italia', '2026-09-07T18:00:00Z', {id:111,name:'Milan'}, {id:400,name:'Bari'}, {stage:'Round of 16'}),
  ];
  const selected = selectNearestClubMatch(matches, { id:109, name:'Juventus' }, now);
  assert.equal(selected.id, 'ucl:2');
});

test('Calcio today includes any supported match today with a Serie A club', () => {
  const now = new Date('2026-09-06T12:00:00Z');
  const matches = [
    match(1, 'serie_a', '2026-09-06T14:00:00Z', {id:109,name:'Juventus'}, {id:210,name:'Roma'}),
    match(2, 'ucl', '2026-09-06T19:00:00Z', {id:300,name:'Arsenal'}, {id:110,name:'Inter'}),
    match(3, 'ucl', '2026-09-06T20:00:00Z', {id:301,name:'Real Madrid'}, {id:302,name:'Bayern'}),
    match(4, 'uel', '2026-09-07T19:00:00Z', {id:111,name:'Milan'}, {id:303,name:'Porto'}),
  ];
  assert.deepEqual(selectCalcioToday(matches, clubs, now).map(x => x.id), ['serie_a:1','ucl:2']);
  assert.equal(involvesSerieAClub(matches[2], clubs), false);
});

test('European competition fixtures exclude foreign-only and qualification matches', () => {
  const matches = [
    match(1, 'ucl', '2026-09-10T19:00:00Z', {id:109,name:'Juventus'}, {id:300,name:'Arsenal'}, {stage:'League phase'}),
    match(2, 'ucl', '2026-09-11T19:00:00Z', {id:301,name:'Real Madrid'}, {id:302,name:'Bayern'}, {stage:'League phase'}),
    match(3, 'ucl', '2026-08-20T19:00:00Z', {id:110,name:'Inter'}, {id:303,name:'Celtic'}, {stage:'Third qualifying round'}),
  ];
  assert.deepEqual(selectCompetitionFixtures(matches, 'ucl', clubs).map(x => x.id), ['ucl:1']);
});

test('Coppa Italia fixtures begin at Round of 16 and retain later rounds', () => {
  const matches = [
    match(1, 'coppa_italia', '2026-10-01T18:00:00Z', {id:109,name:'Juventus'}, {id:500,name:'Pisa'}, {stage:'Round of 32'}),
    match(2, 'coppa_italia', '2026-12-01T18:00:00Z', {id:109,name:'Juventus'}, {id:501,name:'Parma'}, {stage:'Round of 16'}),
    match(3, 'coppa_italia', '2027-01-15T18:00:00Z', {id:110,name:'Inter'}, {id:111,name:'Milan'}, {stage:'Quarter-finals'}),
    match(4, 'coppa_italia', '2027-03-10T18:00:00Z', {id:109,name:'Juventus'}, {id:110,name:'Inter'}, {stage:'Semi-finals'}),
    match(5, 'coppa_italia', '2027-05-10T18:00:00Z', {id:109,name:'Juventus'}, {id:111,name:'Milan'}, {stage:'Final'}),
  ];
  assert.deepEqual(selectCompetitionFixtures(matches, 'coppa_italia', clubs).map(x => x.id), [
    'coppa_italia:2','coppa_italia:3','coppa_italia:4','coppa_italia:5'
  ]);
});
