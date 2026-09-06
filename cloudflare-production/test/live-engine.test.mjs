import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveEngine } from '../src/modular/core/live-engine.mjs';

function fakeTimers() {
  let nextId = 1;
  const queue = new Map();
  return {
    setTimer(fn, ms) { const id = nextId++; queue.set(id, { fn, ms }); return id; },
    clearTimer(id) { queue.delete(id); },
    pending() { return [...queue.entries()]; },
    async runNext() {
      const first = queue.entries().next().value;
      if (!first) return null;
      const [id, task] = first;
      queue.delete(id);
      await task.fn();
      return task.ms;
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('Live Engine owns one timer, refreshes, and stops cleanly', async () => {
  const timers = fakeTimers();
  let calls = 0;
  const engine = createLiveEngine({
    refresh: async context => ({ context, seq:++calls }),
    intervalMs:30000,
    retryMs:15000,
    setTimer:timers.setTimer,
    clearTimer:timers.clearTimer,
  });
  await engine.start({ screen:'calcio' });
  assert.equal(calls, 1);
  assert.equal(timers.pending().length, 1);
  assert.equal(timers.pending()[0][1].ms, 30000);
  await timers.runNext();
  assert.equal(calls, 2);
  assert.equal(timers.pending().length, 1);
  engine.stop();
  assert.equal(timers.pending().length, 0);
});

test('Live Engine retains last good data and uses retry delay after failure', async () => {
  const timers = fakeTimers();
  let calls = 0;
  const snapshots = [];
  const engine = createLiveEngine({
    refresh: async () => {
      calls += 1;
      if (calls === 2) throw new Error('temporary');
      return { score:calls };
    },
    intervalMs:30000,
    retryMs:15000,
    setTimer:timers.setTimer,
    clearTimer:timers.clearTimer,
  });
  engine.subscribe(state => snapshots.push(state));
  await engine.start({ screen:'match-center' });
  assert.deepEqual(engine.state().data, { score:1 });
  const delay = await timers.runNext();
  assert.equal(delay, 30000);
  assert.deepEqual(engine.state().data, { score:1 });
  assert.equal(engine.state().error.message, 'temporary');
  assert.equal(timers.pending()[0][1].ms, 15000);
  engine.stop();
  assert.ok(snapshots.length >= 2);
});

test('Live Engine clears prior-route data before emitting a new route context', async () => {
  const timers = fakeTimers();
  const second = deferred();
  let calls = 0;
  const snapshots = [];
  const engine = createLiveEngine({
    refresh: async context => {
      calls += 1;
      if (calls === 1) return { screen:context.screen, html:'HOME' };
      return second.promise;
    },
    setTimer:timers.setTimer,
    clearTimer:timers.clearTimer,
  });
  engine.subscribe(snapshot => snapshots.push(snapshot));

  await engine.start({ screen:'home' });
  assert.deepEqual(engine.state().data, { screen:'home', html:'HOME' });

  const pending = engine.start({ screen:'matches', tournament:'ucl' });
  const transition = snapshots.at(-1);
  assert.equal(transition.context.screen, 'matches');
  assert.equal(transition.context.tournament, 'ucl');
  assert.equal(transition.data, null);
  assert.equal(transition.updatedAt, null);

  second.resolve({ screen:'matches', tournament:'ucl', html:'UCL' });
  await pending;
  assert.equal(engine.state().data.html, 'UCL');
});
