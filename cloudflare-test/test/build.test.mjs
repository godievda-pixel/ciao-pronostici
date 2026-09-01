import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyPatch, BASE_BUILD, TEST_BUILD } from '../scripts/build.mjs';

const base = `<!doctype html><html><head><meta name="build" content="${BASE_BUILD}"></head><body><div id="ciao-miniapp-root"><div class="cw231-today-head"><h2>Сегодня в мире кальчо</h2></div><div class="cw231-prediction-tabs"><button>Сделать прогноз</button><button>Мои прогнозы</button></div><div class="cw231-filters"><button>Все</button><button>Серия A</button></div><div class="cw231-empty"><b>Сегодня матчей нет</b><div>Ближайший матч · Дженоа — Комо · 04.09 · 21:45</div></div></div></body></html>`;
const css = '.cw231-prediction-tabs{gap:8px}';
const js = `document.querySelector('h2').textContent='Кальчо сегодня';`;

test('injects GitHub TEST marker, CSS and JS exactly once', () => {
  const first = applyPatch(base, css, js);
  const second = applyPatch(first, css, js);
  assert.equal(first, second);
  assert.match(first, new RegExp(TEST_BUILD));
  assert.match(first, /ciao-web-github-test-patch/);
  assert.match(first, /gap:8px/);
  assert.match(first, /Кальчо сегодня/);
});

test('refuses an unexpected base release', () => {
  assert.throws(
    () => applyPatch(base.replace(BASE_BUILD, 'wrong-build'), css, js),
    /base build marker missing/,
  );
});

test('premium home sources define the approved today card and spacing', async () => {
  const [premiumCss, premiumJs] = await Promise.all([
    readFile(new URL('../src/ui-v23.1.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui-v23.1.js', import.meta.url), 'utf8'),
  ]);

  assert.match(premiumCss, /margin:\s*6px\s+0\s+16px/);
  assert.match(premiumCss, /\.cw231-today-premium/);
  assert.match(premiumCss, /radial-gradient/);
  assert.match(premiumCss, /\.cw231-today-subtitle/);
  assert.match(premiumCss, /\.cw231-empty__next-card/);
  assert.match(premiumCss, /\.cw231-empty__match/);

  assert.match(premiumJs, /Матчи и события дня/);
  assert.match(premiumJs, /cw231-today-premium/);
  assert.match(premiumJs, /cw231-empty__next-card/);
  assert.match(premiumJs, /Ближайший матч/);
});

test('compact empty state uses live nearest-match text without decorative icon or filler copy', async () => {
  const [premiumCss, premiumJs] = await Promise.all([
    readFile(new URL('../src/ui-v23.1.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui-v23.1.js', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(premiumJs, /cw231-empty__icon/);
  assert.doesNotMatch(premiumJs, /Следующий матч уже на горизонте/);
  assert.doesNotMatch(premiumJs, /Дженоа|Комо/);
  assert.match(premiumJs, /empty\.textContent/);
  assert.match(premiumJs, /cw231-empty__next-card/);
  assert.match(premiumCss, /min-height:\s*128px!important/);
  assert.match(premiumCss, /margin-top:\s*12px!important/);
});
