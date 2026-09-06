import test from 'node:test';
import assert from 'node:assert/strict';
import { createModularApplication } from '../src/modular/app.mjs';

function historyHarness() {
  const stack = [];
  let index = -1;
  return {
    get length(){ return stack.length; },
    pushState(state){ stack.splice(index + 1); stack.push(state); index = stack.length - 1; },
    replaceState(state){ if (index < 0) { stack.push(state); index = 0; } else stack[index] = state; },
    back(){ if (index > 0) index -= 1; },
  };
}

function appHarness() {
  const rootListeners = [];
  const windowListeners = [];
  const shown = [];
  const homeShown = [];
  const renderedRoutes = [];
  let hidden = 0;
  let navigateFromLegacy = null;
  const root = {
    addEventListener(type, listener, capture){ rootListeners.push({ type, listener, capture }); },
    removeEventListener(type, listener, capture){ const i=rootListeners.findIndex(x=>x.type===type&&x.listener===listener&&x.capture===capture); if(i>=0)rootListeners.splice(i,1); },
  };
  const adapter = {
    start(){ return true; },
    stop(){},
    root(){ return root; },
    host(){ return null; },
    showModular(html){ shown.push(String(html)); return {}; },
    hideModular(){ hidden += 1; return true; },
    showHomeCompanion(html){ homeShown.push(String(html)); return {}; },
  };
  const adapterFactory = options => { navigateFromLegacy = options.onNavigate; return adapter; };
  const windowRef = {
    history:historyHarness(), scrollY:0,
    addEventListener(type, listener){ windowListeners.push({ type, listener }); },
    removeEventListener(type, listener){ const i=windowListeners.findIndex(x=>x.type===type&&x.listener===listener); if(i>=0)windowListeners.splice(i,1); },
    scrollTo(){}, requestAnimationFrame(fn){ fn(); },
  };
  const routeRenderer = async route => {
    renderedRoutes.push({ ...route });
    return `<main data-screen="${route.screen}" data-subview="${route.subview||''}"></main>`;
  };
  const app = createModularApplication({
    documentRef:{ documentElement:{ dataset:{} } }, windowRef, dataService:{}, adapterFactory, routeRenderer,
  });
  return {
    app, shown, homeShown, renderedRoutes, rootListeners, windowListeners,
    navigate:screen=>navigateFromLegacy(screen), hidden:()=>hidden,
  };
}

test('modular app starts idempotently and owns only one root/popstate listener', () => {
  const h = appHarness();
  assert.equal(h.app.start(), true);
  assert.equal(h.app.start(), true);
  assert.equal(h.rootListeners.filter(x=>x.type==='click').length, 1);
  assert.equal(h.windowListeners.filter(x=>x.type==='popstate').length, 1);
  h.app.stop();
  assert.equal(h.rootListeners.length, 0);
  assert.equal(h.windowListeners.length, 0);
});

test('legacy migrated navigation is converted into router state and modular rendering', async () => {
  const h = appHarness();
  h.app.start();
  h.navigate('ranking');
  await h.app.flush();
  assert.equal(h.app.router().current().screen, 'ranking');
  assert.match(h.shown.at(-1), /data-screen="ranking"/);
});

test('stable v22.5 Home tab keeps legacy ownership while mounting the modular Home companion', async () => {
  const h = appHarness();
  h.app.start();
  h.navigate('ranking');
  await h.app.flush();
  assert.equal(h.app.router().current().screen, 'ranking');

  h.navigate('home');
  await h.app.flush();
  assert.equal(h.app.router().current().screen, 'home');
  assert.equal(h.hidden(), 1);
  assert.equal(h.renderedRoutes.at(-1).screen, 'home');
  assert.match(h.homeShown.at(-1), /data-screen="home"/);
  assert.doesNotMatch(h.shown.at(-1), /data-screen="home"/);
});

test('modular delegated clicks preserve inner prediction/ranking/tournament state', async () => {
  const h = appHarness();
  h.app.start();
  h.navigate('predictions');
  await h.app.flush();

  const predictionButton = { dataset:{ predictionMode:'mine' } };
  const target = { closest(selector){ return selector==='[data-prediction-mode]' ? predictionButton : null; } };
  const click = h.rootListeners.find(x=>x.type==='click').listener;
  click({ target, preventDefault(){} });
  await h.app.flush();
  assert.equal(h.app.router().current().screen, 'predictions');
  assert.equal(h.app.router().current().subview, 'mine');

  h.app.navigate({ screen:'tables', tournament:'uel' });
  await h.app.flush();
  assert.equal(h.app.router().current().tournament, 'uel');
});
