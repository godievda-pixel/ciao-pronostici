import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHomeRuntime } from '../src/v23.3/home-integration.mjs';
import { resolvePredictionDisplayName } from '../src/v23.3/predictions-ui.mjs';
import { compactTableLabel } from '../src/v23.3/round13-mobile-regressions.mjs';

test('Predictions never exposes generic participant copy while identity is unresolved', async () => {
  assert.equal(resolvePredictionDisplayName(null, null), '');
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /cw233-prediction-identity-loading/);
  assert.doesNotMatch(source, /:\s*'Участник'/);
});

test('Home owns the first visible frame before multi-competition hydration finishes', () => {
  const runtime = createHomeRuntime({
    loadMatches: async competition => ({ competition, matches:[] }),
    now:() => new Date('2026-09-03T10:00:00Z'),
  });
  const html = runtime.html();
  assert.match(html, /data-cw233-home/);
  assert.match(html, /cw233-home-bootstrap/);
  assert.match(html, /cw231-today/);
});

test('Serie A Predictions synchronization has no self-triggering document MutationObserver', async () => {
  const source = await readFile(new URL('../src/v23.3/round13-mobile-regressions.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /new MutationObserver/);
  assert.match(source, /data-cw233-filter/);
  assert.match(source, /syncSerieARounds/);
});

test('Matches Back clears stale tournament ambience before painting the hub', async () => {
  const source = await readFile(new URL('../src/v23.2/matches-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /clearMatchesAmbientTheme/);
  assert.match(source, /cw233Round10Theme/);
  assert.match(source, /delete\s+overlay\.dataset\.cw233Round10Theme/);
});

test('Tables use five compact tournament selectors and no narrow-phone fixed canvas', async () => {
  assert.equal(compactTableLabel('serie_a'), 'Серия А');
  assert.equal(compactTableLabel('ucl'), 'ЛЧ');
  assert.equal(compactTableLabel('uel'), 'ЛЕ');
  assert.equal(compactTableLabel('uecl'), 'ЛК');
  assert.equal(compactTableLabel('coppa_italia'), 'КИ');

  const round13 = await readFile(new URL('../src/v23.3/round13-mobile-regressions.mjs', import.meta.url), 'utf8');
  const round12 = await readFile(new URL('../src/v23.3/round12-stability-performance.mjs', import.meta.url), 'utf8');
  assert.match(round13, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(round12, /min-width:560px!important/);
  assert.doesNotMatch(round12, /width:560px!important/);
  assert.match(round12, /@media\(max-width:419px\)/);
  assert.match(round12, /cw233-standing-table\{min-width:0!important;width:100%!important/);
});
