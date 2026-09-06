import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pluralRu,
  pointsLabel,
  matchesLabel,
  predictionsLabel,
  goalsLabel,
  competitionPhrase,
  teamPhrase,
} from '../src/v23/locale/ru.mjs';
import { formatKickoff, formatMatchDate } from '../src/v23/locale/time.mjs';

const MATRIX = Object.freeze([
  [1,  '1 очко',    '1 матч',    '1 прогноз',    '1 гол'],
  [2,  '2 очка',    '2 матча',   '2 прогноза',   '2 гола'],
  [5,  '5 очков',   '5 матчей',  '5 прогнозов',  '5 голов'],
  [11, '11 очков',  '11 матчей', '11 прогнозов', '11 голов'],
  [21, '21 очко',   '21 матч',   '21 прогноз',   '21 гол'],
  [22, '22 очка',   '22 матча',  '22 прогноза',  '22 гола'],
  [25, '25 очков',  '25 матчей', '25 прогнозов', '25 голов'],
]);

test('Russian plural matrix is correct for all user-facing counters', () => {
  for (const [value, points, matches, predictions, goals] of MATRIX) {
    assert.equal(pointsLabel(value), points);
    assert.equal(matchesLabel(value), matches);
    assert.equal(predictionsLabel(value), predictions);
    assert.equal(goalsLabel(value), goals);
  }
  assert.equal(pluralRu(1, 'раз', 'раза', 'раз'), 'раз');
  assert.equal(pluralRu(2, 'раз', 'раза', 'раз'), 'раза');
  assert.equal(pluralRu(11, 'раз', 'раза', 'раз'), 'раз');
  assert.equal(pluralRu(22, 'раз', 'раза', 'раз'), 'раза');
});

test('competition phrases use exact approved Russian forms', () => {
  const rows = [
    ['serie_a', 'Серия А', 'Серии А', 'в Серии А'],
    ['coppa_italia', 'Кубок Италии', 'Кубка Италии', 'в Кубке Италии'],
    ['ucl', 'Лига чемпионов', 'Лиги чемпионов', 'в Лиге чемпионов'],
    ['uel', 'Лига Европы', 'Лиги Европы', 'в Лиге Европы'],
    ['uecl', 'Лига конференций', 'Лиги конференций', 'в Лиге конференций'],
  ];
  for (const [id, name, genitive, inForm] of rows) {
    assert.equal(competitionPhrase(id, 'name'), name);
    assert.equal(competitionPhrase(id, 'genitive'), genitive);
    assert.equal(competitionPhrase(id, 'in'), inForm);
  }
  assert.throws(() => competitionPhrase('premier_league', 'name'), /competition_phrase_missing/);
  assert.throws(() => competitionPhrase('serie_a', 'instrumental'), /competition_form_invalid/);
});

test('teamPhrase uses backend grammatical forms and safely falls back to canonical Russian name', () => {
  const inter = {
    nameRu:'Интер',
    genitiveRu:'Интера',
    dativeRu:'Интеру',
    prepositionalRu:'Интере',
  };
  assert.equal(teamPhrase(inter, 'name'), 'Интер');
  assert.equal(teamPhrase(inter, 'genitive'), 'Интера');
  assert.equal(teamPhrase(inter, 'dative'), 'Интеру');
  assert.equal(teamPhrase(inter, 'prepositional'), 'Интере');
  assert.equal(teamPhrase({ nameRu:'ПСЖ' }, 'genitive'), 'ПСЖ');
  assert.equal(teamPhrase({ nameRu:'Брюгге', genitiveRu:null }, 'genitive'), 'Брюгге');
  assert.throws(() => teamPhrase({ nameProvider:'Inter' }, 'name'), /team_name_ru_missing/);
  assert.throws(() => teamPhrase(inter, 'instrumental'), /team_form_invalid/);
});

test('same UTC kickoff renders in the user timezone without changing the underlying ISO', () => {
  const kickoff = '2026-09-07T18:45:00.000Z';
  const now = '2026-09-07T08:00:00.000Z';
  assert.equal(formatKickoff(kickoff, { now, timeZone:'Europe/Berlin' }), 'Сегодня · 20:45');
  assert.equal(formatKickoff(kickoff, { now, timeZone:'Europe/Moscow' }), 'Сегодня · 21:45');
  assert.equal(kickoff, '2026-09-07T18:45:00.000Z');
});

test('formatKickoff uses Сегодня, Завтра, then Russian calendar date in the supplied timezone', () => {
  const now = '2026-09-07T22:00:00.000Z';
  assert.equal(
    formatKickoff('2026-09-07T22:15:00.000Z', { now, timeZone:'Europe/Berlin' }),
    'Сегодня · 00:15',
  );
  assert.equal(
    formatKickoff('2026-09-08T22:15:00.000Z', { now, timeZone:'Europe/Berlin' }),
    'Завтра · 00:15',
  );
  assert.equal(
    formatKickoff('2026-09-11T18:45:00.000Z', { now, timeZone:'Europe/Berlin' }),
    '11 сентября · 20:45',
  );
});

test('formatMatchDate always returns a neutral Russian date/time label', () => {
  assert.equal(
    formatMatchDate('2026-09-07T18:45:00.000Z', { timeZone:'Europe/Berlin' }),
    '7 сентября · 20:45',
  );
  assert.equal(
    formatMatchDate('2026-12-01T17:30:00.000Z', { timeZone:'Europe/Moscow' }),
    '1 декабря · 20:30',
  );
});

test('time formatters fail closed on invalid UTC timestamp or timezone', () => {
  assert.throws(() => formatKickoff('not-a-date', { now:'2026-09-07T00:00:00Z', timeZone:'Europe/Berlin' }), /invalid_match_time/);
  assert.throws(() => formatKickoff('2026-09-07T18:45:00Z', { now:'not-a-date', timeZone:'Europe/Berlin' }), /invalid_now_time/);
  assert.throws(() => formatMatchDate('2026-09-07T18:45:00Z', { timeZone:'Mars\/Olympus' }), /invalid_timezone/);
});
