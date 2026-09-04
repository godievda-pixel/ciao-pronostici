import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const theme = readFileSync(new URL('../src/v23.3/legacy-match-center-theme.mjs', import.meta.url), 'utf8');
const matchesUi = readFileSync(new URL('../src/v23.2/matches-ui.mjs', import.meta.url), 'utf8');

test('Round 22 Serie A Match Center uses #0c5aa8 as the default competition theme', () => {
  assert.match(theme, /LEGACY_MATCH_CENTER_THEME_BUILD\s*=\s*'r28-match-center-fixes'/);
  assert.match(theme, /#ciao-miniapp-root\.match-center-open\s*\{[\s\S]*--cw233-mc-accent:#0c5aa8/i);
  assert.match(theme, /#ciao-miniapp-root\.match-center-open\s*\{[\s\S]*background:[^;]+var\(--cw233-mc-bg\)[^;]*!important/i);
});

test('Round 22 Coppa Italia reuses the red-green palette from the Matches screen', () => {
  assert.match(matchesUi, /rgba\(0,146,70,/);
  assert.match(matchesUi, /rgba\(206,43,55,/);
  assert.match(theme, /data-cw233-mc-competition="coppa_italia"[\s\S]*--cw233-mc-accent:#ce2b37/i);
  assert.match(theme, /data-cw233-mc-competition="coppa_italia"[\s\S]*--cw233-mc-accent-2:#009246/i);
});

test('Round 22 all Match Centers use one contained tab bar with competition-colored active tab', () => {
  assert.match(theme, /#ciao-miniapp-root\.match-center-open \.mc-tabs\s*\{[\s\S]*display:flex!important/i);
  assert.match(theme, /#ciao-miniapp-root\.match-center-open \.mc-tabs\s*\{[\s\S]*border:1px solid var\(--cw233-mc-border\)!important/i);
  assert.match(theme, /#ciao-miniapp-root\.match-center-open \.mc-tab\s*\{[\s\S]*flex:1 1 0!important/i);
  assert.match(theme, /#ciao-miniapp-root\.match-center-open \.mc-tab\s*\{[\s\S]*border:0!important/i);
  assert.match(theme, /#ciao-miniapp-root\.match-center-open \.mc-tab\.active\s*\{[\s\S]*linear-gradient\([^}]*var\(--cw233-mc-accent\)[^}]*var\(--cw233-mc-accent-2\)/i);
});

test('Round 22 predictions inherit the active competition palette instead of legacy blue', () => {
  for (const selector of ['.cw20-pred-summary', '.cw20-pred-score', '.mc-predsplit']) {
    assert.ok(theme.includes(`#ciao-miniapp-root.match-center-open ${selector}`), `${selector} must be competition-themed`);
  }
  assert.match(theme, /\.mc-predsplit-seg\.home[\s\S]*var\(--cw233-mc-accent\)/);
  assert.match(theme, /\.mc-predsplit-seg\.away[\s\S]*var\(--cw233-mc-accent-2\)/);
});
