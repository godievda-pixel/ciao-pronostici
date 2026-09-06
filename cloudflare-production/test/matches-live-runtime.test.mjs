import test from 'node:test';
import assert from 'node:assert/strict';
import { createModularApplication } from '../src/modular/app.mjs';

function historyHarness() {
  return { pushState(){}, replaceState(){}, back(){} };
}

function runtimeHarness() {
  const starts = [];
  let stops = 0;
  let listener = null;
  const root = { addEventListener(){}, removeEventListener(){} };
  const adapter = {
    start(){ return true; }, stop(){}, root(){ return root; },
    showModular(){}, hideModular(){}, showHomeCompanion(){}, hideHomeCompanion(){},
  };
  const routeRenderer = async route => `<main data-screen="${route.screen}" data-tournament="${route.tournament || ''}"></main>`;
  const liveEngineFactory = ({ refresh }) => ({
    subscribe(fn){ listener = fn; return () => { listener = null; }; },
    async start(context){
      starts.push({ ...context });
      const data = await refresh(context);
      const snapshot = { running:true, context, data, error:null, updatedAt:Date.now() };
      listener?.(snapshot);
      return snapshot;
    },
    stop(){ stops += 1; },
    state(){ return { running:starts.length > stops }; },
  });
  const windowRef = {
    history:historyHarness(), scrollY:0,
    addEventListener(){}, removeEventListener(){}, scrollTo(){}, requestAnimationFrame(fn){ fn(); },
  };
  const app = createModularApplication({
    documentRef:{ documentElement:{ dataset:{} } },
    windowRef,
    dataService:{},
    adapterFactory:() => adapter,
    routeRenderer,
    liveEngineFactory,
  });
  return { app, starts, stops:() => stops };
}

test('Matches tournament route starts the shared Live Engine instead of stopping polling', async () => {
  const h = runtimeHarness();
  h.app.start();
  await h.app.flush();

  h.app.navigate({ screen:'matches', tournament:'ucl' });
  await h.app.flush();

  assert.deepEqual(h.starts.map(route => [route.screen, route.tournament || '']), [
    ['home',''],
    ['matches','ucl'],
  ]);
  assert.equal(h.stops(), 0);
});
