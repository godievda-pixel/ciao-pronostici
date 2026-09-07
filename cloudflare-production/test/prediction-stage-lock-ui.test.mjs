import test from 'node:test';
import assert from 'node:assert/strict';
import {
  previousLeagueStageLabel,
  predictionStageLockUiSource,
  injectPredictionStageLockUiPatch,
  validatePredictionStageLockUiPatchedHtml,
} from '../scripts/prediction-stage-lock-ui.mjs';

const source=()=>predictionStageLockUiSource();

test('locked UEFA round unlock copy points to its immediately previous round',()=>{
  assert.equal(previousLeagueStageLabel('league-2'),'1-го тура');
  assert.equal(previousLeagueStageLabel('league-3'),'2-го тура');
  assert.equal(previousLeagueStageLabel('league-8'),'7-го тура');
});

test('runtime derives unlock copy from selected stage, not current provider stage',()=>{
  const s=source();
  assert.match(s,/__cwPredStageKey/);
  assert.match(s,/n-1/);
  assert.doesNotMatch(s,/prediction_stage_key/);
});

test('locked stage uses a CSS-drawn minimal lock instead of emoji',()=>{
  const s=source();
  assert.match(s,/cwpred-stage-locked::before/);
  assert.match(s,/cwpred-stage-locked::after/);
  assert.doesNotMatch(s,/🔒/);
});

test('patch injects after Home/Predictions routing fix',()=>{
  const html='<html><script>\n(function(){\n/* ciao-prod-home-predictions-nav-fix-20260907 */\n  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script></html>';
  const once=injectPredictionStageLockUiPatch(html);
  const twice=injectPredictionStageLockUiPatch(once);
  assert.equal(once,twice);
  assert.equal(validatePredictionStageLockUiPatchedHtml(once),true);
});
