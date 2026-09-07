import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREDICTION_LIVE_SCROLL_POLISH_MARKER,
  predictionLiveScrollPolishSource,
  injectPredictionLiveScrollPolishPatch,
  validatePredictionLiveScrollPolishPatchedHtml,
} from '../scripts/prediction-live-scroll-polish.mjs';

test('LIVE status gets a dedicated red visual class',()=>{
  const s=predictionLiveScrollPolishSource();
  assert.match(s,/startsWith\('LIVE'\)/);
  assert.match(s,/cwpred-status--live/);
  assert.match(s,/#E7072E/i);
});

test('prediction refresh preserves the visible card viewport anchor',()=>{
  const s=predictionLiveScrollPolishSource();
  assert.match(s,/getBoundingClientRect\(\)\.top/);
  assert.match(s,/window\.scrollY/);
  assert.match(s,/window\.scrollBy/);
  assert.match(s,/main\?\.scrollTop/);
  assert.match(s,/requestAnimationFrame/);
});

test('polish wraps prediction refresh without changing 15 second cadence',()=>{
  const s=predictionLiveScrollPolishSource();
  assert.match(s,/__cwPredRefreshVisible=async function/);
  assert.doesNotMatch(s,/setInterval/);
  assert.doesNotMatch(s,/30000/);
});

test('patch injects once after stage-lock UI',()=>{
  const html='<html><script>\n(function(){\n/* ciao-prod-prediction-stage-lock-ui-20260907 */\n  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script></html>';
  const once=injectPredictionLiveScrollPolishPatch(html);
  const twice=injectPredictionLiveScrollPolishPatch(once);
  assert.equal(once,twice);
  assert.equal(validatePredictionLiveScrollPolishPatchedHtml(once),true);
  assert.match(once,new RegExp(PREDICTION_LIVE_SCROLL_POLISH_MARKER));
});
