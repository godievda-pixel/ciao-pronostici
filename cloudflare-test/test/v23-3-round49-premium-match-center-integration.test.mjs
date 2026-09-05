import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMatchCenterView, MATCH_CENTER_VIEW_TABS } from '../src/v23.3/match-center-view.mjs';
import { matchCenterTheme } from '../src/v23.3/match-center-theme.mjs';
import { createCanonicalMatchCenterRuntime } from '../src/v23.3/match-center-runtime.mjs';
import { adaptBsdMatchCenterSections } from '../src/v23.3/bsd-match-center-adapter.mjs';
import { normalizeSerieALegacyMatchCenter } from '../src/v23.3/serie-a-match-center-legacy-normalizer.mjs';
import { adaptSerieALegacyMatchCenter } from '../src/v23.3/serie-a-match-center-adapter.mjs';

const COMPETITIONS = ['serie_a', 'coppa_italia', 'ucl', 'uel', 'uecl'];
const TAB_LABELS = ['Обзор', 'Статы', 'События', 'Составы', 'Игроки'];

function coverage(value = true) {
  return {
    overview:value,
    stats:value,
    events:value,
    lineups:value,
    players:value,
    momentum:value,
    shotmap:value,
  };
}

function sectionState(overrides = {}) {
  return {
    overview:{ status:'idle', error:'' },
    stats:{ status:'idle', error:'' },
    events:{ status:'idle', error:'' },
    lineups:{ status:'idle', error:'' },
    players:{ status:'idle', error:'' },
    ...overrides,
  };
}

function viewState(competition, { status = 'finished', activeTab = 'overview', sectionOverrides = {}, sections = {} } = {}) {
  return {
    open:true,
    phase:'ready',
    competition,
    matchId:`${competition}:77`,
    activeTab,
    match:{
      competition,
      matchId:`${competition}:77`,
      status,
      minute:status === 'live' ? 67 : null,
      kickoffAt:'2026-09-20T18:00:00Z',
      homeTeam:{ name:'Home United', crestUrl:'' },
      awayTeam:{ name:'Away City', crestUrl:'' },
      score:{ home:2, away:1 },
      homeScore:2,
      awayScore:1,
      coverage:coverage(true),
      goals:{
        home:[{ player:'Marco Rossi', minute:34, kind:'penalty' }, { player:'Luca Bianchi', minute:58 }],
        away:[{ player:'Paolo Neri', minute:61, kind:'own_goal' }],
      },
    },
    sections:{ overview:null, stats:null, events:null, lineups:null, players:null, ...sections },
    sectionState:sectionState(sectionOverrides),
  };
}

