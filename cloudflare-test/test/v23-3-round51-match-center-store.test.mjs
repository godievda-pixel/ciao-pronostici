import test from 'node:test';
import assert from 'node:assert/strict';

import { createRound51MatchCenterStore } from '../src/v23.3/round51-match-center-store.mjs';

function baseState({ data = null, status = 'idle', error = '' } = {}) {
  return {
    open:true,
    phase:'ready',
    activeTab:'stats',
    sections:{ overview:{}, stats:data, events:null, lineups:null, players:null },
    sectionState:{
      overview:{ status:'ready', error:'' },
      stats:{ status, error },
      events:{ status:'idle', error:'' },
      lineups:{ status:'idle', error:'' },
      players:{ status:'idle', error:'' },
    },
  };
}

function fakeStableStore(initial) {
  let state = initial;
  const listeners = new Set();
  const calls = [];
  const emit = () => { for (const listener of listeners) listener(state); };
  return {
    calls,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getState() { return state; },
    transition(next) { state = next; emit(); },
    open(payload) { calls.push(['open', payload]); return Promise.resolve(state); },
    close() { calls.push(['close']); return state; },
    setActiveTab(tab) { calls.push(['tab', tab]); return Promise.resolve(state); },
    retryBase() { calls.push(['retry-base']); return Promise.resolve(state); },
    retrySection(tab) { calls.push(['retry-section', tab]); return Promise.resolve(state); },
    destroy() { calls.push(['destroy']); },
  };
}

test('Round 51 keeps stale stats renderable while the stable store reports loading', () => {
  const staleStats = Object.freeze({ home:{ shots:8 }, away:{ shots:4 } });
  const stable = fakeStableStore(baseState({ data:staleStats, status:'ready' }));
  const store = createRound51MatchCenterStore({ store:stable });
  const seen = [];
  store.subscribe(snapshot => seen.push(snapshot));

  stable.transition(baseState({ data:staleStats, status:'loading' }));

  assert.equal(store.getState().sectionState.stats.status, 'ready');
  assert.equal(store.getState().sections.stats, staleStats);
  assert.equal(seen.at(-1).sectionState.stats.status, 'ready');
  assert.equal(seen.at(-1).sections.stats, staleStats);
});

test('Round 51 preserves stale stats after a failed background refresh', () => {
  const staleStats = Object.freeze({ home:{ shots:8 }, away:{ shots:4 } });
  const stable = fakeStableStore(baseState({ data:staleStats, status:'ready' }));
  const store = createRound51MatchCenterStore({ store:stable });

  stable.transition(baseState({ data:staleStats, status:'error', error:'refresh_failed' }));
  const snapshot = store.getState();

  assert.equal(snapshot.sectionState.stats.status, 'ready');
  assert.equal(snapshot.sectionState.stats.error, 'refresh_failed');
  assert.equal(snapshot.sections.stats, staleStats);
});

test('Round 51 atomically exposes fresh data after a successful refresh', () => {
  const staleStats = Object.freeze({ home:{ shots:8 }, away:{ shots:4 } });
  const freshStats = Object.freeze({ home:{ shots:11 }, away:{ shots:6 } });
  const stable = fakeStableStore(baseState({ data:staleStats, status:'loading' }));
  const store = createRound51MatchCenterStore({ store:stable });

  assert.equal(store.getState().sections.stats, staleStats);
  assert.equal(store.getState().sectionState.stats.status, 'ready');

  stable.transition(baseState({ data:freshStats, status:'ready' }));
  assert.equal(store.getState().sections.stats, freshStats);
  assert.equal(store.getState().sectionState.stats.status, 'ready');
});

test('Round 51 leaves an initial error visible when there is no stale data', () => {
  const stable = fakeStableStore(baseState({ data:null, status:'error', error:'initial_failed' }));
  const store = createRound51MatchCenterStore({ store:stable });
  const snapshot = store.getState();

  assert.equal(snapshot.sectionState.stats.status, 'error');
  assert.equal(snapshot.sectionState.stats.error, 'initial_failed');
  assert.equal(snapshot.sections.stats, null);
});

test('Round 51 store adapter delegates actions without changing provider contracts', async () => {
  const stable = fakeStableStore(baseState({ data:{}, status:'ready' }));
  const store = createRound51MatchCenterStore({ store:stable });

  await store.open({ competition:'serie_a', matchId:'serie_a:9' });
  await store.setActiveTab('stats');
  await store.retrySection('stats');
  await store.retryBase();
  store.close();

  assert.deepEqual(stable.calls.map(call => call[0]), [
    'open', 'tab', 'retry-section', 'retry-base', 'close',
  ]);
  assert.equal(stable.calls[2][1], 'stats');
});
