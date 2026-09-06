import test from 'node:test';
import assert from 'node:assert/strict';
import { createModularApplication } from '../src/modular/app.mjs';

function historyHarness() {
  return { pushState(){}, replaceState(){}, back(){} };
}

function runtimeHarness() {
  const starts = [];
  const shown = [];
  let stops = 0;
  let listener = null;
  const root = { addEventListener(){}, removeEventListener(){} };
  const adapter = {
    start(){ return true; }, stop(){}, root(){ return root; },
    showModular(html){ shown.push(String(html)); }, hideModular(){}, showHomeCompanion(){}, hideHomeCompanion(){},
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
  return {
    app, starts, shown, stops:() => stops,
    emit(snapshot){ listener?.(snapshot); },
  };
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

test('current Matches tournament applies later Live Engine snapshots and ignores stale tournament snapshots', async () => {
  const h = runtimeHarness();
  h.app.start();
  await h.app.flush();
  h.app.navigate({ screen:'matches', tournament:'ucl' });
  await h.app.flush();

  h.emit({
    running:true,
    context:{ screen:'matches', tournament:'ucl' },
    data:'<main data-screen="matches" data-tournament="ucl" data-live-score="2-1"></main>',
    error:null,
    updatedAt:Date.now(),
  });
  assert.match(h.shown.at(-1), /data-live-score="2-1"/);

  h.emit({
    running:true,
    context:{ screen:'matches', tournament:'uel' },
    data:'<main data-screen="matches" data-tournament="uel" data-live-score="9-9"></main>',
    error:null,
    updatedAt:Date.now(),
  });
  assert.doesNotMatch(h.shown.at(-1), /9-9/);
});
