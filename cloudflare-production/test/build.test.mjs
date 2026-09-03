import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEntryHtml, validateReleaseHtml } from '../scripts/build.mjs';

test('production entry keeps the stable v22.5 release route', () => {
  const entry = `<!doctype html><script>const target = new URL('/releases/v22-5.html', location.origin);</script>`;
  assert.equal(validateEntryHtml(entry), true);
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
