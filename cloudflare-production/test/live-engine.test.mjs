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
