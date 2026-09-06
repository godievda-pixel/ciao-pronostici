import test from 'node:test';
import assert from 'node:assert/strict';
import { createModularApplication } from '../src/modular/app.mjs';

function harness() {
  let listener = null;
  const shown = [];
  let hidden = 0;
  const root = { addEventListener(){}, removeEventListener(){} };
  const adapter = {
    start(){ return true; }, stop(){}, root(){ return root; },
    showModular(){}, hideModular(){},
    showHomeCompanion(html){ shown.push(String(html)); },
    hideHomeCompanion(){ hidden += 1; },
  };
  const liveEngineFactory = ({ refresh }) => ({
    subscribe(fn){ listener = fn; return () => { listener = null; }; },
    async start(context){
      const data = await refresh(context);
      const snapshot = { running:true, context, data, error:null, updatedAt:1 };
      listener?.(snapshot);
      return snapshot;
    },
    stop(){},
    state(){ return { running:true }; },
  });
  const routeRenderer = async route => route.screen === 'home'
    ? '<section data-home-live="1">LAST GOOD</section>'
    : '<section></section>';
  const windowRef = {
    history:{ pushState(){}, replaceState(){}, back(){} }, scrollY:0,
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
    app, shown,
    hidden:() => hidden,
    emit(snapshot){ listener?.(snapshot); },
  };
}

test('Home keeps last good companion visible after a transient live refresh failure', async () => {
  const h = harness();
  h.app.start();
  await h.app.flush();
  assert.match(h.shown.at(-1), /LAST GOOD/);
  const hiddenBeforeFailure = h.hidden();

  h.emit({
    running:true,
    context:{ screen:'home' },
    data:'<section data-home-live="1">LAST GOOD</section>',
    error:new Error('temporary'),
    updatedAt:1,
  });

  assert.equal(h.hidden(), hiddenBeforeFailure);
  assert.match(h.shown.at(-1), /LAST GOOD/);
});
