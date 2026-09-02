import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoppaBracket, normalizeCoppaStage } from '../src/v23.2/coppa-bracket.mjs';
import { renderCompetitionScreen } from '../src/v23.2/matches-ui.mjs';

function team(id, name) { return { id, name, crestUrl: '' }; }
function match(id, stage, home, away, extra = {}) {
  return {
    matchId: `coppa_italia:${id}`,
    competition: 'coppa_italia',
    stage,
    kickoffAt: extra.kickoffAt || '2027-01-10T20:00:00Z',
    status: extra.status || 'scheduled',
    homeTeam: home || team('', ''),
    awayTeam: away || team('', ''),
    homeScore: extra.homeScore ?? null,
    awayScore: extra.awayScore ?? null,
    homeSourceMatchId: extra.homeSourceMatchId || '',
    awaySourceMatchId: extra.awaySourceMatchId || '',
  };
}

test('Coppa bracket normalizes and orders knockout stages', () => {
  assert.equal(normalizeCoppaStage('Round of 16').key, 'round_of_16');
  assert.equal(normalizeCoppaStage('Quarter-finals').key, 'quarterfinal');
  assert.equal(normalizeCoppaStage('Semi-finals').key, 'semifinal');
  assert.equal(normalizeCoppaStage('Final').key, 'final');

  const bracket = buildCoppaBracket([
    match('f', 'Final', team('1', 'Интер'), team('2', 'Ювентус')),
    match('q', 'Quarter-finals', team('3', 'Милан'), team('4', 'Лацио')),
    match('r', 'Round of 16', team('5', 'Рома'), team('6', 'Наполи')),
    match('s', 'Semi-finals', team('7', 'Аталанта'), team('8', 'Фиорентина')),
  ]);

  assert.deepEqual(bracket.rounds.map(round => round.key), [
    'round_of_16', 'quarterfinal', 'semifinal', 'final',
  ]);
});

test('Coppa bracket shows winner-of placeholder only for an explicit source tie', () => {
  const source = match('100', 'Round of 16', team('10', 'Милан'), team('11', 'Лацио'));
  const quarter = match('200', 'Quarter-finals', team('12', 'Интер'), team('', ''), { awaySourceMatchId: source.matchId });
  const bracket = buildCoppaBracket([source, quarter]);
  const next = bracket.rounds.find(round => round.key === 'quarterfinal').matches[0];
  assert.equal(next.homeLabel, 'Интер');
  assert.equal(next.awayLabel, 'Победитель пары Милан — Лацио');
});

test('Coppa bracket never guesses an unresolved opponent', () => {
  const quarter = match('200', 'Quarter-finals', team('12', 'Интер'), team('', ''));
  const bracket = buildCoppaBracket([quarter]);
  const next = bracket.rounds[0].matches[0];
  assert.equal(next.awayLabel, 'Соперник определяется');
});

test('Coppa screen keeps only the clickable stage schedule after bracket moves to Tables', () => {
  const html = renderCompetitionScreen('coppa_italia', {
    competition: 'coppa_italia',
    matches: [match('100', 'Round of 16', team('10', 'Милан'), team('11', 'Лацио'))],
  });

  assert.match(html, /data-cw232-group-key="stage:Round of 16"/);
  assert.match(html, /data-cw232-group-panel="stage:Round of 16"/);
  assert.match(html, />1\/8 финала</);
  assert.match(html, /Милан/);
  assert.match(html, /Лацио/);
  assert.doesNotMatch(html, /data-cw232-coppa-view="bracket"/);
  assert.doesNotMatch(html, /Сетка Плей-офф/);
  assert.doesNotMatch(html, /cw232-bracket-viewport/);
});
