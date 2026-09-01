import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPatch, BASE_BUILD, TEST_BUILD } from '../scripts/build.mjs';

const base = `<!doctype html><html><head><meta name="build" content="${BASE_BUILD}"></head><body><div id="ciao-miniapp-root"><div class="cw231-today-head"><h2>Сегодня в мире кальчо</h2></div><div class="cw231-prediction-tabs"><button>Сделать прогноз</button><button>Мои прогнозы</button></div></div></body></html>`;
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
