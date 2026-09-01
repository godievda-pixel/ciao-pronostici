import test from 'node:test';
import assert from 'node:assert/strict';

const { adaptSerieASchedule } = await import('../src/v23.2/serie-a-adapter.mjs');

test('adapts ciao-schedule-fast-v1 rounds into canonical v23.2 Serie A matches', () => {
  const payload = {
    current_round: 3,
    rounds: [
      {
        number: 2,
        matches: [
          {
            id: 101,
            kickoff_at: '2026-08-30T18:45:00Z',
            home: { id: 1, name: 'Интер', logo: 'https://img.test/inter.png' },
            away: { id: 2, name: 'Торино', logo: 'https://img.test/torino.png' },
            is_finished: true,
            home_score: 2,
            away_score: 0,
          },
        ],
      },
      {
        number: 3,
        matches: [
          {
            id: 102,
            kickoff_at: '2026-09-01T18:45:00Z',
            home: { id: 3, name: 'Милан', logo: 'https://img.test/milan.png' },
            away: { id: 4, name: 'Рома', logo: 'https://img.test/roma.png' },
            live_status: 'live',
            live_elapsed: 67,
            home_score: 1,
            away_score: 1,
          },
          {
            id: 103,
            kickoff_at: '2026-09-02T18:45:00Z',
            home: { id: 5, name: 'Ювентус', logo: 'https://img.test/juve.png' },
            away: { id: 6, name: 'Наполи', logo: 'https://img.test/napoli.png' },
            is_finished: false,
            home_score: null,
            away_score: null,
          },
        ],
      },
    ],
  };

  const result = adaptSerieASchedule(payload);

  assert.equal(result.competition, 'serie_a');
  assert.equal(result.currentRound, 3);
  assert.deepEqual(result.rounds.map(round => round.number), [2, 3]);
  assert.deepEqual(result.matches.map(match => match.matchId), [
    'serie_a:101',
    'serie_a:102',
    'serie_a:103',
  ]);

  assert.deepEqual(
    {
      matchId: result.matches[0].matchId,
      competition: result.matches[0].competition,
      round: result.matches[0].round,
      status: result.matches[0].status,
      minute: result.matches[0].minute,
      homeScore: result.matches[0].homeScore,
      awayScore: result.matches[0].awayScore,
      homeTeam: result.matches[0].homeTeam,
      awayTeam: result.matches[0].awayTeam,
      rawVersion: result.matches[0].rawVersion,
    },
    {
      matchId: 'serie_a:101',
      competition: 'serie_a',
      round: 2,
      status: 'finished',
      minute: null,
      homeScore: 2,
      awayScore: 0,
      homeTeam: {
        id: '1',
        name: 'Интер',
        countryCode: '',
        crestUrl: 'https://img.test/inter.png',
      },
      awayTeam: {
        id: '2',
        name: 'Торино',
        countryCode: '',
        crestUrl: 'https://img.test/torino.png',
      },
      rawVersion: 'ciao-schedule-fast-v1',
    },
  );

  assert.equal(result.matches[1].status, 'live');
  assert.equal(result.matches[1].minute, 67);
  assert.equal(result.matches[2].status, 'scheduled');
  assert.equal(result.matches[2].predictionDeadline, result.matches[2].kickoffAt);
});

test('ignores malformed rounds and matches without ids instead of breaking the calendar', () => {
  const result = adaptSerieASchedule({
    current_round: '4',
    rounds: [
      null,
      { number: 4, matches: [null, { kickoff_at: '2026-09-10T18:45:00Z' }] },
      { number: 5, matches: 'not-an-array' },
    ],
  });

  assert.equal(result.currentRound, 4);
  assert.deepEqual(result.rounds.map(round => round.number), [4, 5]);
  assert.deepEqual(result.matches, []);
});