test('Premium Match Center uses one five-tab shell with a distinct tournament theme for every competition', () => {
  assert.deepEqual(MATCH_CENTER_VIEW_TABS, ['overview','stats','events','lineups','players']);
  const accents = new Set();
  const themeKeys = new Set();

  for (const competition of COMPETITIONS) {
    const theme = matchCenterTheme(competition);
    const html = renderMatchCenterView(viewState(competition));
    accents.add(theme.vars['--mc-accent']);
    themeKeys.add(theme.key);

    assert.match(html, /data-cw239-match-center/);
    assert.match(html, new RegExp(`data-cw239-competition="${competition}"`));
    assert.match(html, new RegExp(`data-cw239-theme="${theme.key}"`));
    assert.equal((html.match(/data-cw239-tab=/g) || []).length, 5);
    for (const label of TAB_LABELS) assert.match(html, new RegExp(`>${label}<`));
    assert.match(html, new RegExp(`--mc-accent:${theme.vars['--mc-accent']}`));
    assert.match(html, /scrollbar-width:none/);
    assert.match(html, /\.cw239-mc::-webkit-scrollbar\{display:none/);
    assert.match(html, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
    assert.match(html, /@media\(max-width:339px\)/);
  }

  assert.equal(accents.size, COMPETITIONS.length);
  assert.equal(themeKeys.size, COMPETITIONS.length);
});

test('Premium Match Center renders live and finished score states without changing the shell', () => {
  const live = renderMatchCenterView(viewState('ucl', { status:'live' }));
  const finished = renderMatchCenterView(viewState('ucl', { status:'finished' }));

  assert.match(live, />2:1</);
  assert.match(live, /LIVE · 67′/);
  assert.match(finished, />2:1</);
  assert.match(finished, /Матч завершён/);
  assert.equal((live.match(/data-cw239-tab=/g) || []).length, 5);
  assert.equal((finished.match(/data-cw239-tab=/g) || []).length, 5);
  assert.match(finished, /Marco Rossi/);
  assert.match(finished, /34′ \(П\)/);
  assert.match(finished, /61′ \(АГ\)/);
});

test('Optional unavailable data stays section-local and never fabricates player ratings', () => {
  const html = renderMatchCenterView(viewState('uecl', {
    activeTab:'players',
    sectionOverrides:{ players:{ status:'unavailable', error:'' } },
  }));

  assert.match(html, /data-cw239-section-state="unavailable"/);
  assert.match(html, /Данные пока недоступны/);
  assert.doesNotMatch(html, /data-cw233-mc-player-rating/);
  assert.match(html, /data-cw239-board/);
});

test('Serie A and BSD adapters both expose the same canonical Match Center section families', () => {
  const richLineups = {
    home:{ formation:'4-3-3', coach:{ name:'Home Coach' }, players:[{ id:1, short_name:'Keeper', position:'GK', number:1, x:50, y:8 }], substitutes:[] },
    away:{ formation:'4-4-2', coach:{ name:'Away Coach' }, players:[], substitutes:[] },
  };
  const richGoal = { type:'goal', minute:34, is_home:true, player:{ name:'Marco Rossi' }, home_score:1, away_score:0, goal_kind:'penalty' };
  const richShot = { side:'home', x:78, y:44, minute:34, player:{ name:'Marco Rossi' }, xg:0.78, outcome:'goal', situation:'penalty' };

  const bsd = adaptBsdMatchCenterSections({
    statistics:{ home:{ expected_goals:1.7 }, away:{ expected_goals:0.9 } },
    incidents:[richGoal],
    shotmap:[richShot],
    lineups:richLineups,
  });

  const serieA = adaptSerieALegacyMatchCenter(normalizeSerieALegacyMatchCenter({
    match:{
      id:77,
      status:'finished',
      home_score:1,
      away_score:0,
      home_team:{ id:1, name:'Home United' },
      away_team:{ id:2, name:'Away City' },
    },
    stats:{ stats:{ home:{ expected_goals:1.7 }, away:{ expected_goals:0.9 } }, shotmap:[richShot] },
    incidents:{ incidents:[richGoal] },
    lineups:{ lineups:richLineups },
  }));

  for (const adapted of [bsd, serieA]) {
    for (const key of ['overview','stats','events','lineups','players','coverage']) {
      assert.ok(Object.hasOwn(adapted, key), `missing canonical ${key}`);
    }
    assert.equal(adapted.events[0].player, 'Marco Rossi');
    assert.equal(adapted.events[0].goalKind, 'penalty');
    assert.equal(adapted.stats.shots[0].xg, 0.78);
    assert.equal(adapted.lineups.home.coach, 'Home Coach');
  }
});

test('Canonical runtime restores the exact source context on Back', async () => {
  const snapshots = [];
  let closed = 0;
  let hidden = 0;
  let scrolledTop = 0;
  const restored = [];
  const suspended = [];
  const source = Object.freeze({ surface:'matches', tab:'calendar', competition:'uel', scrollTop:412, matchesOverlayScrollTop:97 });
  const store = {
    subscribe(listener) { this.listener = listener; return () => {}; },
    async open(payload) { snapshots.push(payload); return payload; },
    close() { closed += 1; return { open:false }; },
    setActiveTab() {},
  };
  const host = {
    bind() {},
    render() {},
    hide() { hidden += 1; },
    scrollToTop() { scrolledTop += 1; },
    destroy() {},
  };
  const runtime = createCanonicalMatchCenterRuntime({
    store,
    host,
    renderView:() => '',
    suspendSource:value => suspended.push(value),
    restoreSource:value => restored.push(value),
  });

  await runtime.open({ competition:'uel', matchId:'uel:77', source });
  runtime.back();

  assert.equal(snapshots[0].competition, 'uel');
  assert.equal(snapshots[0].matchId, 'uel:77');
  assert.equal(scrolledTop, 1);
  assert.deepEqual(suspended, [source]);
  assert.deepEqual(restored, [source]);
  assert.equal(closed, 1);
  assert.equal(hidden, 1);
});
