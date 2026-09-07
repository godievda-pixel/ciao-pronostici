import test from 'node:test';
import assert from 'node:assert/strict';
import * as productionBuild from '../scripts/build.mjs';

const { validateReleaseHtml } = productionBuild;

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

test('production root serves the stable v22.5 release directly', () => {
  const entry = '<!doctype html><script>location.replace("/releases/v22-5.html")</script>';
  const release = '<!doctype html><html><head><meta name="ciao-build" content="ciao-web-v22-5-20260830"></head><body>app</body></html>';
  assert.equal(typeof productionBuild.rootHtmlFor, 'function');
  assert.equal(productionBuild.rootHtmlFor({ entry, release }), release);
});

test('production release accepts the real grouped no-x2 CSS patch', () => {
  assert.equal(validateReleaseHtml(fixtureRelease()), true);
});

test('production preparation injects approved layers and restores Home after global scheduler', () => {
  assert.equal(typeof productionBuild.prepareReleaseHtml, 'function');
  const prepared = productionBuild.prepareReleaseHtml(fixtureRelease());
  const order = [
    'ciao-prod-bsd-crests-20260907',
    'ciao-prod-multitournament-matches-20260907',
    'ciao-prod-multitournament-card-theme-20260907',
    'ciao-prod-multitournament-predictions-20260907',
    'ciao-prod-multitournament-predictions-theme-20260907',
    'ciao-prod-global-refresh-15000-20260907',
    'ciao-prod-home-predictions-nav-fix-20260907',
  ];
  for (const marker of order) assert.match(prepared, new RegExp(marker));
  for (let i=1;i<order.length;i++) assert.ok(prepared.indexOf(order[i-1]) < prepared.indexOf(order[i]));
  assert.match(prepared, /sports\.bzzoiro\.com\/img\/team/);
  assert.match(prepared, /data-cwpred-mode="edit"/);
  assert.match(prepared, /data-cwpred-mode="mine"/);
  assert.match(prepared, /data-cwpred-screen-theme="champions"/);
  assert.match(prepared, /\.cwpred-mode/);
  assert.match(prepared, /const __CW_REFRESH_MS=15000/);
  assert.match(prepared, /__cwRefreshVisibleNow/);
  assert.match(prepared, /textContent='Главная'/);
  assert.match(prepared, /textContent='Прогнозы'/);
  assert.match(prepared, /predict=function\(\)\{return __cwPredLegacyPredict\(\)\}/);
  assert.match(prepared, /mine=function\(\)\{return __cwPredCenterHtml\(\)\}/);
  assert.match(prepared, /Рейтинг/);
  assert.match(prepared, /Таблицы/);
  assert.doesNotMatch(prepared, /compat-v22-5-emoji\.mjs/);

  const twice = productionBuild.prepareReleaseHtml(prepared);
  for (const marker of order) assert.equal((twice.match(new RegExp(marker,'g')) || []).length, 2);
});
