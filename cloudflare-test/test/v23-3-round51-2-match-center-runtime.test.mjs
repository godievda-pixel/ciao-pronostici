import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ROUND512_RUNTIME_BUILD,
  createRound512MatchCenterRuntime,
} from '../src/v23.3/round51-2-match-center-runtime.mjs';

function makeStore() {
  let state = {
    open:false,
    phase:'closed',
    activeTab:'overview',
    match:{ homeTeam:{ name:'Рома' }, awayTeam:{ name:'Аталанта' } },
    sections:{
      overview:{},
      stats:{ shots:[{ player:'Paulo Dybala', xg:0.31 }] },
      events:[],
      lineups:{ home:{ starters:[], substitutes:[] }, away:{ starters:[], substitutes:[] } },
    },
    sectionState:{ overview:{ status:'ready' }, stats:{ status:'ready' }, events:{ status:'ready' }, lineups:{ status:'ready' } },
  };
  const listeners = new Set();
  const calls = { open:[], tabs:[], close:0, retryBase:0, retrySection:[] };
  const emit = () => listeners.forEach(listener => listener(state));
  return {
    calls,
    getState:() => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    open(payload) {
      calls.open.push(payload);
      state = { ...state, open:true, phase:'ready', activeTab:'overview' };
      emit();
      return Promise.resolve(state);
    },
    close() {
      calls.close += 1;
      state = { ...state, open:false, phase:'closed' };
      emit();
      return state;
    },
    setActiveTab(tab) {
      calls.tabs.push(tab);
      state = { ...state, activeTab:tab };
      emit();
      return Promise.resolve(state);
    },
    retryBase() { calls.retryBase += 1; return Promise.resolve(state); },
    retrySection(tab) { calls.retrySection.push(tab); return Promise.resolve(state); },
  };
}

function makeHost() {
  const calls = { renders:[], hide:0, snaps:[], scrollTop:0 };
  return {
    calls,
    bind(runtime) { this.runtime = runtime; },
    render(html) { calls.renders.push(html); },
    hide() { calls.hide += 1; },
    setSnap(snap) { calls.snaps.push(snap); },
    scrollToTop() { calls.scrollTop += 1; },
    destroy() {},
  };
}

const renderView = state => `<main>provider:${state.activeTab}</main>`;
const enhanceLegacy = html => html;
const enhanceUser = (html, state, viewState) => `${html}<i>user:${viewState.activeUserView}</i>`;

test('Round 51.2 runtime keeps source alive and opens the drawer at standard snap', async () => {
  const store = makeStore();
  const host = makeHost();
  const source = { surface:'matches', hidden:false, scrollTop:412 };
  const runtime = createRound512MatchCenterRuntime({ store, host, renderView, enhanceLegacy, enhanceUser });

  await runtime.open({ competition:'serie_a', matchId:'serie_a:901', source });

  assert.equal(ROUND512_RUNTIME_BUILD, 'round51-2-bottom-drawer');
  assert.equal(source.hidden, false);
  assert.equal(source.scrollTop, 412);
  assert.deepEqual(host.calls.snaps, ['standard']);
  assert.equal(host.calls.scrollTop, 1);
  assert.equal(store.calls.open.length, 1);
  assert.equal('source' in store.calls.open[0], false);
  assert.equal(runtime.currentSource(), source);

  runtime.back();
  assert.equal(source.hidden, false);
  assert.equal(source.scrollTop, 412);
  assert.equal(store.calls.close, 1);
  assert.equal(runtime.currentSource(), null);
});

test('Round 51.2 switches Statistics to Shots locally without loading stats twice', async () => {
  const store = makeStore();
  const host = makeHost();
  const runtime = createRound512MatchCenterRuntime({ store, host, renderView, enhanceLegacy, enhanceUser });
  await runtime.open({ competition:'serie_a', matchId:'serie_a:901' });

  await runtime.selectUserView('statistics');
  assert.deepEqual(store.calls.tabs, ['stats']);
  assert.equal(runtime.currentViewState().activeUserView, 'statistics');

  const rendersBeforeShots = host.calls.renders.length;
  await runtime.selectUserView('shots');
  assert.deepEqual(store.calls.tabs, ['stats']);
  assert.equal(runtime.currentViewState().activeUserView, 'shots');
  assert.ok(host.calls.renders.length > rendersBeforeShots);
  assert.match(host.calls.renders.at(-1), /provider:stats/);
  assert.match(host.calls.renders.at(-1), /user:shots/);
});

test('Round 51.2 runtime has no legacy source lifecycle ownership', async () => {
  const source = await readFile(new URL('../src/v23.3/round51-2-match-center-runtime.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /match-center-lifecycle/);
  assert.doesNotMatch(source, /suspendMatchSource|restoreMatchSource|suspendSource|restoreSource/);
});
