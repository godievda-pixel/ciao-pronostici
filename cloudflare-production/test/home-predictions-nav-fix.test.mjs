import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOME_PREDICTIONS_NAV_FIX_MARKER,
  homePredictionsNavFixSource,
  injectHomePredictionsNavFixPatch,
  validateHomePredictionsNavFixPatchedHtml,
} from '../scripts/home-predictions-nav-fix.mjs';

const source=()=>homePredictionsNavFixSource();

test('bottom navigation restores Home and keeps Predictions as the second tab',()=>{
  const s=source();
  assert.match(s,/button\[data-tab="predict"\]/);
  assert.match(s,/button\[data-tab="mine"\]/);
  assert.match(s,/textContent='Главная'/);
  assert.match(s,/textContent='Прогнозы'/);
  assert.match(s,/predictions\.style\.display=''/);
  assert.doesNotMatch(s,/style\.display='none'/);
  assert.match(s,/classList\.toggle\('active',tab==='predict'\)/);
  assert.match(s,/classList\.toggle\('active',tab==='mine'\)/);
});

test('legacy Home renderer is restored and unified prediction center lives only on mine tab',()=>{
  const s=source();
  assert.match(s,/predict=function\(\)\{return __cwPredLegacyPredict\(\)\}/);
  assert.match(s,/mine=function\(\)\{return __cwPredCenterHtml\(\)\}/);
  assert.match(s,/if\(tab!=='mine'\)return false/);
  assert.match(s,/tab==='predict'/);
  assert.match(s,/__cwRefreshCurrentCoreScreen/);
});

test('prediction theme cannot leak onto Home',()=>{
  const s=source();
  assert.match(s,/tab==='mine'&&__cwPredCompetition/);
  assert.match(s,/removeAttribute\('data-cwpred-screen-theme'\)/);
});

test('nav fix patch injects once after global 15 second scheduler',()=>{
  const html='<html><script>\n(function(){\n/* ciao-prod-global-refresh-15000-20260907 */\n  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script></html>';
  const once=injectHomePredictionsNavFixPatch(html);
  const twice=injectHomePredictionsNavFixPatch(once);
  assert.equal(once,twice);
  assert.equal(validateHomePredictionsNavFixPatchedHtml(once),true);
  assert.match(once,new RegExp(HOME_PREDICTIONS_NAV_FIX_MARKER));
  assert.ok(once.indexOf('ciao-prod-global-refresh-15000-20260907')<once.indexOf(HOME_PREDICTIONS_NAV_FIX_MARKER));
});
