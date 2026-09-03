import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEntryHtml, validateReleaseHtml } from '../scripts/build.mjs';

test('production entry keeps the stable v22.5 release route', () => {
  const entry = `<!doctype html><script>const target = new URL('/releases/v22-5.html', location.origin);</script>`;
  assert.equal(validateEntryHtml(entry), true);
});

test('production release requires the no-x2 marker and hides all legacy x2 surfaces', () => {
  const release = `<html><head><meta name="ciao-prod-patch" content="ciao-prod-no-x2-20260903"><style>#ciao-miniapp-root .cw18-x2{display:none!important}#ciao-miniapp-root .cw18-summary-bonus{display:none!important}#ciao-miniapp-root .cw18-rule.x2{display:none!important}</style><body>5 / 3 / 2 / 0 · дедлайн −15 минут</body></html>`;
  assert.equal(validateReleaseHtml(release), true);
});
