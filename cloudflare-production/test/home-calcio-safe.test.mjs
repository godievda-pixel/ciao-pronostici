import test from 'node:test';
import assert from 'node:assert/strict';
import {
  homeCalcioPolishRuntimeSourceSafe,
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

test('Home Calcio runtime immediately polishes the Home DOM that was rendered before this layer loads',()=>{
  const runtime=homeCalcioPolishRuntimeSourceSafe();
  const bindAt=runtime.indexOf('bind=function(){__cwHomePolishDom();__cwHomePolishBindBase();__cwHomeBindPolish()}');
  assert.ok(bindAt>=0,'patched bind wrapper must exist');
  const bootstrapAt=runtime.indexOf('try{__cwHomePolishDom();__cwHomeBindPolish()}catch(_e){}',bindAt+1);
  assert.ok(bootstrapAt>bindAt,'runtime must bootstrap the already-rendered Home DOM after installing the bind wrapper');
});
