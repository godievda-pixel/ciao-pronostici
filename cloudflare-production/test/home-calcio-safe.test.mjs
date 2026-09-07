import test from 'node:test';
import assert from 'node:assert/strict';
import {
  injectHomeCalcioPolishSafePatch,
  validateHomeCalcioPolishSafePatchedHtml,
} from '../scripts/home-calcio-polish-safe.mjs';

const LEGACY_FONT="font-family:'Unbounded','Manrope',sans-serif";

function fixtureWithLegacyCss(){
  return `<html><head><style>.legacy{${LEGACY_FONT}}</style></head><body><script>
(function(){
  /* ciao-prod-prediction-mine-stage-polish-20260907 */
  /* ===== /Ciao, Web! v22.5 product polish layer ===== */

})();
</script></body></html>`;
}

test('safe Home Calcio validator ignores legacy font literals outside its own runtime layer',()=>{
  const patched=injectHomeCalcioPolishSafePatch(fixtureWithLegacyCss());
  assert.match(patched,new RegExp(LEGACY_FONT.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotThrow(()=>validateHomeCalcioPolishSafePatchedHtml(patched));
});
