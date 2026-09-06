import test from 'node:test';
import assert from 'node:assert/strict';
import { createModularApplication } from '../src/modular/app.mjs';

function input(value) {
  const attrs = new Map();
  return {
    value,
    setAttribute(name, next){ attrs.set(name, String(next)); },
    removeAttribute(name){ attrs.delete(name); },
  };
}

function harness({ savePredictions }) {
  const listeners = [];
  const root = {
    addEventListener(type, listener){ listeners.push({ type, listener }); },
    removeEventListener(){},
  };
  const adapter = {
    start(){ return true; }, stop(){}, root(){ return root; }, host(){ return null; },
    showModular(){ return {}; }, hideModular(){ return true; },
    showHomeCompanion(){ return {}; }, hideHomeCompanion(){ return true; },
  };
  const history = { pushState(){}, replaceState(){}, back(){} };
  const windowRef = {
    history, scrollY:0, addEventListener(){}, removeEventListener(){}, scrollTo(){}, requestAnimationFrame(fn){ fn(); },
  };
  const dataService = { savePredictions };
  const app = createModularApplication({
    documentRef:{ documentElement:{ dataset:{} } },
    windowRef,
    dataService,
    adapterFactory:()=>adapter,
    routeRenderer:async route=>`<main data-screen="${route.screen}"></main>`,
    liveEngineFactory:()=>({ subscribe(){ return ()=>{}; }, async start(){ return { data:'' }; }, stop(){}, state(){ return { running:false }; } }),
  });
  app.start();
  app.navigate({ screen:'predictions', subview:'predictions' });

  const homeInput = input('2');
  const awayInput = input('1');
  const feedback = { textContent:'' };
  const card = {
    dataset:{ predictionCompetition:'ucl', predictionMatchId:'ucl:601024', predictionRound:'' },
    querySelector(selector){
      if (selector === '[data-prediction-home]') return homeInput;
      if (selector === '[data-prediction-away]') return awayInput;
      if (selector === '[data-prediction-feedback]') return feedback;
      return null;
    },
  };
  const button = {
    closest(selector){
      if (selector === '[data-prediction-save]') return button;
      if (selector === '[data-prediction-card]') return card;
      return null;
    },
  };
  return { app, click:listeners.find(x=>x.type==='click').listener, button, feedback };
}

test('backend prediction save failure stays on the card and never escapes the click handler', async () => {
  const h = harness({ savePredictions:async()=>{ throw new Error('deadline_closed'); } });
  await h.app.flush();

  await assert.doesNotReject(() => h.click({ target:h.button, preventDefault(){} }));

  assert.equal(h.app.router().current().screen, 'predictions');
  assert.match(h.feedback.textContent, /Не удалось сохранить прогноз/);
  h.app.stop();
});
