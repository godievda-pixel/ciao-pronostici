import test from 'node:test';
import assert from 'node:assert/strict';

import { createMatchCenterStore } from '../src/v23.3/match-center-store.mjs';
import { createCanonicalMatchCenterRuntime } from '../src/v23.3/match-center-runtime.mjs';
import {
  ROUND503_VIEW_TABS,
  canonicalRound503ViewTab,
  providerTabForRound503View,
  round503SnapHeights,
  resolveRound503Snap,
  enhanceRound503MatchCenterView,
} from '../src/v23.3/round50-3-match-center-view.mjs';

test('Round 50.3 exposes exactly the approved five user views in order', () => {
  assert.deepEqual(ROUND503_VIEW_TABS.map(tab => [tab.key, tab.label]), [
    ['overview', 'Обзор'],
    ['lineups', 'Составы'],
    ['events', 'События'],
    ['statistics', 'Статистика'],
    ['shots', 'Удары'],
  ]);
});

test('Round 50.3 maps Statistics and Shots to the existing stats provider contract', () => {
  assert.equal(providerTabForRound503View('overview'), 'overview');
  assert.equal(providerTabForRound503View('lineups'), 'lineups');
  assert.equal(providerTabForRound503View('events'), 'events');
  assert.equal(providerTabForRound503View('statistics'), 'stats');
  assert.equal(providerTabForRound503View('shots'), 'stats');
  assert.equal(canonicalRound503ViewTab('unknown'), 'overview');
});

test('Round 50.3 drawer snap targets are deterministic viewport-relative heights', () => {
  assert.deepEqual(round503SnapHeights(800), {
    compact:368,
    standard:624,
    expanded:752,
  });
});

test('Round 50.3 drawer expands on a meaningful upward drag and dismisses only downward from compact', () => {
  assert.deepEqual(
    resolveRound503Snap({ viewportHeight:800, currentHeight:624, deltaY:-120 }),
    { action:'snap', snap:'expanded', height:752 },
  );
  assert.deepEqual(
    resolveRound503Snap({ viewportHeight:800, currentHeight:368, deltaY:120 }),
    { action:'dismiss' },
  );
});

const providerStatsHtml = `<main>
  <nav class="cw239-mc-tabs" data-cw239-tabs>
    <button data-cw239-tab="overview">Обзор</button>
    <button data-cw239-tab="stats">Статистика</button>
    <button data-cw239-tab="events">События</button>
    <button data-cw239-tab="lineups">Составы</button>
    <button data-cw239-tab="players">Игроки</button>
  </nav>
  <section data-cw239-active-section="stats">
    <div class="cw233-mc-stat-group" data-cw233-mc-stats-section="primary">PRIMARY_STATS</div>
    <section class="cw250-mc-pressure" data-cw250-mc-pressure>PRESSURE</section>
    <section class="cw233-mc-shot-analysis" data-cw233-mc-shotmap>
      <button class="cw233-mc-shot-marker cw502-shot-marker" data-cw502-action="shot">SHOTMAP</button>
    </section>
    <div class="cw502-selected-shot">SELECTED_SHOT</div>
    <section class="cw233-mc-shot-list-wrap" data-cw233-mc-shot-list>SHOT_LIST</section>
  </section>
</main>`;

test('Round 50.3 Statistics keeps metrics and pressure but removes shot-specific content', () => {
  const html = enhanceRound503MatchCenterView(
    providerStatsHtml,
    { activeTab:'stats' },
    { activeViewTab:'statistics' },
  );

  assert.match(html, /Обзор/);
  assert.match(html, /Составы/);
  assert.match(html, /События/);
  assert.match(html, /Статистика/);
  assert.match(html, /Удары/);
  assert.doesNotMatch(html, />Игроки</);
  assert.match(html, /PRIMARY_STATS/);
  assert.match(html, /PRESSURE/);
  assert.doesNotMatch(html, /SHOTMAP/);
  assert.doesNotMatch(html, /SELECTED_SHOT/);
  assert.doesNotMatch(html, /SHOT_LIST/);
});

