import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seasonDateRange,
  renderMatchesHub,
  renderCompetitionScreen,
  loadCompetitionScreen,
  createMatchesUiController,
  installMatchesUi,
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

  assert.match(html, /Серия А/);
  assert.match(html, /Кубок Италии/);
  assert.match(html, /Лига Чемпионов/);
  assert.match(html, /Лига Европы/);
  assert.match(html, /Лига Конференций/);
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
  assert.match(html, /Лига Чемпионов/);
  assert.match(html, /League Phase/);
  assert.match(html, /data-cw232-match="ucl:401"/);
  assert.match(html, /Интер/);
  assert.match(html, /Арсенал/);
  assert.match(html, /https:\/\/img\.test\/inter\.png/);
  assert.match(html, /https:\/\/img\.test\/arsenal\.png/);
});

test('competition screen loader requests the whole current season and returns rendered HTML', async () => {
  const calls = [];
  const loadMatches = async (competition, options) => {
    calls.push({ competition, options });
    return {
      competition,
      matches: [{
        matchId: 'ucl:901',
        competition: 'ucl',
        stage: 'League Phase',
        kickoffAt: '2026-09-20T19:00:00Z',
        status: 'scheduled',
        homeTeam: { id: '1', name: 'Милан', crestUrl: '' },
        awayTeam: { id: '2', name: 'Ливерпуль', crestUrl: '' },
      }],
    };
  };

  const html = await loadCompetitionScreen('ucl', { loadMatches, now: new Date('2026-09-01T12:00:00Z') });
  assert.match(html, /Лига Чемпионов/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].competition, 'ucl');
  assert.deepEqual(calls[0].options, { from: '2026-07-01', to: '2027-06-30' });
});

test('matches controller opens the hub, loads external competitions and preserves legacy Serie A fallback', async () => {
  const rendered = [];
  let legacyCalls = 0;
  const controller = createMatchesUiController({
    loadMatches: async competition => ({ competition, matches: [] }),
    renderHtml: html => rendered.push(html),
    openLegacySerieA: () => { legacyCalls += 1; },
    now: () => new Date('2026-09-01T12:00:00Z'),
  });

  controller.openHub();
  assert.match(rendered.at(-1), /data-cw232-view="hub"/);

  await controller.openCompetition('ucl');
  assert.match(rendered.at(-1), /data-cw232-competition-screen="ucl"/);

  await controller.openCompetition('serie_a');
  assert.equal(legacyCalls, 1);
});

test('DOM installer binds the v23.2 hub to the existing calendar tab and closes on other tabs', () => {
  const listeners = new Map();
  const calendarButton = {
    dataset: { tab: 'calendar' },
    addEventListener(type, handler) { listeners.set(`calendar:${type}`, handler); },
  };
  const profileButton = {
    dataset: { tab: 'profile' },
    addEventListener(type, handler) { listeners.set(`profile:${type}`, handler); },
  };
  const root = {
    querySelector(selector) {
      if (selector === '[data-tab="calendar"]') return calendarButton;
      if (selector === '#ciao-miniapp-root') return this;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.nav button,[data-tab]') return [calendarButton, profileButton];
      return [];
    },
    addEventListener(type, handler, capture) {
      listeners.set(`root:${type}:${Boolean(capture)}`, handler);
    },
    appendChild() {},
  };
  let opened = 0;
  let closed = 0;
  const controller = {
    openHub() { opened += 1; },
    close() { closed += 1; },
    openCompetition() {},
  };

  installMatchesUi(root, { controller });
  listeners.get('calendar:click')?.({ preventDefault() {}, stopPropagation() {} });
  assert.equal(opened, 1);
  listeners.get('profile:click')?.({});
  assert.equal(closed, 1);
});
