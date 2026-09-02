import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalPredictionKey,
  flattenCompetitionFeeds,
  groupPredictionMatches,
  loadAllCompetitionMatches,
  predictionDeadlineForKickoff,
  selectHomeMatches,
} from '../src/v23.3/competition-data.mjs';

function match(id, competition, kickoffAt, extra = {}) {
  return {
    matchId: `${competition}:${id}`,
    competition,
    kickoffAt,
    status: extra.status || 'scheduled',
    round: extra.round ?? null,
    stage: extra.stage ?? '',
    homeTeam: { id: `${id}-h`, name: `Home ${id}` },
    awayTeam: { id: `${id}-a`, name: `Away ${id}` },
  };
}

test('v23.3 prediction deadline is exactly 15 minutes before kickoff and identity is competition-aware', () => {
  assert.equal(
    predictionDeadlineForKickoff('2026-09-16T19:00:00Z'),
    '2026-09-16T18:45:00.000Z',
  );
  assert.throws(() => predictionDeadlineForKickoff('bad-date'), /kickoff/i);

  assert.equal(
    canonicalPredictionKey({ competition: 'ucl', matchId: 'ucl:601024' }),
    'ucl|ucl:601024',
  );
  assert.notEqual(
    canonicalPredictionKey({ competition: 'ucl', matchId: 'ucl:601024' }),
    canonicalPredictionKey({ competition: 'uel', matchId: 'uel:601024' }),
  );
  assert.throws(
    () => canonicalPredictionKey({ competition: 'ucl', matchId: 'uel:601024' }),
    /mismatch/i,
  );
});

test('v23.3 competition loader isolates one failed tournament and keeps the other four', async () => {
  const calls = [];
  const loadMatches = async (competition, options) => {
    calls.push({ competition, options });
    if (competition === 'uel') throw new Error('UEL unavailable');
    return {
      competition,
      matches: [match(`1-${competition}`, competition, '2026-09-16T19:00:00Z')],
    };
  };

  const result = await loadAllCompetitionMatches({
    loadMatches,
    from: '2026-09-01',
    to: '2026-09-30',
  });

  assert.equal(calls.length, 5);
  assert.deepEqual(Object.keys(result.data).sort(), ['coppa_italia', 'serie_a', 'ucl', 'uecl']);
  assert.equal(result.errors.uel.message, 'UEL unavailable');
  assert.equal(flattenCompetitionFeeds(result.data).length, 4);
});

test('Home selector interleaves all competitions by kickoff on the local day', () => {
  const rows = [
    match('sa', 'serie_a', '2026-09-16T18:45:00Z'),
    match('ci', 'coppa_italia', '2026-09-16T17:00:00Z'),
    match('cl', 'ucl', '2026-09-16T19:00:00Z'),
    match('el', 'uel', '2026-09-16T16:00:00Z'),
    match('ec', 'uecl', '2026-09-16T20:00:00Z'),
    match('past', 'serie_a', '2026-09-15T18:00:00Z', { status: 'finished' }),
  ];

  const selected = selectHomeMatches(rows, {
    now: new Date('2026-09-16T12:00:00Z'),
    timeZone: 'UTC',
  });

  assert.deepEqual(selected.map(row => row.matchId), [
    'uel:el',
    'coppa_italia:ci',
    'serie_a:sa',
    'ucl:cl',
    'uecl:ec',
  ]);
});

test('Home selector falls back to the nearest upcoming local match-day when today is empty', () => {
  const rows = [
    match('past', 'serie_a', '2026-09-15T18:00:00Z', { status: 'finished' }),
    match('next-a', 'ucl', '2026-09-18T16:00:00Z'),
    match('next-b', 'coppa_italia', '2026-09-18T19:00:00Z'),
    match('later', 'uel', '2026-09-19T18:00:00Z'),
  ];

  const selected = selectHomeMatches(rows, {
    now: new Date('2026-09-16T12:00:00Z'),
    timeZone: 'UTC',
  });

  assert.deepEqual(selected.map(row => row.matchId), [
    'ucl:next-a',
    'coppa_italia:next-b',
  ]);
});

test('prediction grouping keeps Serie A rounds and uses stage then local date for cups', () => {
  const serieA = [
    match('sa1', 'serie_a', '2026-09-16T18:45:00Z', { round: 3 }),
    match('sa2', 'serie_a', '2026-09-17T18:45:00Z', { round: 4 }),
  ];
  assert.deepEqual(
    groupPredictionMatches(serieA, 'serie_a', { timeZone: 'UTC' }).map(group => group.key),
    ['round:3', 'round:4'],
  );

  const ucl = [
    match('ucl1', 'ucl', '2026-09-16T19:00:00Z', { stage: 'League Phase' }),
    match('ucl2', 'ucl', '2026-09-17T19:00:00Z', { stage: '' }),
  ];
  const groups = groupPredictionMatches(ucl, 'ucl', { timeZone: 'UTC' });
  assert.equal(groups[0].key, 'stage:League Phase');
  assert.equal(groups[0].label, 'League Phase');
  assert.equal(groups[1].key, 'date:2026-09-17');
  assert.equal(groups[1].label, '17 сентября');
});
