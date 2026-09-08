import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as productionBuild from '../scripts/build.mjs';
import { releaseRevision } from '../scripts/release-revision.mjs';

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

function assertInlineScriptsCompile(html) {
  const scripts = [...String(html).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  assert.ok(scripts.length > 0, 'expected at least one inline production script');
  for (const source of scripts) assert.doesNotThrow(() => new Function(source));
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

test('production preparation injects approved layers, Home/Calcio polish and parseable browser JS', () => {
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
    'ciao-prod-prediction-stage-lock-ui-20260907',
    'ciao-prod-prediction-live-scroll-polish-20260907',
    'ciao-prod-prediction-mine-stage-polish-20260907',
    'ciao-prod-home-calcio-polish-20260908',
    'ciao-prod-home-calcio-safety-20260908',
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
  assert.match(prepared, /__cwPredUxCurrentStageLabel/);
  assert.match(prepared, /cwpred-status--live/);
  assert.match(prepared, /#E7072E/i);
  assert.match(prepared, /getBoundingClientRect\(\)\.top/);
  assert.match(prepared, /window\.scrollBy/);
  assert.match(prepared, /__cwPredMineStagePreviousLabel/);

  // Requested prediction behavior.
  assert.match(prepared, /disabled aria-disabled="true" tabindex="-1"/);
  assert.match(prepared, /cwpred-stage-locked::before[^}]*display:none!important/);
  assert.match(prepared, /cwpred-stage-locked::after[^}]*display:none!important/);
  assert.match(prepared, /— : —/);
  assert.match(prepared, /cwpred-mine-missing/);
  assert.match(prepared, /Прогноз не сделан/);

  // Requested Home behavior.
  assert.match(prepared, /__cwHomePolishOrder/);
  assert.match(prepared, /cw-home-user-card/);
  assert.match(prepared, /cw-home-profile-premium/);
  assert.match(prepared, /__cwHomeNearestFavorite/);
  assert.match(prepared, /__cwHomeOpponentCrest/);
  assert.match(prepared, /data-cw-home-match/);
  assert.match(prepared, /Кальчо сегодня/);
  assert.match(prepared, /__cwHomeCalcioTodayMatches/);
  assert.match(prepared, /cw-home-today-card/);
  for (const competition of ['coppa_italia','ucl','uel','uecl']) assert.match(prepared, new RegExp(competition));

  // Regression gate for the startup failure from b05e1bb5.
  assertInlineScriptsCompile(prepared);
  assert.doesNotMatch(prepared, /font-family:'Unbounded','Manrope',sans-serif/);
  assert.match(prepared, /font-family:"Unbounded","Manrope",sans-serif/);
  assert.doesNotMatch(prepared, /compat-v22-5-emoji\.mjs/);

  const twice = productionBuild.prepareReleaseHtml(prepared);
  for (const marker of order) assert.equal((twice.match(new RegExp(marker,'g')) || []).length, 2);
  assertInlineScriptsCompile(twice);
});

test('production output writes revision for the exact index.html bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ciao-release-'));
  try {
    const rootHtml = '<!doctype html><html><body>release</body></html>';
    const release = rootHtml;
    const result = await productionBuild.writeBuildOutputs({ outputDir: dir, rootHtml, release });
    const index = await readFile(join(dir, 'index.html'));
    const revisionFile = await readFile(join(dir, 'release-revision.txt'), 'utf8');
    const expected = releaseRevision(index);
    assert.equal(revisionFile, `${expected}\n`);
    assert.equal(result.revision, expected);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
