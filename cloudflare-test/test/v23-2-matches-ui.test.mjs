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
        homeScore: null,
        awayScore: null,
      }],
    };
  };

  const html = await loadCompetitionScreen('ucl', {
    now: new Date('2026-09-01T12:00:00Z'),
    loadMatches,
  });

  assert.deepEqual(calls, [{
    competition: 'ucl',
    options: { from: '2026-07-01', to: '2027-06-30' },
  }]);
  assert.match(html, /Милан/);
  assert.match(html, /Ливерпуль/);
});

test('matches controller opens the hub, loads external competitions and preserves legacy Serie A fallback', async () => {
  const shown = [];
  let hidden = 0;
  const loaded = [];
  const controller = createMatchesUiController({
    show(html) { shown.push(html); },
    hide() { hidden += 1; },
    async loadScreen(competition) {
      loaded.push(competition);
      return `<section data-loaded="${competition}">${competition}</section>`;
    },
  });

  controller.openHub();
  assert.match(shown.at(-1), /data-cw232-view="hub"/);

  await controller.openCompetition('ucl');
  assert.deepEqual(loaded, ['ucl']);
  assert.match(shown.at(-1), /data-loaded="ucl"/);

  await controller.openCompetition('serie_a');
  assert.equal(hidden, 1);
  assert.deepEqual(loaded, ['ucl']);
});

test('DOM installer binds the v23.2 hub to the existing calendar tab and closes on other tabs', () => {
  const listeners = [];
  const nodes = new Map();
  const append = node => { if (node.id) nodes.set(node.id, node); };
  const documentRef = {
    head: { appendChild: append },
    body: { appendChild: append },
    createElement(tagName) {
      return {
        tagName,
        id: '',
        className: '',
        hidden: false,
        innerHTML: '',
        textContent: '',
        dataset: {},
        setAttribute() {},
      };
    },
    getElementById(id) { return nodes.get(id) || null; },
    querySelectorAll() { return []; },
    addEventListener(type, handler, options) { listeners.push({ type, handler, options }); },
  };

  installMatchesUi(documentRef, { defer: fn => fn() });
  const overlay = nodes.get('ciao-v232-matches-overlay');
  assert.ok(overlay);
  assert.equal(overlay.hidden, true);

  const captureClick = listeners.find(item => item.type === 'click' && item.options === true)?.handler;
  assert.equal(typeof captureClick, 'function');

  captureClick({
    target: {
      closest(selector) {
        if (selector === 'button[data-tab]') return { dataset: { tab: 'calendar' } };
        return null;
      },
    },
    preventDefault() {},
  });
  assert.equal(overlay.hidden, false);
  assert.match(overlay.innerHTML, /data-cw232-view="hub"/);

  captureClick({
    target: {
      closest(selector) {
        if (selector === 'button[data-tab]') return { dataset: { tab: 'profile' } };
        return null;
      },
    },
    preventDefault() {},
  });
  assert.equal(overlay.hidden, true);
});

test('matches overlay suspends for external legacy Match Center and resumes without losing screen or scroll', () => {
  const listeners = [];
  const nodes = new Map();
  const append = node => { if (node.id) nodes.set(node.id, node); };
  const documentRef = {
    head: { appendChild: append },
    body: { appendChild: append },
    createElement(tagName) {
      return {
        tagName,
        id: '',
        className: '',
        hidden: false,
        innerHTML: '',
        textContent: '',
        dataset: {},
        scrollTop: 0,
        setAttribute() {},
      };
    },
    getElementById(id) { return nodes.get(id) || null; },
    querySelectorAll() { return []; },
    addEventListener(type, handler, options) { listeners.push({ type, handler, options }); },
  };

  installMatchesUi(documentRef, { defer: fn => fn() });
  const overlay = nodes.get('ciao-v232-matches-overlay');
  const captureClick = listeners.find(item => item.type === 'click' && item.options === true)?.handler;
  captureClick({
    target: { closest(selector) { return selector === 'button[data-tab]' ? { dataset: { tab: 'calendar' } } : null; } },
    preventDefault() {},
  });

  overlay.innerHTML = '<section data-test="coppa">Palermo — Mantova</section>';
  overlay.scrollTop = 314;
  const suspend = listeners.find(item => item.type === 'ciao-v233-external-match-center-suspend-matches')?.handler;
  const resume = listeners.find(item => item.type === 'ciao-v233-external-match-center-resume-matches')?.handler;
  assert.equal(typeof suspend, 'function');
  assert.equal(typeof resume, 'function');

  suspend({ type:'ciao-v233-external-match-center-suspend-matches' });
  assert.equal(overlay.hidden, true);
  assert.match(overlay.innerHTML, /Palermo — Mantova/);

  overlay.scrollTop = 0;
  resume({ type:'ciao-v233-external-match-center-resume-matches' });
  assert.equal(overlay.hidden, false);
  assert.match(overlay.innerHTML, /Palermo — Mantova/);
  assert.equal(overlay.scrollTop, 314);
});
