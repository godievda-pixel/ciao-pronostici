import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const screensCssPath = path.resolve(here, '../src/v23/styles/screens.css');

const REQUIRED_SCREEN_SELECTORS = Object.freeze({
  predictions:[
    '.prediction-mode',
    '.prediction-filters',
    '.prediction-card',
    '.prediction-card__entry',
    '.prediction-card__save',
  ],
  ranking:[
    '.ranking-scopes',
    '.ranking-list',
    '.ranking-row',
    '.ranking-row--current',
  ],
  tables:[
    '.table-competitions',
    '.standings',
    '.standings-row',
    '.standings-row--head',
  ],
  matchCenter:[
    '.match-center__back',
    '.match-center__hero',
    '.match-center__tabs',
    '.match-center__facts',
    '.match-center__stat',
    '.match-center__event',
    '.match-center__lineups',
    '.match-center__player',
  ],
  settings:[
    '.settings-profile',
    '.settings-favorite',
    '.settings-toggle',
    '.settings-toggle__control',
    '.settings-readonly',
  ],
});

function exactCssBlock(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return '';
  const end = css.indexOf('}', start);
  return end === -1 ? '' : css.slice(start, end + 1);
}

test('every standalone v23 screen has a dedicated visual surface before Telegram smoke', async () => {
  const css = await fs.readFile(screensCssPath, 'utf8');
  for (const [screen, selectors] of Object.entries(REQUIRED_SCREEN_SELECTORS)) {
    for (const selector of selectors) {
      assert.ok(css.includes(selector), `${screen}: missing ${selector}`);
    }
  }
});

test('mobile-heavy standalone controls explicitly support horizontal tabs without page-level overflow', async () => {
  const css = await fs.readFile(screensCssPath, 'utf8');
  for (const selector of ['.prediction-filters','.match-center__tabs','.table-competitions']) {
    const block = exactCssBlock(css, selector);
    assert.notEqual(block, '', `missing exact ${selector} block`);
    assert.match(block, /overflow-x:\s*auto/, `${selector}: must scroll internally on narrow screens`);
  }
  assert.match(css, /\.standings-row\s*\{[^}]*grid-template-columns:/s, 'standings must own a compact grid instead of overflowing the page');
});
