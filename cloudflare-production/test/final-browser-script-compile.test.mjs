import test from 'node:test';
import assert from 'node:assert/strict';
import * as productionBuild from '../scripts/build.mjs';

function fixtureRelease() {
  return `<html><head><style id="ciao-prod-no-x2-20260903">
#ciao-miniapp-root .cw18-x2,
#ciao-miniapp-root .cw18-summary-bonus,
#ciao-miniapp-root .cw18-rule.x2{display:none!important}
#ciao-miniapp-root .cw18-rules-copy::after{content:'Дедлайн: прогноз на конкретный матч закрывается за 15 минут до начала.'}
#ciao-miniapp-root .cw18-rules-card .settings-row>div>div::after{content:'5 / 3 / 2 / 0 · дедлайн −15 минут'}
</style></head><body><script>
(function(){
  const app=true;
  /* ===== /Ciao, Web! v22.5 product polish layer ===== */

})();
</script></body></html>`;
}

test('production validates every generated classic browser script before writing dist', () => {
  assert.equal(typeof productionBuild.validateBrowserScripts, 'function');
  const prepared = productionBuild.prepareReleaseHtml(fixtureRelease());
  assert.equal(productionBuild.validateBrowserScripts(prepared), true);
});

test('browser script validation rejects a syntax error but ignores non-JavaScript data scripts', () => {
  assert.equal(typeof productionBuild.validateBrowserScripts, 'function');
  assert.throws(
    () => productionBuild.validateBrowserScripts('<script>const broken = ;</script>'),
    /browser script syntax invalid/i,
  );
  assert.equal(
    productionBuild.validateBrowserScripts('<script type="application/json">{"ok":true}</script>'),
    true,
  );
});
