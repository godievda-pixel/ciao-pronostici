import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderTablesHub,
  loadTablesCompetition,
  createTablesUiController,
  installTablesUi,
} from '../src/v23.3/tables-ui.mjs';

function standingRow(overrides = {}) {
  return {
    competition: 'ucl',
    position: 1,
    team: { id: '359', name: 'Арсенал', rawName: 'Arsenal', crestUrl: '' },
    played: 8,
    wins: 6,
    draws: 1,
    losses: 1,
    goalsFor: 18,
    goalsAgainst: 7,
    goalDifference: 11,
    points: 19,
    ...overrides,
  };
}

function team(id, name) {
  return { id, name, crestUrl: '' };
}

function coppaMatch(id, stage, home, away, extra = {}) {
  return {
    matchId: `coppa_italia:${id}`,
    competition: 'coppa_italia',
    stage,
    kickoffAt: extra.kickoffAt || '2027-01-10T20:00:00Z',
    status: 'scheduled',
    homeTeam: home || team('', ''),
    awayTeam: away || team('', ''),
    homeScore: null,
    awayScore: null,
    homeSourceMatchId: extra.homeSourceMatchId || '',
    awaySourceMatchId: extra.awaySourceMatchId || '',
  };
}

test('v23.3 Tables exposes all five tournament destinations and full UEFA rows', () => {
  const html = renderTablesHub({
    selectedCompetition: 'ucl',
    data: {
      competition: 'ucl',
      rows: [
        standingRow(),
        standingRow({
          position: 2,
          team: { id: '110', name: 'Интер', rawName: 'Internazionale', crestUrl: '' },
          points: 17,
        }),
      ],
    },
  });

  for (const competition of ['serie_a', 'ucl', 'uel', 'uecl', 'coppa_italia']) {
    assert.match(html, new RegExp(`data-cw233-tables-competition="${competition}"`));
  }
  for (const title of ['Серия А', 'Лига Чемпионов', 'Лига Европы', 'Лига Конференций', 'Кубок Италии']) {
    assert.match(html, new RegExp(title));
  }

  assert.match(html, /Арсенал/);
  assert.match(html, /Интер/);
  assert.match(html, /19/);
});

test('v23.3 Tables renders missing provider statistics as dash', () => {
  const html = renderTablesHub({
    selectedCompetition: 'uel',
    data: {
      competition: 'uel',
      rows: [standingRow({
        competition: 'uel',
        played: null,
        wins: null,
        draws: null,
        losses: null,
        goalDifference: null,
        points: null,
      })],
    },
  });

  assert.match(html, /data-cw233-stat="played">—</);
  assert.match(html, /data-cw233-stat="goal-difference">—</);
  assert.match(html, /data-cw233-stat="points">—</);
});

test('v23.3 Tables renders the Coppa bracket and only explicit winner placeholders', () => {
  const source = coppaMatch('100', 'Round of 16', team('10', 'Милан'), team('11', 'Лацио'));
  const linked = coppaMatch('200', 'Quarter-finals', team('12', 'Интер'), team('', ''), {
    awaySourceMatchId: source.matchId,
  });
  const unresolved = coppaMatch('201', 'Quarter-finals', team('13', 'Рома'), team('', ''));

  const html = renderTablesHub({
    selectedCompetition: 'coppa_italia',
    data: { competition: 'coppa_italia', matches: [source, linked, unresolved] },
  });

  assert.match(html, /cw232-bracket-viewport/);
  assert.match(html, /Победитель пары Милан — Лацио/);
  assert.match(html, /Соперник определяется/);
  assert.doesNotMatch(html, /Победитель пары Рома/);
});

test('v23.3 Tables loader uses standings for leagues and Coppa matches for the bracket', async () => {
  const calls = [];
  const loadStandings = async competition => {
    calls.push(['standings', competition]);
    return { competition, rows: [standingRow({ competition })] };
  };
  const loadMatches = async (competition, range) => {
    calls.push(['matches', competition, range]);
    return { competition, matches: [coppaMatch('100', 'Round of 16', team('10', 'Милан'), team('11', 'Лацио'))] };
  };

  const ucl = await loadTablesCompetition('ucl', { loadStandings, loadMatches });
  assert.match(ucl, /Арсенал/);

  const coppa = await loadTablesCompetition('coppa_italia', {
    now: new Date('2026-09-02T12:00:00Z'),
    loadStandings,
    loadMatches,
  });
  assert.match(coppa, /cw232-bracket-viewport/);

  assert.deepEqual(calls, [
    ['standings', 'ucl'],
    ['matches', 'coppa_italia', { from: '2026-07-01', to: '2027-06-30' }],
  ]);
});

test('v23.3 Tables controller isolates stale loads', async () => {
  const shown = [];
  let hidden = 0;
  let resolveUcl;
  const controller = createTablesUiController({
    show(html) { shown.push(html); },
    hide() { hidden += 1; },
    loadCompetition(competition) {
      if (competition === 'ucl') return new Promise(resolve => { resolveUcl = resolve; });
      return Promise.resolve(`<section data-loaded="${competition}"></section>`);
    },
  });

  const pending = controller.openCompetition('ucl');
  await controller.openCompetition('uel');
  resolveUcl('<section data-loaded="ucl"></section>');
  assert.equal(await pending, 'stale');
  assert.match(shown.at(-1), /data-loaded="uel"/);
  controller.close();
  assert.equal(hidden, 1);
});

test('v23.3 Tables mounts in miniapp root and capture navigation does not block Matches or Profile', () => {
  const listeners = [];
  const nodes = new Map();
  const bodyChildren = [];
  const rootChildren = [];

  const appendTo = list => node => {
    list.push(node);
    if (node.id) nodes.set(node.id, node);
  };

  const root = { id: 'ciao-miniapp-root', appendChild: appendTo(rootChildren) };
  nodes.set(root.id, root);

  const documentRef = {
    head: { appendChild: appendTo([]) },
    body: { appendChild: appendTo(bodyChildren) },
    createElement(tagName) {
      return {
        ownerDocument: documentRef,
        tagName,
        id: '',
        className: '',
        hidden: false,
        innerHTML: '',
        textContent: '',
        dataset: {},
        setAttribute() {},
        scrollTo() {},
        querySelector() { return null; },
      };
    },
    getElementById(id) { return nodes.get(id) || null; },
    querySelectorAll() { return []; },
    addEventListener(type, handler, options) { listeners.push({ type, handler, options }); },
  };

  installTablesUi(documentRef, { defer: fn => fn() });
  const overlay = nodes.get('ciao-v233-tables-overlay');
  assert.ok(overlay);
  assert.equal(rootChildren.includes(overlay), true);
  assert.equal(bodyChildren.includes(overlay), false);

  const capture = listeners.find(item => item.type === 'click' && item.options === true)?.handler;
  assert.equal(typeof capture, 'function');

  let prevented = 0;
  let stopped = 0;
  const navEvent = tab => ({
    target: {
      closest(selector) {
        if (selector === 'button[data-tab]') return { dataset: { tab } };
        return null;
      },
    },
    preventDefault() { prevented += 1; },
    stopPropagation() { stopped += 1; },
  });

  capture(navEvent('seriea'));
  assert.equal(overlay.hidden, false);
  assert.match(overlay.innerHTML, /data-cw233-tables-view="hub"/);

  capture(navEvent('calendar'));
  assert.equal(overlay.hidden, true);
  capture(navEvent('profile'));
  assert.equal(overlay.hidden, true);
  assert.equal(prevented, 0);
  assert.equal(stopped, 0);
});