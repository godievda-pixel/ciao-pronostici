import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { APP_THEME_TOKENS, APP_THEME_STYLE_ID } from '../src/v23.3/app-theme.mjs';

test('premium blue is the application base palette', () => {
  assert.equal(APP_THEME_TOKENS.primary, '#315CFF');
  assert.equal(APP_THEME_TOKENS.primary2, '#1937DF');
  assert.equal(APP_THEME_TOKENS.background, '#061128');
  assert.equal(APP_THEME_STYLE_ID, 'ciao-v233-app-theme');
});

test('shared theme owns all primary application surfaces', async () => {
  const source = await readFile(new URL('../src/v23.3/app-theme.mjs', import.meta.url), 'utf8');
  for (const selector of ['#ciao-miniapp-root','.cw233-prediction-page','.cw233-ranking-page','#ciao-v232-matches-overlay','#ciao-v233-tables-overlay']) {
    assert.match(source, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.match(source, /--cw-app-bg/);
  assert.match(source, /--cw-primary/);
});

test('v23.3 entry installs app theme before feature modules', async () => {
  const source = await readFile(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
  const themeAt = source.indexOf("./app-theme.mjs");
  const rankingAt = source.indexOf("./ranking-ui.mjs");
  assert.ok(themeAt >= 0 && themeAt < rankingAt);
});
