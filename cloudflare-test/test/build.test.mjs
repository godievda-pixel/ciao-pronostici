import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyPatch, applyScheduleSourcePatch, applyLogoSourcePatch, BASE_BUILD, TEST_BUILD } from '../scripts/build.mjs';

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
});

test('schedule source patch renders nearest match directly from rawSchedule result', () => {
  const source = `
    const nearest = visible.length ? null : __cw231NearestMatch(rawSchedule);
    const body = visible.length
      ? \`<div class="cw231-today-list">\${visible.map(__cw231TodayCard).join('')}</div>\`
      : \`<div class="cw231-empty"><b>Сегодня матчей нет</b>\${nearest ? \`<div>Ближайший матч · \${esc(nearest.homeTeam?.name || '—')} — \${esc(nearest.awayTeam?.name || '—')} · \${__cw231Status(nearest)}</div>\` : ''}</div>\`;
  `;

  const patched = applyScheduleSourcePatch(source);

  assert.match(patched, /cw231-empty__next-card/);
  assert.match(patched, /nearest\.homeTeam/);
  assert.match(patched, /nearest\.awayTeam/);
  assert.match(patched, /__cw231Status\(nearest\)/);
  assert.match(patched, /Ближайший матч/);
  assert.doesNotMatch(patched, /Ближайший матч ·/);
});

test('legacy club logos are eager and synchronously decoded to avoid tab-switch pop-in', () => {
  const source = `const logo = t => t?.custom_emoji_id ? \`<img class="logo" loading="lazy" decoding="async" fetchpriority="low" src="\${API_BASE}?asset=emoji&id=\${encodeURIComponent(t.custom_emoji_id)}" alt="">\` : '<span class="logo">⚽</span>';`;
  const patched = applyLogoSourcePatch(source);

  assert.match(patched, /loading="eager"/);
  assert.match(patched, /decoding="sync"/);
  assert.match(patched, /fetchpriority="auto"/);
  assert.match(patched, /width="48" height="48"/);
  assert.doesNotMatch(patched, /loading="lazy"/);
  assert.doesNotMatch(patched, /decoding="async"/);
  assert.doesNotMatch(patched, /fetchpriority="low"/);
});

test('compact empty state has no forced minimum height or decorative filler', async () => {
  const [premiumCss, premiumJs] = await Promise.all([
    readFile(new URL('../src/ui-v23.1.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui-v23.1.js', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(premiumCss, /\.cw231-empty\{[^}]*min-height/s);
  assert.doesNotMatch(premiumJs, /Следующий матч уже на горизонте/);
  assert.doesNotMatch(premiumJs, /Дженоа|Комо/);
});
