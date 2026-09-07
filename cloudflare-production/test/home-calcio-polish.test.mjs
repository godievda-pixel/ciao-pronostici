import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOME_CALCIO_POLISH_MARKER,
  homeCalcioPolishRuntimeSource,
  injectHomeCalcioPolishPatch,
  validateHomeCalcioPolishPatchedHtml,
} from '../scripts/home-calcio-polish.mjs';

test('future prediction stages stay locked without any lock icon', () => {
  const runtime = homeCalcioPolishRuntimeSource();
  assert.match(runtime, /disabled aria-disabled="true" tabindex="-1"/);
  assert.match(runtime, /\.cwpred-stage-locked::before[^}]*display:none!important/);
  assert.match(runtime, /\.cwpred-stage-locked::after[^}]*display:none!important/);
  assert.doesNotMatch(runtime, /🔒|🔐/u);
});

test('missing mine prediction is compact score placeholder plus secondary copy', () => {
  const runtime = homeCalcioPolishRuntimeSource();
  assert.match(runtime, /ВАШ ПРОГНОЗ/);
  assert.match(runtime, /— : —/);
  assert.match(runtime, /cwpred-mine-missing/);
  assert.match(runtime, /Прогноз не сделан/);
});

test('home polish promotes profile card before favorite club and makes club CTA premium', () => {
  const runtime = homeCalcioPolishRuntimeSource();
  assert.match(runtime, /__cwHomePolishOrder/);
  assert.match(runtime, /cw-home-user-card/);
  assert.match(runtime, /cw211-home-shell/);
  assert.match(runtime, /cw211-profile-btn/);
  assert.match(runtime, /cw-home-profile-premium/);
});

test('favorite nearest match considers all competitions and renders opponent crest', () => {
  const runtime = homeCalcioPolishRuntimeSource();
  for (const key of ['coppa_italia', 'ucl', 'uel', 'uecl']) assert.match(runtime, new RegExp(`['\"]${key}['\"]`));
  assert.match(runtime, /__cwHomeNearestFavorite/);
  assert.match(runtime, /__cwHomeOpponentCrest/);
  assert.match(runtime, /data-cw-home-match/);
  assert.match(runtime, /data-cw-home-competition/);
});

test('Calcio today combines Serie A and all supported Italian-club competitions', () => {
  const runtime = homeCalcioPolishRuntimeSource();
  assert.match(runtime, /Кальчо сегодня/);
  assert.match(runtime, /__cwHomeCalcioTodayMatches/);
  assert.match(runtime, /__cw211TodayMatches/);
  assert.match(runtime, /isItalian/);
  assert.match(runtime, /cw-home-today-card/);
  assert.match(runtime, /cw-home-today-crest/);
});

test('patch injects once after the final prediction polish and validates its contract', () => {
  const base = `<!doctype html><html><body><script>/* ciao-prod-prediction-mine-stage-polish-20260907 */\n})();\n</script></body></html>`;
  const once = injectHomeCalcioPolishPatch(base);
  const twice = injectHomeCalcioPolishPatch(once);
  assert.equal(once, twice);
  assert.match(once, new RegExp(HOME_CALCIO_POLISH_MARKER));
  assert.equal(validateHomeCalcioPolishPatchedHtml(once), true);
});
