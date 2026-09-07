import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MULTITOURNAMENT_CARD_THEME_MARKER,
  multitournamentCardThemeSource,
  injectMultitournamentCardThemePatch,
} from '../scripts/multitournament-card-theme.mjs';

const source = () => multitournamentCardThemeSource();

test('external cards reuse Serie A scoreboard anatomy', () => {
  const s = source();
  assert.match(s, /scoreboard-top/);
  assert.match(s, /board-status/);
  assert.match(s, /board-kickoff/);
  assert.match(s, /scoreboard-main/);
  assert.match(s, /board-center cwmt-match-center/);
  assert.match(s, /board-caption/);
  assert.match(s, /Матч завершён/);
  assert.match(s, /Матч не начался/);
  assert.match(s, /финальный счёт/);
  assert.match(s, /ожидаем начало/);
});

test('external card top-right metadata uses device-local date and time', () => {
  const s = source();
  assert.match(s, /day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'/);
  assert.doesNotMatch(s, /timeZone:/);
  assert.match(s, /formatToParts/);
});

test('European league phase chips contain only round numbers', () => {
  const s = source();
  assert.match(s, /\^league-\(\\d\+\)\$/);
  assert.match(s, /return league\[1\]/);
  assert.doesNotMatch(s, /league\[1\]\+' тур'/);
});

test('selected tournament themes both the application background and match cards', () => {
  const s = source();
  for (const theme of ['serie-a','coppa','champions','europa','conference']) {
    assert.match(s, new RegExp(`data-cwmt-screen-theme="${theme}"`));
  }
  assert.match(s, /root\.setAttribute\('data-cwmt-screen-theme'/);
  assert.match(s, /#ciao-miniapp-root\[data-cwmt-screen-theme/);
  assert.match(s, /\.cwmt-match-card/);
  assert.match(s, /\.header/);
});

test('themed tournament header avoids mobile backdrop-filter repaint lag', () => {
  const s = source();
  assert.match(s, /\[data-cwmt-screen-theme\] \.header\{[^}]*backdrop-filter:none!important/);
  assert.match(s, /-webkit-backdrop-filter:none!important/);
});

test('patch injects once after the multitournament runtime and before final IIFE marker', () => {
  const html = '<html><script>\n(function(){\n/* ciao-prod-multitournament-matches-20260907 */\n  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script></html>';
  const once = injectMultitournamentCardThemePatch(html);
  const twice = injectMultitournamentCardThemePatch(once);
  assert.equal(once, twice);
  assert.match(once, new RegExp(MULTITOURNAMENT_CARD_THEME_MARKER));
  assert.ok(once.indexOf('ciao-prod-multitournament-matches-20260907') < once.indexOf(MULTITOURNAMENT_CARD_THEME_MARKER));
});