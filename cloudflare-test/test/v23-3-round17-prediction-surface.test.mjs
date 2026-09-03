import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source() {
  return readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
}

test('Round 17 Predictions derive one native theme from the selected tournament', async () => {
  const mod = await import('../src/v23.3/predictions-ui.mjs');
  assert.equal(mod.predictionThemeFor('serie_a'), 'serie-a');
  assert.equal(mod.predictionThemeFor('coppa_italia'), 'coppa');
  assert.equal(mod.predictionThemeFor('ucl'), 'champions');
  assert.equal(mod.predictionThemeFor('uel'), 'europa');
  assert.equal(mod.predictionThemeFor('uecl'), 'conference');
});

test('Round 17 Predictions reconcile keyed match cards instead of replacing the whole body on every refresh', async () => {
  const code = await source();
  assert.match(code, /function reconcilePredictionBody\(/);
  assert.match(code, /data-cw233-pred-card/);
  assert.match(code, /Map\(/);
  assert.doesNotMatch(code, /setHtmlIfChanged\(body,\s*bodyHtml\)/);
});

test('Round 17 Predictions preserve scroll and focus around structural reconciliation', async () => {
  const code = await source();
  assert.match(code, /scrollTop/);
  assert.match(code, /filterScrollLeft|filtersScrollLeft/);
  assert.match(code, /navScrollLeft|roundScrollLeft/);
  assert.match(code, /activeElement/);
  assert.match(code, /\.focus\?\.\(\{[^}]*preventScroll\s*:\s*true[^}]*\}\)|\.focus\(\{[^}]*preventScroll\s*:\s*true[^}]*\}\)/);
});

test('Round 17 Predictions keep draft editing and locking logic independent from rendering reconciliation', async () => {
  const code = await source();
  assert.match(code, /drafts\.set/);
  assert.match(code, /prediction_round_locked/);
  assert.match(code, /prediction_locked/);
  assert.match(code, /updatePredictionCard\(card, match\)/);
});
