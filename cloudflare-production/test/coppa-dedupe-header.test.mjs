import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeCoppaSingleLegMatches } from '../src/matches/bsd-provider.mjs';
import { multitournamentCardThemeSource } from '../scripts/multitournament-card-theme.mjs';

function match(sourceId, kickoffAt, homeId, awayId, stageKey = 'r32') {
  return {
    sourceId: String(sourceId),
    matchId: `coppa_italia:${sourceId}`,
    competition: 'coppa_italia',
    stageKey,
    kickoffAt,
    homeTeam: { id: String(homeId), name: String(homeId) },
    awayTeam: { id: String(awayId), name: String(awayId) },
  };
}

test('Coppa single-leg rounds keep only the newest BSD event for the same team pair', () => {
  const rows = [
    match(588045, '2026-09-02T13:00:00Z', 72, 68),
    match(600983, '2026-09-15T19:00:00Z', 68, 72),
    match(600100, '2026-09-03T18:00:00Z', 67, 76),
  ];
  const result = dedupeCoppaSingleLegMatches(rows);
  assert.deepEqual(result.map(row => row.sourceId).sort(), ['600100', '600983']);
});

test('Coppa semifinals are not deduplicated because the tie can have two legs', () => {
  const rows = [
    match(700001, '2027-04-01T19:00:00Z', 68, 62, 'sf'),
    match(700002, '2027-04-22T19:00:00Z', 62, 68, 'sf'),
  ];
  assert.equal(dedupeCoppaSingleLegMatches(rows).length, 2);
});

test('global app header hides the Serie A season subtitle on every tab', () => {
  const source = multitournamentCardThemeSource();
  assert.match(source, /#ciao-miniapp-root \.brand small\{display:none!important\}/);
});
