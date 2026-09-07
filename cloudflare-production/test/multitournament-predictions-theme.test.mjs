import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MULTITOURNAMENT_PREDICTIONS_THEME_MARKER,
  multitournamentPredictionsThemeSource,
  injectMultitournamentPredictionsThemePatch,
  validateMultitournamentPredictionsThemePatchedHtml,
} from '../scripts/multitournament-predictions-theme.mjs';

const source = () => multitournamentPredictionsThemeSource();

test('prediction theme contains all five approved tournament identities', () => {
  const s = source();
  for (const theme of ['serie-a','coppa','champions','europa','conference']) {
    assert.match(s, new RegExp(`data-cwpred-screen-theme="${theme}"`));
  }
});

test('prediction theme styles all center components with shared geometry', () => {
  const s = source();
  for (const cls of [
    '.cwpred-mode',
    '.cwpred-grid',
    '.cwpred-tournament-card',
    '.cwpred-cover',
    '.cwpred-rounds',
    '.cwpred-card',
    '.cwpred-score',
    '.cwpred-score-side',
    '.cwpred-save-state',
    '.cwpred-mine-prediction',
    '.cwpred-real-score',
    '.cwpred-points',
    '.cwpred-savebar',
    '.cwpred-state',
  ]) assert.match(s, new RegExp(cls.replace('.', '\\.')));
});

test('prediction mode switch is persistent and tournament header avoids mobile repaint blur', () => {
  const s = source();
  assert.match(s, /\.cwpred-mode\{[^}]*position:sticky/);
  assert.match(s, /\[data-cwpred-screen-theme\] \.header\{[^}]*backdrop-filter:none!important/);
  assert.match(s, /-webkit-backdrop-filter:none!important/);
});

test('mobile rules prevent page overflow while keeping stage and score controls usable', () => {
  const s = source();
  assert.match(s, /overflow-x:hidden/);
  assert.match(s, /\.cwpred-rounds\{[^}]*overflow-x:auto/);
  assert.match(s, /\.cwpred-score-side button\{[^}]*min-width:/);
  assert.match(s, /@media\(max-width:390px\)/);
  assert.match(s, /var\(--ciao-nav-h/);
  assert.match(s, /var\(--ciao-safe-bottom/);
});

test('prediction theme injects exactly once after prediction runtime', () => {
  const html = '<html><script>\n(function(){\n/* ciao-prod-multitournament-card-theme-20260907 */\n/* ciao-prod-multitournament-predictions-20260907 */\n  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script></html>';
  const once = injectMultitournamentPredictionsThemePatch(html);
  const twice = injectMultitournamentPredictionsThemePatch(once);
  assert.equal(once, twice);
  assert.equal(validateMultitournamentPredictionsThemePatchedHtml(once), true);
  assert.match(once, new RegExp(MULTITOURNAMENT_PREDICTIONS_THEME_MARKER));
  assert.ok(once.indexOf('ciao-prod-multitournament-predictions-20260907') < once.indexOf(MULTITOURNAMENT_PREDICTIONS_THEME_MARKER));
});
