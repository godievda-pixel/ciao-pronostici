import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('production root serves the accepted v22.5 shell directly', () => {
  const release = '<!doctype html><html><head><meta name="ciao-build" content="ciao-web-v22-5-20260830"></head><body>app</body></html>';
  assert.equal(typeof productionBuild.rootHtmlFor, 'function');
  assert.equal(productionBuild.rootHtmlFor({ release }), release);
});

test('production build uses the tracked app shell instead of remote release HTML', async () => {
  assert.equal(typeof productionBuild.loadAppShell, 'function');
  assert.equal('RELEASE_SOURCE_URL' in productionBuild, false);
  const shell = await productionBuild.loadAppShell();
  const tracked = await readFile(new URL('../src/app-shell.html', import.meta.url), 'utf8');
  assert.equal(shell, tracked);
  assert.match(shell, /ciao-prod-no-x2-20260903/);
});

test('native predictions build copies its browser import dependency', async () => {
  assert.equal(typeof productionBuild.copyPredictionsAssets, 'function');
  await productionBuild.copyPredictionsAssets();
  const dependency = await readFile(new URL('../dist/matches/competition-config.mjs', import.meta.url), 'utf8');
  assert.match(dependency, /coppa_italia/);
  assert.match(dependency, /ucl/);
  assert.match(dependency, /uel/);
  assert.match(dependency, /uecl/);
});

test('production release accepts the real grouped no-x2 CSS patch', () => {
  assert.equal(validateReleaseHtml(fixtureRelease()), true);
});

test('production preparation keeps accepted Matches layers and global 15s refresh only', () => {
  assert.equal(typeof productionBuild.prepareReleaseHtml, 'function');
  const prepared = productionBuild.prepareReleaseHtml(fixtureRelease());
  const order = [
    'ciao-prod-bsd-crests-20260907',
    'ciao-prod-multitournament-matches-20260907',
    'ciao-prod-multitournament-card-theme-20260907',
    'ciao-prod-global-refresh-15000-20260907',
  ];
  for (const marker of order) assert.match(prepared, new RegExp(marker));
  for (let i = 1; i < order.length; i++) assert.ok(prepared.indexOf(order[i - 1]) < prepared.indexOf(order[i]));
  assert.match(prepared, /sports\.bzzoiro\.com\/img\/team/);
  assert.match(prepared, /const __CW_REFRESH_MS=15000/);
  assert.match(prepared, /__cwRefreshVisibleNow/);

  const forbidden = [
    'ciao-prod-multitournament-predictions-20260907',
    'ciao-prod-multitournament-predictions-theme-20260907',
    'ciao-prod-home-predictions-nav-fix-20260907',
    'ciao-prod-prediction-stage-lock-ui-20260907',
    'ciao-prod-prediction-live-scroll-polish-20260907',
    'ciao-prod-prediction-mine-stage-polish-20260907',
  ];
  for (const marker of forbidden) assert.doesNotMatch(prepared, new RegExp(marker));
  assert.doesNotMatch(prepared, /__cwPred/);
  assert.doesNotMatch(prepared, /compat-v22-5-emoji\.mjs/);
});
