import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchCenterStore } from '../src/v23.3/match-center-store.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function base(competition, matchId, status = 'scheduled') {
  return {
    competition,
    matchId,
    status,
    minute:status === 'live' ? 22 : null,
    kickoffAt:'2026-09-10T19:00:00Z',
    homeTeam:{ id:'1', name:'Inter', crestUrl:'inter.png' },
    awayTeam:{ id:'2', name:'Milan', crestUrl:'milan.png' },
    score:{ home:status === 'live' ? 1 : null, away:status === 'live' ? 0 : null },
    venue:null,
    referee:null,
    coverage:{ overview:true, stats:true, events:true, lineups:true, players:true },
    updatedAt:null,
  };
}

function fakeDocument() {
  const listeners = new Map();
  return {
    hidden:false,
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatch(type) { listeners.get(type)?.(); },
  };
}

test('store reveals no match until canonical base is ready, then becomes stable ready state', async () => {
  const pending = deferred();
  const repository = {
    base:() => pending.promise,
    section:async () => ({ section:'overview', available:true, coverage:{}, data:{} }),
  };
  const store = createMatchCenterStore({ repository, documentRef:fakeDocument() });

  const opening = store.open({ competition:'serie_a', matchId:'serie_a:42' });
  const loading = store.getState();
  assert.equal(loading.open, true);
  assert.equal(loading.phase, 'loading-base');
  assert.equal(loading.match, null);
  assert.equal(loading.competition, 'serie_a');
  assert.equal(loading.matchId, 'serie_a:42');

  pending.resolve(base('serie_a', 'serie_a:42'));
  await opening;
  const ready = store.getState();
  assert.equal(ready.phase, 'ready');
  assert.equal(ready.match.matchId, 'serie_a:42');
  assert.equal(ready.activeTab, 'overview');
});

test('store lazy-loads sections and keeps section status independent from base state', async () => {
  const calls = [];
  const repository = {
    base:async () => base('ucl', 'ucl:77'),
    section:async (competition, matchId, section, options) => {
      calls.push({ competition, matchId, section, options });
      return { section, available:true, coverage:{ overview:true, stats:true, events:true, lineups:true, players:true }, data:{ section } };
    },
  };
  const store = createMatchCenterStore({ repository, documentRef:fakeDocument() });
  await store.open({ competition:'ucl', matchId:'ucl:77' });
  await store.setActiveTab('stats');

  const state = store.getState();
  assert.equal(state.activeTab, 'stats');
  assert.equal(state.sectionState.stats.status, 'ready');
  assert.deepEqual(state.sections.stats, { section:'stats' });
  assert.equal(state.phase, 'ready');
  assert.equal(calls.at(-1).section, 'stats');
  assert.deepEqual(calls.at(-1).options, { force:false, status:'scheduled' });
});

test('stale base response from Match A cannot overwrite newer Match B', async () => {
  const a = deferred();
  const b = deferred();
  const repository = {
    base:(_competition, matchId) => matchId === 'ucl:A' ? a.promise : b.promise,
    section:async () => ({ section:'overview', available:false, coverage:{}, data:null }),
  };
  const store = createMatchCenterStore({ repository, documentRef:fakeDocument() });

  const openingA = store.open({ competition:'ucl', matchId:'ucl:A' });
  const openingB = store.open({ competition:'ucl', matchId:'ucl:B' });
  b.resolve(base('ucl', 'ucl:B'));
  await openingB;
  a.resolve(base('ucl', 'ucl:A'));
  await openingA;

  assert.equal(store.getState().matchId, 'ucl:B');
  assert.equal(store.getState().match.matchId, 'ucl:B');
});

