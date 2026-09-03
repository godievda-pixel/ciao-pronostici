import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildSerieARoundNavModel,
  compactTableLabel,
} from '../src/v23.3/round13-mobile-regressions.mjs';

test('Serie A round navigation uses the full schedule and locks every future round', () => {
  const model = buildSerieARoundNavModel({
    currentRound:3,
    matches:[
      { round:3, matchId:'serie_a:301' },
      { round:4, matchId:'serie_a:401' },
      { round:5, matchId:'serie_a:501' },
      { round:5, matchId:'serie_a:502' },
    ],
  });

  assert.deepEqual(model.map(item => ({ round:item.round, active:item.active, locked:item.locked })), [
    { round:3, active:true, locked:false },
    { round:4, active:false, locked:true },
    { round:5, active:false, locked:true },
  ]);
  assert.equal(model[1].label, 'Тур 4 🔒');
});

test('Round 13 removes the CSS-generated second lock and keeps the markup lock only', async () => {
  const source = await readFile(new URL('../src/v23.3/round13-mobile-regressions.mjs', import.meta.url), 'utf8');
  assert.match(source, /data-cw233-pred-locked=['"]true['"]\]::after/);
  assert.match(source, /content:none!important/);
  assert.doesNotMatch(source, /content:\s*['"]\s*🔒['"]/);
});

test('Ranking loading overlay is neutral and never contains a fake participant identity', async () => {
  const source = await readFile(new URL('../src/v23.3/round13-mobile-regressions.mjs', import.meta.url), 'utf8');
  assert.match(source, /ciao-v233-round13-ranking-loading/);
  assert.match(source, /tab === 'table'/);
  const start = source.indexOf('function rankingLoadingHtml');
  const end = source.indexOf('\n}', start) + 2;
  const loading = source.slice(start, end);
  assert.doesNotMatch(loading, /Участник|место|очков/i);
});

test('Matches transition guard hides stale overlays synchronously on bottom-nav pointerdown', async () => {
  const source = await readFile(new URL('../src/v23.3/round13-mobile-regressions.mjs', import.meta.url), 'utf8');
  assert.match(source, /pointerdown/);
  assert.match(source, /ciao-v232-matches-overlay/);
  assert.match(source, /ciao-v233-match-center-overlay/);
  assert.match(source, /overlay\.hidden\s*=\s*true/);
  assert.doesNotMatch(source, /setTimeout\([^)]*overlay\.hidden/);
});

test('Tables compact UEFA labels fit the selector while preserving tournament content elsewhere', () => {
  assert.equal(compactTableLabel('serie_a'), 'Серия А');
  assert.equal(compactTableLabel('ucl'), 'ЛЧ');
  assert.equal(compactTableLabel('uel'), 'ЛЕ');
  assert.equal(compactTableLabel('uecl'), 'ЛК');
  assert.equal(compactTableLabel('coppa_italia'), 'КИ');
});

test('Round 13 runtime is loaded from the unified v23.3 entry point', async () => {
  const source = await readFile(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
  assert.match(source, /round13-mobile-regressions\.mjs/);
  assert.match(source, /round13MobileRegressions:\s*'enabled'/);
});
