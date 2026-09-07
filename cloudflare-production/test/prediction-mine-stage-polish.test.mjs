import test from 'node:test';
import assert from 'node:assert/strict';
import {
  previousSelectedLeagueStageLabel,
  predictionMineStagePolishSource,
} from '../scripts/prediction-mine-stage-polish.mjs';

test('future UEFA stage copy refers to immediately previous selected stage',()=>{
  assert.equal(previousSelectedLeagueStageLabel('league-2'),'1-го тура');
  assert.equal(previousSelectedLeagueStageLabel('league-3'),'2-го тура');
  assert.equal(previousSelectedLeagueStageLabel('league-8'),'7-го тура');
});

test('locked stage chips are dimmed without visible lock glyphs',()=>{
  const s=predictionMineStagePolishSource();
  assert.match(s,/cwpred-stage-locked::before\{display:none!important\}/);
  assert.match(s,/cwpred-stage-locked::after\{display:none!important\}/);
  assert.match(s,/replace\(\/\[🔒🔐\]/);
});

test('missing prediction is compact and cannot overflow the center column',()=>{
  const s=predictionMineStagePolishSource();
  assert.match(s,/— : —/);
  assert.match(s,/cwpred-mine-missing/);
  assert.match(s,/overflow:hidden/);
  assert.match(s,/text-overflow:ellipsis/);
});
