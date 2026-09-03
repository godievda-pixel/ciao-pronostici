import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MATCH_CENTER_TABS,
  MATCH_CENTER_TAB_LABELS,
  createMatchCenterController,
  renderMatchCenter,
} from '../src/v23.3/match-center-core.mjs';
import { matchCenterTheme } from '../src/v23.3/match-center-theme.mjs';

const COMPETITIONS = ['serie_a', 'coppa_italia', 'ucl', 'uel', 'uecl'];
const EXPECTED_TABS = ['overview', 'stats', 'events', 'lineups', 'players'];
const EXPECTED_LABELS = ['Обзор', 'Статистика', 'События', 'Составы', 'Игроки'];

function match(competition = 'ucl') {
  return {
    competition,
    matchId:`${competition}:77`,
    status:'scheduled',
    kickoffAt:'2026-09-20T18:00:00Z',
    homeTeam:{ name:'Интер' },
    awayTeam:{ name:'Арсенал' },
    coverage:{
      overview:true,
      stats:true,
      events:true,
      lineups:true,
      players:true,
      momentum:false,
      shotmap:false,
    },
  };
}

test('Round 18 Match Center exposes the same five fixed Russian tabs for every competition', () => {
  assert.deepEqual(MATCH_CENTER_TABS, EXPECTED_TABS);
  assert.deepEqual(EXPECTED_TABS.map(key => MATCH_CENTER_TAB_LABELS[key]), EXPECTED_LABELS);

  for (const competition of COMPETITIONS) {
    const html = renderMatchCenter({
      competition,
      match:match(competition),
      activeTab:'overview',
    });
    for (const label of EXPECTED_LABELS) assert.match(html, new RegExp(`>${label}<`));
    assert.equal((html.match(/data-cw233-mc-tab=/g) || []).length, 5);
  }
});

test('Round 18 Match Center defines five distinct tournament theme keys and accent palettes', () => {
  const themes = COMPETITIONS.map(matchCenterTheme);
  assert.equal(new Set(themes.map(theme => theme.key)).size, 5);
  assert.equal(new Set(themes.map(theme => theme.vars['--mc-accent'])).size, 5);
  for (const theme of themes) {
    assert.ok(theme.vars['--mc-bg']);
    assert.ok(theme.vars['--mc-accent']);
    assert.ok(theme.vars['--mc-accent-2']);
    assert.ok(theme.vars['--mc-border']);
  }
});

test('Round 18 controller keeps tab and section state without changing legacy open/close behavior', async () => {
  let resolveSnapshot;
  const snapshot = new Promise(resolve => { resolveSnapshot = resolve; });
  const states = [];
  const controller = createMatchCenterController({
    loadSnapshot:async () => snapshot,
    documentRef:{ hidden:false, addEventListener(){} },
    onStateChange:state => states.push(state),
  });

  const opening = controller.open({
    competition:'ucl',
    matchId:'ucl:77',
    initialMatch:match('ucl'),
  });

  assert.equal(states[0].activeTab, 'overview');
  assert.deepEqual(Object.keys(states[0].sections), EXPECTED_TABS);
  assert.deepEqual(Object.keys(states[0].sectionState), EXPECTED_TABS);

  controller.setActiveTab('stats');
  assert.equal(controller.getState().activeTab, 'stats');
  assert.equal(controller.getState().open, true);

  resolveSnapshot({ match:match('ucl') });
  await opening;
  controller.close();
  assert.equal(controller.getState().open, false);
});

test('Round 18 lazy section fetch is not blocked by false coverage from the base event detail', async () => {
  const base = {
    ...match('ucl'),
    coverage:{
      overview:false,
      stats:false,
      events:false,
      lineups:false,
      players:false,
      momentum:false,
      shotmap:false,
    },
  };
  let sectionCalls = 0;
  const controller = createMatchCenterController({
    loadSnapshot:async () => ({ match:base }),
    loadSection:async (_competition, _matchId, section) => {
      sectionCalls += 1;
      assert.equal(section, 'overview');
      return {
        section:'overview',
        available:true,
        coverage:{ ...base.coverage, overview:true },
        data:{
          venue:{ name:'Renzo Barbera', city:'Palermo', capacity:null },
          referee:null,
          form:{ home:[], away:[] },
          prediction:null,
          predictionSplit:null,
          momentum:null,
          shotmap:null,
        },
      };
    },
    documentRef:{ hidden:false, addEventListener(){} },
  });

  await controller.open({
    competition:'ucl',
    matchId:'ucl:77',
    initialMatch:base,
  });

  assert.equal(sectionCalls, 1);
  assert.equal(controller.getState().sectionState.overview.status, 'ready');
  assert.equal(controller.getState().sections.overview.venue.name, 'Renzo Barbera');
  assert.equal(controller.getState().match.coverage.overview, true);
});

test('Round 18 shell keeps a stable detail frame for loading, unavailable and error states', async () => {
  const loading = renderMatchCenter({
    competition:'ucl',
    match:match('ucl'),
    activeTab:'stats',
    sectionState:{ stats:{ status:'loading' } },
  });
  const unavailable = renderMatchCenter({
    competition:'ucl',
    match:{ ...match('ucl'), coverage:{ ...match('ucl').coverage, stats:false } },
    activeTab:'stats',
  });
  const failed = renderMatchCenter({
    competition:'ucl',
    match:match('ucl'),
    activeTab:'stats',
    sectionState:{ stats:{ status:'error', error:'provider_failed' } },
  });

  for (const html of [loading, unavailable, failed]) {
    assert.match(html, /data-cw233-mc-detail-frame/);
  }
  assert.match(loading, /data-cw233-mc-section-state="loading"/);
  assert.match(unavailable, /data-cw233-mc-section-state="unavailable"/);
  assert.match(failed, /data-cw233-mc-section-state="error"/);

  const source = await readFile(new URL('../src/v23.3/match-center-core.mjs', import.meta.url), 'utf8');
  assert.match(source, /\.cw233-mc-detail-frame\{[^}]*min-height:/s);
  assert.doesNotMatch(source, /function setActiveTab[\s\S]*overlay\.innerHTML\s*=/);
});