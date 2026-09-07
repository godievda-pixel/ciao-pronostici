import test from 'node:test';
import assert from 'node:assert/strict';
import { createPredictionsController } from '../src/predictions/controller.mjs';

function fixtureExternal() {
  return {
    competition: 'uel',
    prediction_stage_key: 'league-1',
    matches: [
      { matchId:'uel:123', stageKey:'league-1', stageLabel:'Общий этап · 1 тур', stageOrder:1, kickoffAt:'2026-09-10T18:00:00Z', status:'scheduled', open:true, prediction:null },
      { matchId:'uel:124', stageKey:'league-2', stageLabel:'Общий этап · 2 тур', stageOrder:2, kickoffAt:'2026-09-20T18:00:00Z', status:'scheduled', open:false, stage_locked:true, prediction:null },
    ],
  };
}

function harness() {
  const renders = [];
  const timers = [];
  const cleared = [];
  let loadCount = 0;
  const dataClient = {
    async loadExternalState() { loadCount += 1; return structuredClone(fixtureExternal()); },
    async saveExternalPredictions(_competition, items) { return { saved: items.length }; },
    async loadSerieAState(round) { return { ok:true, selected_round:round || 1, round:{ matches:[] } }; },
    async saveSerieAPredictions(_round, items) { return { saved: items.length }; },
  };
  const documentRef = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  };
  const controller = createPredictionsController({
    dataClient,
    render: snapshot => renders.push(snapshot),
    setTimer: (fn, ms) => { const id = { fn, ms }; timers.push(id); return id; },
    clearTimer: id => cleared.push(id),
    documentRef,
  });
  return { controller, renders, timers, cleared, get loadCount(){ return loadCount; } };
}

test('mode switch preserves competition and selected stage', async () => {
  const h = harness();
  h.controller.open();
  await h.controller.openCompetition('uel');
  h.controller.setStage('league-2');
  h.controller.setMode('mine');
  const state = h.controller.snapshot();
  assert.equal(state.competition, 'uel');
  assert.equal(state.stageKey, 'league-2');
  assert.equal(state.mode, 'mine');
});

test('refresh preserves unsaved external draft', async () => {
  const h = harness();
  h.controller.open();
  await h.controller.openCompetition('uel');
  h.controller.adjustScore('uel:123', 'h', 1);
  assert.equal(h.controller.snapshot().drafts.get('uel:123').h, 1);
  await h.controller.refresh();
  assert.equal(h.controller.snapshot().drafts.get('uel:123').h, 1);
});

test('only one refresh request may be in flight', async () => {
  let release;
  let calls = 0;
  const waiting = new Promise(resolve => { release = resolve; });
  const controller = createPredictionsController({
    dataClient: {
      async loadExternalState(){ calls += 1; if(calls > 1) await waiting; return fixtureExternal(); },
      async loadSerieAState(){ return { selected_round:1, round:{matches:[]} }; },
      async saveExternalPredictions(){ return {saved:0}; },
      async saveSerieAPredictions(){ return {saved:0}; },
    },
    render(){},
    setTimer(){ return 1; },
    clearTimer(){},
    documentRef:{ hidden:false, addEventListener(){}, removeEventListener(){} },
  });
  controller.open();
  await controller.openCompetition('uel');
  const first = controller.refresh();
  const second = controller.refresh();
  await Promise.resolve();
  assert.equal(calls, 2);
  release();
  await Promise.all([first, second]);
  assert.equal(calls, 2);
});

test('close cancels the 15 second timer', () => {
  const h = harness();
  h.controller.open();
  assert.equal(h.timers[0].ms, 15000);
  h.controller.close();
  assert.equal(h.cleared.length, 1);
  assert.equal(h.controller.isOpen(), false);
});

test('score adjustment clamps to zero through twenty', async () => {
  const h = harness();
  h.controller.open();
  await h.controller.openCompetition('uel');
  h.controller.adjustScore('uel:123', 'h', -10);
  assert.equal(h.controller.snapshot().drafts.get('uel:123').h, 0);
  for (let i=0;i<25;i++) h.controller.adjustScore('uel:123', 'h', 1);
  assert.equal(h.controller.snapshot().drafts.get('uel:123').h, 20);
});