test('Round 50.3 Shots keeps interactive shot content and removes long general statistics', () => {
  const html = enhanceRound503MatchCenterView(
    providerStatsHtml,
    { activeTab:'stats' },
    { activeViewTab:'shots' },
  );

  assert.match(html, /SHOTMAP/);
  assert.match(html, /data-cw502-action="shot"/);
  assert.match(html, /SELECTED_SHOT/);
  assert.match(html, /SHOT_LIST/);
  assert.doesNotMatch(html, /PRIMARY_STATS/);
  assert.doesNotMatch(html, /PRESSURE/);
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function storeHarness({ secondStatsResult = null } = {}) {
  const staleStats = Object.freeze({ home:{ shots:8 }, away:{ shots:4 } });
  let statsCalls = 0;
  const repository = {
    async base() {
      return {
        match:{
          id:'serie_a:901',
          status:'live',
          homeTeam:{ name:'Home' },
          awayTeam:{ name:'Away' },
        },
      };
    },
    async section(_competition, _matchId, key) {
      if (key !== 'stats') return { available:true, data:{ key } };
      statsCalls += 1;
      if (statsCalls === 1) return { available:true, data:staleStats };
      return secondStatsResult ? secondStatsResult.promise : { available:true, data:staleStats };
    },
  };
  const store = createMatchCenterStore({
    repository,
    documentRef:{ hidden:true, addEventListener() {} },
    setTimer:() => null,
    clearTimer:() => {},
  });
  return { store, staleStats };
}

test('Round 50.3 forced refresh keeps stale READY stats visible until fresh data arrives', async () => {
  const pending = deferred();
  const { store, staleStats } = storeHarness({ secondStatsResult:pending });
  const freshStats = Object.freeze({ home:{ shots:10 }, away:{ shots:5 } });

  await store.open({ competition:'serie_a', matchId:'serie_a:901' });
  await store.setActiveTab('stats');
  assert.equal(store.getState().sections.stats, staleStats);

  const refresh = store.retrySection('stats');
  assert.equal(store.getState().sectionState.stats.status, 'ready');
  assert.equal(store.getState().sections.stats, staleStats);

  pending.resolve({ available:true, data:freshStats });
  await refresh;
  assert.equal(store.getState().sectionState.stats.status, 'ready');
  assert.equal(store.getState().sections.stats, freshStats);
});

test('Round 50.3 failed background refresh preserves stale READY content', async () => {
  const pending = deferred();
  const { store, staleStats } = storeHarness({ secondStatsResult:pending });

  await store.open({ competition:'serie_a', matchId:'serie_a:901' });
  await store.setActiveTab('stats');
  const refresh = store.retrySection('stats');
  pending.reject(new Error('background_refresh_failed'));
  await refresh;

  assert.equal(store.getState().sectionState.stats.status, 'ready');
  assert.equal(store.getState().sections.stats, staleStats);
});

test('Round 50.3 still exposes an error for an initial section load with no stale data', async () => {
  const repository = {
    async base() {
      return { match:{ id:'serie_a:901', status:'finished' } };
    },
    async section(_competition, _matchId, key) {
      if (key === 'stats') throw new Error('initial_stats_failed');
      return { available:true, data:{} };
    },
  };
  const store = createMatchCenterStore({
    repository,
    documentRef:{ hidden:true, addEventListener() {} },
    setTimer:() => null,
    clearTimer:() => {},
  });

  await store.open({ competition:'serie_a', matchId:'serie_a:901' });
  await store.setActiveTab('stats');
  assert.equal(store.getState().sectionState.stats.status, 'error');
});

function runtimeHarness() {
  const providerTabs = [];
  const renders = [];
  let listener = null;
  let state = {
    open:false,
    phase:'closed',
    activeTab:'overview',
    sections:{
      overview:{},
      stats:{ shots:[{ player:'Shooter', xg:.2 }] },
      lineups:{
        home:{ starters:[{ name:'Home One' }], substitutes:[{ name:'Home Sub' }] },
        away:{ starters:[{ name:'Away One' }], substitutes:[{ name:'Away Sub' }] },
      },
      events:[],
      players:null,
    },
    sectionState:{
      overview:{ status:'ready', error:'' },
      stats:{ status:'ready', error:'' },
      lineups:{ status:'ready', error:'' },
      events:{ status:'ready', error:'' },
      players:{ status:'idle', error:'' },
    },
  };
  const store = {
    subscribe(fn) { listener = fn; return () => {}; },
    getState() { return state; },
    async open() {
      state = { ...state, open:true, phase:'ready', activeTab:'overview' };
      listener?.(state);
      return state;
    },
    close() {
      state = { ...state, open:false, phase:'closed' };
      listener?.(state);
      return state;
    },
    async setActiveTab(tab) {
      providerTabs.push(tab);
      state = { ...state, activeTab:tab };
      listener?.(state);
      return state;
    },
    retryBase() { return state; },
    retrySection() { return state; },
  };
  const host = {
    bind() {},
    render(html) { renders.push(String(html || '')); },
    hide() {},
    scrollToTop() {},
    destroy() {},
  };
  let suspendCalls = 0;
  let restoreCalls = 0;
  const runtime = createCanonicalMatchCenterRuntime({
    store,
    host,
    renderView:current => `<main><nav data-cw239-tabs><button data-cw239-tab="overview">Обзор</button><button data-cw239-tab="stats">Статистика</button><button data-cw239-tab="lineups">Составы</button><button data-cw239-tab="events">События</button><button data-cw239-tab="players">Игроки</button></nav><section data-cw239-active-section="${current.activeTab}">CONTENT</section></main>`,
    suspendSource:() => { suspendCalls += 1; },
    restoreSource:() => { restoreCalls += 1; },
    currentSource:() => ({ surface:'matches', competition:'serie_a' }),
  });
  return {
    runtime,
    providerTabs,
    renders,
    getState:() => state,
    suspendCalls:() => suspendCalls,
    restoreCalls:() => restoreCalls,
  };
}

test('Round 50.3 runtime maps user views to provider tabs without suspending the source page', async () => {
  const harness = runtimeHarness();
  await harness.runtime.open({ competition:'serie_a', matchId:'serie_a:901' });
  assert.equal(harness.suspendCalls(), 0);
  assert.equal(harness.runtime.currentViewState().activeViewTab, 'overview');

  await harness.runtime.selectTab('statistics');
  assert.deepEqual(harness.providerTabs, ['stats']);
  assert.equal(harness.runtime.currentViewState().activeViewTab, 'statistics');

  const rendersBeforeShots = harness.renders.length;
  await harness.runtime.selectTab('shots');
  assert.deepEqual(harness.providerTabs, ['stats']);
  assert.equal(harness.runtime.currentViewState().activeViewTab, 'shots');
  assert.ok(harness.renders.length > rendersBeforeShots);

  harness.runtime.back();
  assert.equal(harness.restoreCalls(), 0);
});

test('Round 50.3 shot selection is owned by Shots view and clears when leaving it', async () => {
  const harness = runtimeHarness();
  await harness.runtime.open({ competition:'serie_a', matchId:'serie_a:901' });
  await harness.runtime.selectTab('statistics');
  harness.runtime.uiAction('shot', '0');
  assert.equal(harness.runtime.currentViewState().selectedShotIndex, null);

  await harness.runtime.selectTab('shots');
  harness.runtime.uiAction('shot', '0');
  assert.equal(harness.runtime.currentViewState().selectedShotIndex, 0);

  await harness.runtime.selectTab('overview');
  assert.equal(harness.runtime.currentViewState().selectedShotIndex, null);
});

test('Round 50.3 keeps Round 50.2 lineup disclosure actions working', async () => {
  const harness = runtimeHarness();
  await harness.runtime.open({ competition:'serie_a', matchId:'serie_a:901' });
  await harness.runtime.selectTab('lineups');
  harness.runtime.uiAction('lineup-disclosure', 'substitutes');
  assert.equal(harness.runtime.currentViewState().expandedLineupDisclosure, 'substitutes');
  harness.runtime.uiAction('lineup-team', 'away');
  assert.equal(harness.runtime.currentViewState().selectedLineupTeam, 'away');
  assert.equal(harness.runtime.currentViewState().expandedLineupDisclosure, null);
});
