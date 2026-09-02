import test from 'node:test';
import assert from 'node:assert/strict';
import { getCompetitionConfig } from '../src/v23.2/competition-config.mjs';
import { russianTeamName } from '../src/v23.2/team-registry.mjs';
import { formatKickoff } from '../src/v23.2/matches-ui.mjs';

test('v23.2 tournament titles are Russian', () => {
  assert.equal(getCompetitionConfig('serie_a').title, 'Serie A');
  assert.equal(getCompetitionConfig('coppa_italia').title, 'Кубок Италии');
  assert.equal(getCompetitionConfig('ucl').title, 'Лига Чемпионов');
  assert.equal(getCompetitionConfig('uel').title, 'Лига Европы');
  assert.equal(getCompetitionConfig('uecl').title, 'Лига Конференций');
});

test('team registry localizes known BSD names and falls back to raw names', () => {
  assert.equal(russianTeamName('Internazionale'), 'Интер');
  assert.equal(russianTeamName('SSC Napoli'), 'Наполи');
  assert.equal(russianTeamName('AS Roma'), 'Рома');
  assert.equal(russianTeamName('ACF Fiorentina'), 'Фиорентина');
  assert.equal(russianTeamName('Real Madrid'), 'Реал Мадрид');
  assert.equal(russianTeamName('Unknown FC'), 'Unknown FC');
});

test('same kickoff renders different local clock times without a production timezone override', () => {
  const kickoff = '2026-09-08T19:00:00+00:00';
  const moscow = formatKickoff(kickoff, { timeZone: 'Europe/Moscow' });
  const newYork = formatKickoff(kickoff, { timeZone: 'America/New_York' });
  const deviceLocal = formatKickoff(kickoff);

  assert.notEqual(moscow, newYork);
  assert.match(moscow, /22:00/);
  assert.match(newYork, /15:00/);
  assert.equal(typeof deviceLocal, 'string');
  assert.ok(deviceLocal.length > 0);
});
