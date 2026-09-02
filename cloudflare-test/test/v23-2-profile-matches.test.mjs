import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesForClub,
  mergeClubMatches,
  profileCompetitionMatches,
} from '../src/v23.2/profile-matches.mjs';
import { renderProfileTournamentSection } from '../src/v23.2/profile-integration.mjs';

function team(id, name, rawName = name) {
  return { id: String(id), name, rawName, crestUrl: '' };
}

function match(id, competition, kickoffAt, home, away) {
  return {
    matchId: `${competition}:${id}`,
    competition,
    stage: 'League Phase',
    kickoffAt,
    status: 'scheduled',
    homeTeam: home,
    awayTeam: away,
    homeScore: null,
    awayScore: null,
  };
}

const inter = team(110, 'Интер', 'Internazionale');
const arsenal = team(359, 'Арсенал', 'Arsenal');
const milan = team(111, 'Милан', 'AC Milan');

const uclInter = match('601024', 'ucl', '2026-09-08T19:00:00Z', arsenal, inter);
const coppaInter = match('701024', 'coppa_italia', '2026-12-02T20:00:00Z', inter, milan);

test('club profile matches tournament fixtures by localized or raw team alias', () => {
  const data = {
    ucl: { matches: [uclInter] },
    coppa_italia: { matches: [coppaInter] },
    uel: { matches: [] },
  };

  assert.deepEqual(matchesForClub(data, { name: 'Интер' }).map(item => item.matchId), [
    'ucl:601024',
    'coppa_italia:701024',
  ]);
  assert.deepEqual(matchesForClub(data, { name: 'Internazionale' }).map(item => item.matchId), [
    'ucl:601024',
    'coppa_italia:701024',
  ]);
});

test('profile merger keeps chronological unique fixtures', () => {
  const serieA = match('100', 'serie_a', '2026-09-05T18:00:00Z', inter, milan);
  const duplicate = { ...uclInter };
  const merged = mergeClubMatches([serieA], [uclInter, duplicate, coppaInter]);

  assert.deepEqual(merged.map(item => item.matchId), [
    'serie_a:100',
    'ucl:601024',
    'coppa_italia:701024',
  ]);
});

test('profile competition list excludes Serie A and preserves tournament labels', () => {
  const rows = profileCompetitionMatches({
    serie_a: { matches: [match('1', 'serie_a', '2026-09-01T18:00:00Z', inter, milan)] },
    ucl: { matches: [uclInter] },
    coppa_italia: { matches: [coppaInter] },
  }, { name: 'Интер' });

  assert.deepEqual(rows.map(item => item.competition), ['ucl', 'coppa_italia']);
});

test('profile tournament renderer uses Russian competition labels and canonical club names', () => {
  const html = renderProfileTournamentSection([uclInter, coppaInter]);
  assert.match(html, /Кубки и еврокубки/);
  assert.match(html, /Лига Чемпионов/);
  assert.match(html, /Кубок Италии/);
  assert.match(html, /Интер/);
  assert.doesNotMatch(html, /Internazionale/);
  assert.match(html, /cw232-profile-tournament-enrichment/);
});
