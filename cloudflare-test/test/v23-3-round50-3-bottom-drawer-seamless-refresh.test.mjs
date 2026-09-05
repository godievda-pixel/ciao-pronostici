import test from 'node:test';
import assert from 'node:assert/strict';

import { createMatchCenterStore } from '../src/v23.3/match-center-store.mjs';
import {
  createBrowserMatchCenterHost,
  createCanonicalMatchCenterRuntime,
} from '../src/v23.3/match-center-runtime.mjs';
import { renderMatchCenterView } from '../src/v23.3/match-center-view.mjs';
import { enhanceRound502MatchCenterView } from '../src/v23.3/round50-2-match-center-view.mjs';
import {
  MATCH_CENTER_USER_TABS,
  enhanceRound503MatchCenterView,
  providerTabForView,
  resolveDrawerSnap,
} from '../src/v23.3/round50-3-match-center-view.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function liveMatch() {
  return {
    competition:'serie_a',
    matchId:'serie_a:503',
    status:'live',
    minute:21,
    kickoffAt:'2026-09-05T13:00:00Z',
    homeTeam:{ id:'1', name:'Фиорентина', crestUrl:'' },
    awayTeam:{ id:'2', name:'Торино', crestUrl:'' },
    score:{ home:0, away:0 },
    goals:{ home:[], away:[] },
    coverage:{ overview:true, stats:true, events:true, lineups:true, players:true },
  };
}

function sectionPayload(data) {
  return { available:true, coverage:{ overview:true }, data };
}

function readyState(activeTab = 'overview') {
  return {
    open:true,
    phase:'ready',
    competition:'serie_a',
    matchId:'serie_a:503',
    match:liveMatch(),
    activeTab,
    sections:{ overview:{ form:{ home:[], away:[] } }, stats:null, events:null, lineups:null, players:null },
    sectionState:{
      overview:{ status:'ready', error:'' },
      stats:{ status:'idle', error:'' },
      events:{ status:'idle', error:'' },
      lineups:{ status:'idle', error:'' },
      players:{ status:'idle', error:'' },
    },
    error:'',
  };
}

function fakeDocument() {
  const listeners = new Map();
  const root = {
    children:[],
    appendChild(node) { this.children.push(node); node.parentNode = this; },
  };
  const head = { appendChild() {} };
  const makeNode = tag => ({
    tagName:String(tag || '').toUpperCase(),
    id:'',
    dataset:{},
    style:{},
    hidden:false,
    innerHTML:'',
    scrollTop:0,
    textContent:'',
    setAttribute() {},
    removeAttribute() {},
    addEventListener(type, fn) { listeners.set(`${this.id || tag}:${type}`, fn); },
    removeEventListener() {},
    remove() {},
    contains() { return true; },
    querySelector() { return null; },
    getBoundingClientRect() { return { height:624 }; },
  });
  return {
    head,
    body:root,
    defaultView:{ addEventListener() {}, removeEventListener() {}, innerHeight:800 },
    createElement:makeNode,
    getElementById(id) { return id === 'ciao-miniapp-root' ? root : null; },
    querySelector() { return null; },
    addEventListener() {},
    removeEventListener() {},
    _listeners:listeners,
  };
}

test('Round 50.3 force refresh keeps ready section content visible and never emits a loading replacement', async () => {
  const refresh = deferred();
  let sectionCalls = 0;
  const repository = {
    async base() { return liveMatch(); },
    async section() {
      sectionCalls += 1;
      if (sectionCalls === 1) return sectionPayload({ marker:'stale-overview' });
      return refresh.promise;
    },
  };
  const store = createMatchCenterStore({
    repository,
    setTimer:() => 1,
    clearTimer() {},
    documentRef:{ hidden:false, addEventListener() {} },
  });
  const snapshots = [];
  store.subscribe(state => snapshots.push(state));
  await store.open({ competition:'serie_a', matchId:'serie_a:503' });
  snapshots.length = 0;

  const pending = store.retrySection('overview');
  await Promise.resolve();

  assert.equal(store.getState().sections.overview.marker, 'stale-overview');
  assert.equal(store.getState().sectionState.overview.status, 'ready');
  assert.equal(snapshots.some(state => state.sectionState.overview.status === 'loading'), false);

  refresh.resolve(sectionPayload({ marker:'fresh-overview' }));
  await pending;
  assert.equal(store.getState().sections.overview.marker, 'fresh-overview');
});

test('Round 50.3 failed background refresh preserves stale ready content instead of an error card', async () => {
  let sectionCalls = 0;
  const repository = {
    async base() { return liveMatch(); },
    async section() {
      sectionCalls += 1;
      if (sectionCalls === 1) return sectionPayload({ marker:'still-visible' });
      throw new Error('temporary-upstream-error');
    },
  };
  const store = createMatchCenterStore({
    repository,
    setTimer:() => 1,
    clearTimer() {},
    documentRef:{ hidden:false, addEventListener() {} },
  });
  await store.open({ competition:'serie_a', matchId:'serie_a:503' });
  await store.retrySection('overview');
  const state = store.getState();
  assert.equal(state.sections.overview.marker, 'still-visible');
  assert.equal(state.sectionState.overview.status, 'ready');
});

