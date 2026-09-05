import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ROUND51_RUNTIME_BUILD,
  createRound51MatchCenterRuntime,
} from '../src/v23.3/round51-match-center-runtime.mjs';

function runtimeHarness() {
  const providerTabs = [];
  const calls = [];
  const renders = [];
  let listener = null;
  let state = {
    open:false,
    phase:'closed',
    activeTab:'overview',
    match:{ id:'serie_a:901', status:'live' },
    sections:{
      overview:{},
      stats:{ shots:[{ player:'Shooter', xg:.2 }, { player:'Second', xg:.07 }] },
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
    subscribe(fn) { listener = fn; return () => { listener = null; }; },
    getState() { return state; },
    async open(payload) {
      calls.push(['open', payload]);
      state = { ...state, open:true, phase:'ready', activeTab:'overview' };
      listener?.(state);
      return state;
    },
    close() {
      calls.push(['close']);
      state = { ...state, open:false, phase:'closed' };
      listener?.(state);
      return state;
    },
    async setActiveTab(tab) {
      calls.push(['tab', tab]);
      providerTabs.push(tab);
      state = { ...state, activeTab:tab };
      listener?.(state);
      return state;
    },
    retryBase() { calls.push(['retry-base']); return state; },
    retrySection(tab) { calls.push(['retry-section', tab]); return state; },
  };

  const host = {
    hidden:true,
    snap:null,
    bound:null,
    bind(runtime) { this.bound = runtime; },
    render(html) { renders.push(String(html || '')); this.hidden = false; },
    hide() { this.hidden = true; },
    setSnap(value) { this.snap = value; return value; },
    scrollToTop() { calls.push(['scroll-top']); },
    destroy() { calls.push(['host-destroy']); },
  };

  const runtime = createRound51MatchCenterRuntime({
    store,
    host,
    renderView:current => `<main><nav data-cw239-tabs><button data-cw239-tab="overview">Обзор</button><button data-cw239-tab="stats">Статы</button><button data-cw239-tab="events">События</button><button data-cw239-tab="lineups">Составы</button><button data-cw239-tab="players">Игроки</button></nav><section data-cw239-active-section="${current.activeTab}">CONTENT</section></main>`,
    enhanceView:(html, _state, viewState) => `${html}<i data-test-view="${viewState.activeViewTab}"></i>`,
  });

  return { runtime, store, host, providerTabs, calls, renders, getState:() => state };
}

test('Round 51 runtime is isolated and treats source only as metadata', async () => {
  const harness = runtimeHarness();
  const source = Object.freeze({ surface:'matches', competition:'serie_a', scrollTop:88 });

  await harness.runtime.open({ competition:'serie_a', matchId:'serie_a:901', source });

  assert.equal(ROUND51_RUNTIME_BUILD, 'round51-bottom-drawer');
  assert.deepEqual(harness.runtime.currentSource(), source);
  assert.equal(harness.host.snap, 'standard');
  assert.equal(harness.runtime.currentViewState().activeViewTab, 'overview');
  assert.deepEqual(source, { surface:'matches', competition:'serie_a', scrollTop:88 });

  harness.runtime.back();
  assert.equal(harness.host.hidden, true);
  assert.equal(harness.runtime.currentSource(), null);
  assert.equal(harness.calls.filter(call => call[0] === 'close').length, 1);
});

test('Round 51 maps Statistics and Shots to one stats provider without duplicate loading', async () => {
  const harness = runtimeHarness();
  await harness.runtime.open({ competition:'serie_a', matchId:'serie_a:901' });

  await harness.runtime.selectTab('statistics');
  assert.deepEqual(harness.providerTabs, ['stats']);
  assert.equal(harness.runtime.currentViewState().activeViewTab, 'statistics');

  const rendersBeforeShots = harness.renders.length;
  await harness.runtime.selectTab('shots');
  assert.deepEqual(harness.providerTabs, ['stats']);
  assert.equal(harness.runtime.currentViewState().activeViewTab, 'shots');
  assert.ok(harness.renders.length > rendersBeforeShots);

  await harness.runtime.selectTab('overview');
  assert.deepEqual(harness.providerTabs, ['stats', 'overview']);
});

test('Round 51 shot state belongs only to Shots view', async () => {
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

test('Round 51 keeps Round 50.2 lineup team and disclosure interactions', async () => {
  const harness = runtimeHarness();
  await harness.runtime.open({ competition:'serie_a', matchId:'serie_a:901' });
  await harness.runtime.selectTab('lineups');

  harness.runtime.uiAction('lineup-disclosure', 'substitutes');
  assert.equal(harness.runtime.currentViewState().expandedLineupDisclosure, 'substitutes');
  harness.runtime.uiAction('lineup-team', 'away');
  assert.equal(harness.runtime.currentViewState().selectedLineupTeam, 'away');
  assert.equal(harness.runtime.currentViewState().expandedLineupDisclosure, null);
});

test('Round 51 retry maps user view identity back to canonical provider section', async () => {
  const harness = runtimeHarness();
  await harness.runtime.open({ competition:'serie_a', matchId:'serie_a:901' });
  harness.runtime.retrySection('shots');
  harness.runtime.retrySection('statistics');
  harness.runtime.retrySection('lineups');

  assert.deepEqual(harness.calls.filter(call => call[0] === 'retry-section'), [
    ['retry-section', 'stats'],
    ['retry-section', 'stats'],
    ['retry-section', 'lineups'],
  ]);
});

test('Round 51 runtime source contains no legacy lifecycle ownership', async () => {
  const source = await readFile(new URL('../src/v23.3/round51-match-center-runtime.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /match-center-lifecycle|suspendMatchSource|restoreMatchSource|currentMatchSource|MATCH_CENTER_OWNER_CLASS/);
});
