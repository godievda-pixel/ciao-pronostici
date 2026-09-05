import test from 'node:test';
import assert from 'node:assert/strict';

import { createMatchCenterStore } from '../src/v23.3/match-center-store.mjs';

function baseMatch() {
  return {
    competition:'serie_a',
    matchId:'serie_a:503',
    status:'live',
    homeTeam:{ id:'1', name:'Home' },
    awayTeam:{ id:'2', name:'Away' },
    coverage:{ overview:true, stats:true, events:true, lineups:true, players:true },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function createHarness() {
  let overviewCalls = 0;
  let refresh = null;
  const repository = {
    async base() { return { match:baseMatch() }; },
    async section(_competition, _matchId, section, options = {}) {
      if (section !== 'overview') return { available:true, data:{ section } };
      overviewCalls += 1;
      if (overviewCalls === 1) {
        return { available:true, data:{ revision:1, label:'stale-ready' } };
      }
      assert.equal(options.force, true);
      refresh = deferred();
      return refresh.promise;
    },
  };
  const store = createMatchCenterStore({
    repository,
    setTimer:() => 1,
    clearTimer:() => {},
    documentRef:{ hidden:false, addEventListener() {} },
  });
  return { store, getRefresh:() => refresh };
}

test('Round 50.3 forced section refresh keeps existing READY data visible while request is pending', async () => {
  const { store, getRefresh } = createHarness();
  await store.open({ competition:'serie_a', matchId:'serie_a:503' });

  const retryPromise = store.retrySection('overview');
  await Promise.resolve();

  const pending = store.getState();
  assert.deepEqual(pending.sections.overview, { revision:1, label:'stale-ready' });
  assert.equal(pending.sectionState.overview.status, 'ready');
  assert.equal(pending.sectionState.overview.error, '');

  getRefresh().resolve({ available:true, data:{ revision:2, label:'fresh-ready' } });
  await retryPromise;
  assert.deepEqual(store.getState().sections.overview, { revision:2, label:'fresh-ready' });
  assert.equal(store.getState().sectionState.overview.status, 'ready');
});

test('Round 50.3 failed background refresh preserves stale READY data and records a local error', async () => {
  const { store, getRefresh } = createHarness();
  await store.open({ competition:'serie_a', matchId:'serie_a:503' });

  const retryPromise = store.retrySection('overview');
  await Promise.resolve();
  getRefresh().reject(Object.assign(new Error('temporary_refresh_failure'), { code:'temporary_refresh_failure' }));
  await retryPromise;

  const state = store.getState();
  assert.deepEqual(state.sections.overview, { revision:1, label:'stale-ready' });
  assert.equal(state.sectionState.overview.status, 'ready');
  assert.equal(state.sectionState.overview.error, 'temporary_refresh_failure');
});
