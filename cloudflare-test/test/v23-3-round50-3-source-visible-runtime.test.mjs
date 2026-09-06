import test from 'node:test';
import assert from 'node:assert/strict';

import { createCanonicalMatchCenterRuntime } from '../src/v23.3/match-center-runtime.mjs';

function harness() {
  let listener = null;
  let state = { open:false, phase:'closed', activeTab:'overview', sections:{}, sectionState:{} };
  const store = {
    subscribe(fn) { listener = fn; return () => {}; },
    getState() { return state; },
    async open() {
      state = { ...state, open:true, phase:'ready' };
      listener?.(state);
      return state;
    },
    close() {
      state = { ...state, open:false, phase:'closed' };
      listener?.(state);
      return state;
    },
    setActiveTab() { return state; },
  };
  const host = { bind(){}, render(){}, hide(){}, scrollToTop(){}, destroy(){} };
  const suspended = [];
  const restored = [];
  const runtime = createCanonicalMatchCenterRuntime({
    store,
    host,
    renderView:() => '<main></main>',
    enhanceView:html => html,
    suspendSource:value => suspended.push(value),
    restoreSource:value => restored.push(value),
    currentSource:() => ({ surface:'home' }),
    legacySourceLifecycle:false,
  });
  return { runtime, suspended, restored };
}

test('Round 50.3 keeps source page visible even when the canonical click router passes an explicit source', async () => {
  const { runtime, suspended, restored } = harness();
  const source = Object.freeze({
    surface:'matches',
    competition:'serie_a',
    navTab:'calendar',
    scrollTop:244,
    matchesOverlayScrollTop:81,
  });

  await runtime.open({ competition:'serie_a', matchId:'serie_a:901', source });
  assert.deepEqual(runtime.currentSource(), source);
  assert.deepEqual(suspended, []);

  runtime.back();
  assert.deepEqual(restored, []);
});
