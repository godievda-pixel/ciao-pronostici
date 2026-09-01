import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESPN_COMPETITION_SLUGS,
  extractEspnTeamIds,
  adaptEspnScoreboard,
} from '../src/v23.2/espn-adapter.mjs';

const team = (id, name) => ({
  id: String(id),
  displayName: name,
  name,
  logo: `https://img.example/${id}.png`,
});

const competitor = (id, name, homeAway, score = '0') => ({
  id: String(id),
  homeAway,
  score,
  team: team(id, name),
});

const event = ({
  id,
  date,
  home,
  away,
  state = 'pre',
  completed = false,
  detail = 'Scheduled',
  statusName = 'STATUS_SCHEDULED',
  stage = 'League Phase',
  seasonSlug = 'league-phase',
}) => ({
  id: String(id),
  date,
  season: { year: 2026, slug: seasonSlug },
  status: {
    type: { state, completed, detail, name: statusName },
  },
  competitions: [{
    id: String(id),
    date,
    altGameNote: `UEFA Champions League, ${stage}`,
    status: {
      displayClock: state === 'in' ? "67'" : '0',
      type: { state, completed, detail, name: statusName },
    },
    venue: { fullName: 'San Siro' },
    competitors: [home, away],
  }],
});

const uclPayload = {
  leagues: [{ name: 'UEFA Champions League', slug: 'uefa.champions' }],
  events: [
    event({
      id: 1001,
      date: '2026-09-16T19:00:00Z',
      home: competitor(110, 'Inter', 'home'),
      away: competitor(359, 'Arsenal', 'away'),
    }),
    event({
      id: 1002,
      date: '2026-09-17T19:00:00Z',
      home: competitor(86, 'Real Madrid', 'home'),
      away: competitor(132, 'Bayern Munich', 'away'),
    }),
    event({
      id: 1003,
      date: '2026-09-24T19:00:00Z',
      home: competitor(359, 'Arsenal', 'home', '1'),
      away: competitor(110, 'Inter', 'away', '2'),
      state: 'in',
      detail: "67'",
      statusName: 'STATUS_IN_PROGRESS',
    }),
  ],
};

test('maps v23.2 competitions to verified ESPN soccer slugs', () => {
  assert.deepEqual(ESPN_COMPETITION_SLUGS, {
    coppa_italia: 'ita.coppa_italia',
    ucl: 'uefa.champions',
    uel: 'uefa.europa',
    uecl: 'uefa.europa.conf',
  });
});

test('extracts ESPN team ids from league teams payload', () => {
  const payload = {
    sports: [{ leagues: [{ teams: [
      { team: team(110, 'Inter') },
      { team: team(103, 'Milan') },
      { team: team(110, 'Inter duplicate') },
    ] }] }],
  };
  assert.deepEqual(extractEspnTeamIds(payload), ['103', '110']);
});

test('UEFA adapter keeps only matches involving dynamically identified Italian clubs', () => {
  const matches = adaptEspnScoreboard(uclPayload, 'ucl', {
    italianTeamIds: new Set(['110', '103']),
  });

  assert.deepEqual(matches.map(match => match.matchId), ['ucl:1001', 'ucl:1003']);
  assert.equal(matches[0].homeTeam.name, 'Inter');
  assert.equal(matches[0].homeTeam.countryCode, 'ITA');
  assert.equal(matches[0].awayTeam.countryCode, '');
  assert.equal(matches[0].stage, 'League Phase');
  assert.equal(matches[0].season, '2026/27');
  assert.equal(matches[0].venue, 'San Siro');
  assert.equal(matches[0].status, 'scheduled');
  assert.equal(matches[0].homeScore, null);
  assert.equal(matches[1].status, 'live');
  assert.equal(matches[1].minute, 67);
  assert.equal(matches[1].homeScore, 1);
  assert.equal(matches[1].awayScore, 2);
});

test('domestic Coppa Italia adapter includes every match without Italian filtering', () => {
  const payload = {
    leagues: [{ name: 'Coppa Italia', slug: 'ita.coppa_italia' }],
    events: [event({
      id: 2001,
      date: '2026-12-02T20:00:00Z',
      home: competitor(110, 'Inter', 'home', '2'),
      away: competitor(103, 'Milan', 'away', '1'),
      state: 'post',
      completed: true,
      detail: 'FT',
      statusName: 'STATUS_FULL_TIME',
      stage: 'Round of 16',
      seasonSlug: 'round-of-16',
    })],
  };
  payload.events[0].competitions[0].altGameNote = 'Coppa Italia, Round of 16';

  const matches = adaptEspnScoreboard(payload, 'coppa_italia');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].matchId, 'coppa_italia:2001');
  assert.equal(matches[0].status, 'finished');
  assert.equal(matches[0].homeScore, 2);
  assert.equal(matches[0].awayScore, 1);
  assert.equal(matches[0].stage, 'Round of 16');
});
