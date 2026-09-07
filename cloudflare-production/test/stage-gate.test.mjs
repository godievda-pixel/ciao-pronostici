import test from 'node:test';
import assert from 'node:assert/strict';
import { predictionStageGate, isFuturePredictionStageLocked } from '../../supabase/functions/ciao-external-predictions/stage-gate.mjs';

const row=(key,order,status='scheduled')=>({stage_key:key,stage_order:order,status});

test('UEFA opens only first unfinished league stage',()=>{
  const rows=[row('league-1',101,'finished'),row('league-1',101,'finished'),row('league-2',102,'scheduled'),row('league-3',103,'scheduled')];
  const gate=predictionStageGate('ucl',rows);
  assert.equal(gate.currentStageKey,'league-2');
  assert.equal(gate.currentStageOrder,102);
  assert.equal(isFuturePredictionStageLocked('ucl',rows[1],gate),false);
  assert.equal(isFuturePredictionStageLocked('ucl',rows[2],gate),false);
  assert.equal(isFuturePredictionStageLocked('ucl',rows[3],gate),true);
});

test('current stage remains current until every match is finished',()=>{
  const rows=[row('league-1',101,'finished'),row('league-1',101,'postponed'),row('league-2',102,'scheduled')];
  const gate=predictionStageGate('uel',rows);
  assert.equal(gate.currentStageKey,'league-1');
  assert.equal(isFuturePredictionStageLocked('uel',rows[2],gate),true);
});

test('UECL non-league playoff rows do not block league gating',()=>{
  const rows=[row('playoff',250,'finished'),row('league-1',101,'scheduled'),row('league-2',102,'scheduled')];
  const gate=predictionStageGate('uecl',rows);
  assert.equal(gate.currentStageKey,'league-1');
  assert.equal(isFuturePredictionStageLocked('uecl',rows[2],gate),true);
});

test('Coppa is not stage-gated by UEFA rule',()=>{
  const rows=[row('r32',300,'scheduled'),row('r16',400,'scheduled')];
  const gate=predictionStageGate('coppa_italia',rows);
  assert.equal(gate.currentStageKey,null);
  assert.equal(isFuturePredictionStageLocked('coppa_italia',rows[1],gate),false);
});
