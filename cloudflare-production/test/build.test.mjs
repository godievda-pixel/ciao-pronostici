import test from 'node:test';
import assert from 'node:assert/strict';
import * as productionBuild from '../scripts/build.mjs';

const { validateReleaseHtml } = productionBuild;

test('production root serves the stable v22.5 release directly', () => {
  const entry = '<!doctype html><script>location.replace("/releases/v22-5.html")</script>';
  const release = '<!doctype html><html><head><meta name="ciao-build" content="ciao-web-v22-5-20260830"></head><body>app</body></html>';
  assert.equal(typeof productionBuild.rootHtmlFor, 'function');
  assert.equal(productionBuild.rootHtmlFor({ entry, release }), release);
});

test('production release accepts the real grouped no-x2 CSS patch', () => {
  const release = `<html><head><style id="ciao-prod-no-x2-20260903">
#ciao-miniapp-root .cw18-x2,
#ciao-miniapp-root .cw18-summary-bonus,
#ciao-miniapp-root .cw18-rule.x2{display:none!important}
#ciao-miniapp-root .cw18-rules-copy::after{content:'Дедлайн: прогноз на конкретный матч закрывается за 15 минут до начала.'}
#ciao-miniapp-root .cw18-rules-card .settings-row>div>div::after{content:'5 / 3 / 2 / 0 · дедлайн −15 минут'}
</style></head><body></body></html>`;
  assert.equal(validateReleaseHtml(release), true);
});
