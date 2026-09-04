import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createCanonicalMatchCenterRuntime,
} from '../src/v23.3/match-center-runtime.mjs';

function fakeStore() {
  let state = { open:false, phase:'closed', competition:'', matchId:'', match:null };
  const listeners = new Set();
  const calls = [];
  const emit = () => { for (const listener of listeners) listener(state); };
  return {
    calls,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getState() { return state; },
    async open(payload) {
      calls.push(['open', payload.competition, payload.matchId]);
      state = { ...state, open:true, phase:'loading-base', competition:payload.competition, matchId:payload.matchId };
      emit();
      return state;
    },
    close() { calls.push(['close']); state = { ...state, open:false, phase:'closed' }; emit(); return state; },
    async setActiveTab(tab) { calls.push(['tab', tab]); return state; },
    async retryBase() { calls.push(['retry-base']); return state; },
    async retrySection(tab) { calls.push(['retry-section', tab]); return state; },
  };
}

function fakeHost() {
  return {
    frames:[],
    hidden:true,
    render(html) { this.frames.push(html); this.hidden = false; },
    hide() { this.hidden = true; },
    scrollToTop() { this.scrolled = true; },
  };
}

test('hard cutover sends Serie A and UEFA through the exact same canonical Store path', async () => {
  const store = fakeStore();
  const host = fakeHost();
  const suspended = [];
  const restored = [];
  const runtime = createCanonicalMatchCenterRuntime({
    store,
    host,
    renderView:state => `view:${state.competition}:${state.phase}`,
    suspendSource:() => suspended.push('suspend'),
    restoreSource:source => restored.push(source),
    currentSource:() => ({ surface:'home', navTab:'predict', scrollTop:17 }),
  });

  await runtime.open({ competition:'serie_a', matchId:'serie_a:10' });
  runtime.back();
  await runtime.open({ competition:'ucl', matchId:'ucl:20' });
  runtime.back();

  assert.deepEqual(store.calls.filter(call => call[0] === 'open'), [
    ['open','serie_a','serie_a:10'],
    ['open','ucl','ucl:20'],
  ]);
  assert.equal(suspended.length, 2);
  assert.equal(restored.length, 2);
  assert.deepEqual(restored[0], { surface:'home', navTab:'predict', scrollTop:17 });
  assert.equal(host.hidden, true);
});

test('Back restores the exact captured source and tabs/retries stay inside the canonical Store', async () => {
  const store = fakeStore();
  const host = fakeHost();
  const restored = [];
  const source = { surface:'matches', competition:'uel', navTab:'calendar', scrollTop:88, matchesOverlayScrollTop:144 };
  const runtime = createCanonicalMatchCenterRuntime({
    store,
    host,
    renderView:state => `view:${state.phase}`,
    suspendSource:() => {},
    restoreSource:value => restored.push(value),
    currentSource:() => ({ surface:'home' }),
  });

  await runtime.open({ competition:'uel', matchId:'uel:7', source });
  await runtime.selectTab('stats');
  await runtime.retrySection('stats');
  await runtime.retryBase();
  runtime.back();

  assert.deepEqual(restored, [source]);
  assert.deepEqual(store.calls.slice(1), [
    ['tab','stats'],
    ['retry-section','stats'],
    ['retry-base'],
    ['close'],
  ]);
});

test('canonical link router targets Round 39 runtime and contains no legacy Match Center escape hatch', async () => {
  const [links, runtime] = await Promise.all([
    readFile(new URL('../src/v23.3/match-center-links.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/v23.3/match-center-runtime.mjs', import.meta.url), 'utf8'),
  ]);

  assert.match(links, /from '\.\/match-center-runtime\.mjs'/);
  assert.match(links, /CiaoV233MatchCenterLifecycle\?\.capture/);
  assert.doesNotMatch(links, /CiaoV233Round37|from '\.\/match-center\.mjs'/);

  assert.doesNotMatch(runtime, /openMatchCenter|matchCenterHtml|open-serie-a-match|external-legacy-match/i);
  assert.match(runtime, /createMatchCenterRepository/);
  assert.match(runtime, /createMatchCenterStore/);
  assert.match(runtime, /renderMatchCenterView/);
});
