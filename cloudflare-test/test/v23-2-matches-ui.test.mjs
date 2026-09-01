import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seasonDateRange,
  renderMatchesHub,
  renderCompetitionScreen,
} from '../src/v23.2/matches-ui.mjs';

test('season date range spans the current European football season', () => {
  assert.deepEqual(
    seasonDateRange(new Date('2026-09-01T12:00:00Z')),
    { from: '2026-07-01', to: '2027-06-30' },
  );
  assert.deepEqual(
    seasonDateRange(new Date('2027-03-10T12:00:00Z')),
    { from: '2026-07-01', to: '2027-06-30' },
  );
});

test('matches hub exposes all five approved tournament destinations', () => {
  const html = renderMatchesHub();

  for (const competition of ['serie_a', 'coppa_italia', 'ucl', 'uel', 'uecl']) {
    assert.match(html, new RegExp(`data-cw232-competition="${competition}"`));
  }

  assert.match(html, /Serie A/);
  assert.match(html, /Coppa Italia/);
  assert.match(html, /Champions League/);
  assert.match(html, /Europa League/);
  assert.match(html, /Conference League/);
});

test('Champions League screen renders its own theme, stage and canonical matches', () => {
  const html = renderCompetitionScreen('ucl', {
    competition: 'ucl',
    matches: [
      {
        matchId: 'ucl:401',
        competition: 'ucl',
        season: '2026/27',
        stage: 'League Phase',
        kickoffAt: '2026-09-18T19:00:00Z',
        status: 'scheduled',
        minute: null,
        homeTeam: { id: '110', name: 'Интер', crestUrl: 'https://img.test/inter.png' },
        awayTeam: { id: '220', name: 'Арсенал', crestUrl: 'https://img.test/arsenal.png' },
        homeScore: null,
        awayScore: null,
      },
    ],
  });

  assert.match(html, /data-cw232-theme="champions"/);
  assert.match(html, /Champions League/);
  assert.match(html, /League Phase/);
  assert.match(html, /data-cw232-match="ucl:401"/);
  assert.match(html, /Интер/);
  assert.match(html, /Арсенал/);
  assert.match(html, /https:\/\/img\.test\/inter\.png/);
  assert.match(html, /https:\/\/img\.test\/arsenal\.png/);
});