test('stale section response from previous match cannot overwrite current match section state', async () => {
  const oldStats = deferred();
  const repository = {
    base:async (competition, matchId) => base(competition, matchId),
    section:(_competition, matchId, section) => {
      if (matchId === 'ucl:A' && section === 'stats') return oldStats.promise;
      return Promise.resolve({ section, available:true, coverage:{}, data:{ owner:matchId } });
    },
  };
  const store = createMatchCenterStore({ repository, documentRef:fakeDocument() });
  await store.open({ competition:'ucl', matchId:'ucl:A' });
  const statsA = store.setActiveTab('stats');
  await store.open({ competition:'ucl', matchId:'ucl:B' });
  oldStats.resolve({ section:'stats', available:true, coverage:{}, data:{ owner:'ucl:A' } });
  await statsA;

  assert.equal(store.getState().matchId, 'ucl:B');
  assert.equal(store.getState().sections.stats, null);
});

test('live match schedules 15s refresh and closing cancels polling', async () => {
  const timers = [];
  const cleared = [];
  let baseCalls = 0;
  const repository = {
    base:async (_competition, _matchId, options) => {
      baseCalls += 1;
      if (baseCalls > 1) assert.equal(options.force, true);
      return base('ucl', 'ucl:77', 'live');
    },
    section:async (_competition, _matchId, section) => ({ section, available:true, coverage:{}, data:{ tick:baseCalls } }),
  };
  const store = createMatchCenterStore({
    repository,
    documentRef:fakeDocument(),
    setTimer:(fn, ms) => { const id = timers.length + 1; timers.push({ id, fn, ms }); return id; },
    clearTimer:id => cleared.push(id),
  });

  await store.open({ competition:'ucl', matchId:'ucl:77' });
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 15_000);

  await timers[0].fn();
  assert.equal(baseCalls, 2);
  assert.equal(timers.length, 2);

  store.close();
  assert.equal(store.getState().open, false);
  assert.equal(cleared.includes(timers[1].id), true);
});

test('finished match does not poll and hidden document pauses/resumes a live timer', async () => {
  const finishedTimers = [];
  const finishedStore = createMatchCenterStore({
    repository:{
      base:async () => base('serie_a', 'serie_a:1', 'finished'),
      section:async () => ({ section:'overview', available:false, coverage:{}, data:null }),
    },
    documentRef:fakeDocument(),
    setTimer:(fn, ms) => { finishedTimers.push({ fn, ms }); return finishedTimers.length; },
  });
  await finishedStore.open({ competition:'serie_a', matchId:'serie_a:1' });
  assert.equal(finishedTimers.length, 0);

  const documentRef = fakeDocument();
  const timers = [];
  const cleared = [];
  const liveStore = createMatchCenterStore({
    repository:{
      base:async () => base('uel', 'uel:2', 'live'),
      section:async () => ({ section:'overview', available:false, coverage:{}, data:null }),
    },
    documentRef,
    setTimer:(fn, ms) => { const id = timers.length + 1; timers.push({ id, fn, ms }); return id; },
    clearTimer:id => cleared.push(id),
  });
  await liveStore.open({ competition:'uel', matchId:'uel:2' });
  assert.equal(timers.length, 1);

  documentRef.hidden = true;
  documentRef.dispatch('visibilitychange');
  assert.equal(cleared.includes(1), true);

  documentRef.hidden = false;
  documentRef.dispatch('visibilitychange');
  assert.equal(timers.length, 2);
});

test('store subscription emits lifecycle changes and unsubscribe stops notifications', async () => {
  const store = createMatchCenterStore({
    repository:{
      base:async () => base('uecl', 'uecl:3'),
      section:async () => ({ section:'overview', available:false, coverage:{}, data:null }),
    },
    documentRef:fakeDocument(),
  });
  const phases = [];
  const unsubscribe = store.subscribe(state => phases.push(state.phase));
  await store.open({ competition:'uecl', matchId:'uecl:3' });
  unsubscribe();
  store.close();

  assert.equal(phases.includes('loading-base'), true);
  assert.equal(phases.includes('ready'), true);
  assert.equal(phases.at(-1), 'ready');
});
