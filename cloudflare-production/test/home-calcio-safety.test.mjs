import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOME_CALCIO_SAFETY_MARKER,
  homeCalcioSafetyRuntimeSource,
  injectHomeCalcioSafetyPatch,
  validateHomeCalcioSafetyPatchedHtml,
} from '../scripts/home-calcio-safety.mjs';

test('external home data respects refresh cooldown even after an empty or failed load', () => {
  const runtime = homeCalcioSafetyRuntimeSource();
  assert.match(runtime, /__cwHomeExternalLoadedAt/);
  assert.match(runtime, /age<15000/);
  assert.match(runtime, /if\(__cwHomeExternalLoadedAt&&age<15000\)return/);
  assert.doesNotMatch(runtime, /!__cwHomeExternalByCompetition\.size\|\|/);
});

test('safety patch is idempotent and follows home/calcio polish', () => {
  const base = `<!doctype html><html><body><script>/* ciao-prod-home-calcio-polish-20260908 */\n  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script></body></html>`;
  const once = injectHomeCalcioSafetyPatch(base);
  const twice = injectHomeCalcioSafetyPatch(once);
  assert.equal(once, twice);
  assert.match(once, new RegExp(HOME_CALCIO_SAFETY_MARKER));
  assert.equal(validateHomeCalcioSafetyPatchedHtml(once), true);
});
