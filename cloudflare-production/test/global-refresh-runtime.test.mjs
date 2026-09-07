import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GLOBAL_REFRESH_MARKER,
  globalRefreshRuntimeSource,
  injectGlobalRefreshPatch,
  validateGlobalRefreshPatchedHtml,
} from '../scripts/global-refresh-runtime.mjs';

const source = () => globalRefreshRuntimeSource();

test('one visible-screen scheduler uses exactly the approved 15 second cadence', () => {
  const s = source();
  assert.match(s, /const __CW_REFRESH_MS=15000/);
  assert.match(s, /setInterval\([^\n]*__CW_REFRESH_MS/);
  assert.match(s, /document\.hidden/);
  assert.match(s, /visibilitychange/);
  assert.match(s, /__cwRefreshVisibleNow\(\)/);
  assert.match(s, /__cwRefreshBusy/);
  assert.match(s, /__cwRefreshSeq/);
  assert.match(s, /__cwRefreshScreenKey/);
});

test('native Predictions owns mine refresh while Home uses the core scheduler', () => {
  const s = source();
  assert.match(s, /tab==='mine'&&globalThis\.CiaoPredictionsScreen\?\.isOpen\?\.\(\)/);
  assert.match(s, /tab==='predict'\|\|tab==='table'\|\|tab==='seriea'\|\|tab==='profile'\|\|tab==='calendar'/);
  assert.doesNotMatch(s, /__cwPredRefreshVisible/);
  assert.doesNotMatch(s, /__cwPredCompetition/);
  assert.doesNotMatch(s, /__cwPredStageKey/);
  assert.match(s, /tab==='calendar'/);
  assert.match(s, /__cwMtRefreshVisible\(\{quiet:true\}\)/);
});

test('legacy network schedulers are neutralized before the global scheduler starts', () => {
  const s = source();
  for (const timer of ['__cw10PollTimer','__cw11SerieATimer','__cw2014Timer']) {
    assert.match(s, new RegExp(`clearTimeout\\(${timer}\\)`));
  }
  assert.match(s, /__cw10ScheduleNext=function/);
  assert.match(s, /__cw11ScheduleSerieA=function/);
  assert.match(s, /__cw2014Schedule=function/);
  assert.match(s, /__cw2014Wake=function/);
  assert.match(s, /__cwMtStopRefresh\(\)/);
  assert.match(s, /__cwMtStartRefresh=function/);
  assert.match(s, /async function __cwMtRefreshVisible/);
  assert.doesNotMatch(s, /30000/);
});

test('core state refresh preserves unsaved Serie A draft and current scroll', () => {
  const s = source();
  assert.match(s, /const keptDraft=new Map\(draft\)/);
  assert.match(s, /draft\.clear\(\);for\(const \[k,v\] of keptDraft\)draft\.set\(k,v\)/);
  assert.match(s, /const scrollTop=Number\(main\?\.scrollTop/);
  assert.match(s, /main\.scrollTop=scrollTop/);
  assert.doesNotMatch(s, /draft\.clear\(\)(?!;for\(const \[k,v\] of keptDraft\))/);
});

test('global refresh patch injects once after accepted Matches theme', () => {
  const html = '<html><script>\n(function(){\n/* ciao-prod-multitournament-card-theme-20260907 */\n  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script></html>';
  const once = injectGlobalRefreshPatch(html);
  const twice = injectGlobalRefreshPatch(once);
  assert.equal(once, twice);
  assert.equal(validateGlobalRefreshPatchedHtml(once), true);
  assert.match(once, new RegExp(GLOBAL_REFRESH_MARKER));
  assert.ok(once.indexOf('ciao-prod-multitournament-card-theme-20260907') < once.indexOf(GLOBAL_REFRESH_MARKER));
});
