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
  assert.match(s,/__cwRefreshStart\(\)/);
});

test('hub has no edit/mine switch and mode switch is embedded into a chosen tournament',()=>{
  const s=source();
  assert.match(s,/__cwPredHubHtml=function\(\)\{return '<section class="cwpred-hub">/);
  assert.match(s,/cwpred-tournament-controls/);
  assert.match(s,/__cwPredModeHtml\(\)\+__cwPredStageBarHtml\(\)/);
  assert.match(s,/__cwPredModeHtml\(\)\+\(typeof roundBar/);
});

test('future UEFA stages surface a visible sequential lock',()=>{
  const s=source();
  assert.match(s,/stage_locked/);
  assert.match(s,/prediction_stage_key/);
  assert.match(s,/cwpred-stage-locked/);
  assert.match(s,/cwpred-stage-lock-note/);
  assert.match(s,/Откроется после завершения/);
});

test('mine cards use symmetric team geometry and a separate result strip',()=>{
  const s=source();
  assert.match(s,/cwpred-mine-card--v2/);
  assert.match(s,/cwpred-mine-matchline/);
  assert.match(s,/cwpred-mine-primary/);
  assert.match(s,/cwpred-mine-result-strip/);
  assert.match(s,/grid-template-columns:minmax\(0,1fr\) 104px minmax\(0,1fr\)/);
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