test('Round 50.3 user navigation is Overview, Lineups, Events, Statistics, Shots and hides Players', () => {
  const html = renderMatchCenterView(readyState());
  const labels = ['Обзор','Составы','События','Статистика','Удары'];
  let cursor = -1;
  for (const label of labels) {
    const next = html.indexOf(`>${label}</button>`);
    assert.ok(next > cursor, `${label} must appear after the previous Match Center tab`);
    cursor = next;
  }
  assert.doesNotMatch(html, />Игроки<\/button>/);
  assert.deepEqual(MATCH_CENTER_USER_TABS, ['overview','lineups','events','stats','shots']);
  assert.equal(providerTabForView('shots'), 'stats');
  assert.equal(providerTabForView('stats'), 'stats');
});

test('Round 50.3 shots view maps to the stats provider while runtime keeps shots as the active user view', async () => {
  let listener = null;
  let current = {
    ...readyState('overview'),
    sections:{ overview:{}, stats:{ home:{ shots:1 }, away:{ shots:0 }, shots:[] }, events:null, lineups:null, players:null },
    sectionState:{ overview:{status:'ready',error:''}, stats:{status:'ready',error:''}, events:{status:'idle',error:''}, lineups:{status:'idle',error:''}, players:{status:'idle',error:''} },
  };
  const calls = [];
  const store = {
    subscribe(fn) { listener = fn; return () => {}; },
    getState() { return current; },
    open() { return current; },
    close() { return current; },
    async setActiveTab(tab) { calls.push(tab); current = { ...current, activeTab:tab }; listener?.(current); return current; },
    retryBase() { return current; },
    retrySection() { return current; },
  };
  const host = { bind() {}, render() {}, hide() {}, scrollToTop() {}, destroy() {} };
  const runtime = createCanonicalMatchCenterRuntime({ store, host, renderView:() => '<div></div>', enhanceView:html => html });
  listener(current);
  await runtime.selectTab('shots');
  assert.deepEqual(calls, ['stats']);
  assert.equal(runtime.currentViewState().activeViewTab, 'shots');
});

test('Round 50.3 Statistics and Shots split one stats payload without a second provider contract', () => {
  const stats = {
    home:{ possession:57, shots:9, shotsOnTarget:4, corners:5 },
    away:{ possession:43, shots:6, shotsOnTarget:2, corners:3 },
    momentum:[{ minute:1, home:55, away:45 }, { minute:20, home:62, away:38 }],
    shots:[{ side:'home', minute:18, player:'Кин', outcome:'saved', x:88, y:52, xg:0.126 }],
  };
  const state = {
    ...readyState('stats'),
    sections:{ overview:{}, stats, events:null, lineups:null, players:null },
    sectionState:{ overview:{status:'ready',error:''}, stats:{status:'ready',error:''}, events:{status:'idle',error:''}, lineups:{status:'idle',error:''}, players:{status:'idle',error:''} },
  };
  const base = renderMatchCenterView(state);
  const polishedStats = enhanceRound502MatchCenterView(base, state, { selectedShotIndex:null, selectedLineupTeam:'home', expandedLineupDisclosure:null });

  const statisticsHtml = enhanceRound503MatchCenterView(polishedStats, state, { activeViewTab:'stats', selectedShotIndex:null });
  assert.match(statisticsHtml, /data-cw250-mc-stats-primary/);
  assert.match(statisticsHtml, /data-cw250-mc-pressure/);
  assert.doesNotMatch(statisticsHtml, /data-cw233-mc-shotmap/);
  assert.doesNotMatch(statisticsHtml, /data-cw502-action="shot"/);

  const shotsHtml = enhanceRound503MatchCenterView(polishedStats, state, { activeViewTab:'shots', selectedShotIndex:null });
  assert.match(shotsHtml, /data-cw233-mc-shotmap/);
  assert.match(shotsHtml, /data-cw502-action="shot"/);
  assert.doesNotMatch(shotsHtml, /data-cw250-mc-stats-primary/);
  assert.doesNotMatch(shotsHtml, /data-cw250-mc-stats-secondary/);
  assert.doesNotMatch(shotsHtml, /data-cw250-mc-pressure/);
});

test('Round 50.3 drawer enhancer exposes a dedicated handle, inner scroll region and standard default', () => {
  const state = readyState();
  const html = enhanceRound503MatchCenterView(renderMatchCenterView(state), state, { activeViewTab:'overview' });
  assert.match(html, /data-cw503-drawer-shell/);
  assert.match(html, /data-cw503-drawer-handle/);
  assert.match(html, /data-cw503-drawer-scroll/);
  assert.match(html, /data-cw503-drawer-state="standard"/);
});

test('Round 50.3 drawer snap resolver supports compact standard expanded and deliberate compact dismissal', () => {
  assert.equal(resolveDrawerSnap(800, 624, 0), 'standard');
  assert.equal(resolveDrawerSnap(800, 624, -170), 'expanded');
  assert.equal(resolveDrawerSnap(800, 624, 250), 'compact');
  assert.equal(resolveDrawerSnap(800, 368, 120), 'close');
});

test('Round 50.3 canonical browser host is bottom anchored instead of an opaque fullscreen surface', () => {
  const documentRef = fakeDocument();
  const host = createBrowserMatchCenterHost(documentRef);
  assert.equal(host.node.style.bottom, '0');
  assert.equal(host.node.style.left, '0');
  assert.equal(host.node.style.right, '0');
  assert.notEqual(host.node.style.inset, '0');
  assert.equal(host.node.style.overflow, 'hidden');
  assert.equal(host.node.dataset.cw503DrawerState, 'standard');
});
