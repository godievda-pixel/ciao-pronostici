import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as runtime from '../src/v23.3/round16-runtime.mjs';
import * as profileUi from '../src/v23.3/profile-rating-ui.mjs';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('Round 16 Matches hub handoff is immediate and has no animated background exposure', async () => {
  const runtimeSource = await source('../src/v23.3/round16-runtime.mjs');
  assert.match(runtimeSource, /#ciao-v232-matches-overlay\{transition:none!important;/);
  assert.doesNotMatch(runtimeSource, /transition\s*:\s*background/i);
  assert.match(runtimeSource, /data-cw232-action=\\"hub\\"/);
});

test('Round 16 Ranking uses compact selector labels and full tournament section titles', () => {
  assert.equal(runtime.rankingSelectorLabel('overall'), 'Общий');
  assert.equal(runtime.rankingSelectorLabel('serie_a'), 'Серия А');
  assert.equal(runtime.rankingSelectorLabel('coppa_italia'), 'КИ');
  assert.equal(runtime.rankingSelectorLabel('ucl'), 'ЛЧ');
  assert.equal(runtime.rankingSelectorLabel('uel'), 'ЛЕ');
  assert.equal(runtime.rankingSelectorLabel('uecl'), 'ЛК');

  assert.equal(runtime.rankingSectionTitle('overall'), 'Общий рейтинг');
  assert.equal(runtime.rankingSectionTitle('serie_a'), 'Серия А');
  assert.equal(runtime.rankingSectionTitle('coppa_italia'), 'Кубок Италии');
  assert.equal(runtime.rankingSectionTitle('ucl'), 'Лига Чемпионов');
  assert.equal(runtime.rankingSectionTitle('uel'), 'Лига Европы');
  assert.equal(runtime.rankingSectionTitle('uecl'), 'Лига Конференций');
});

test('Round 16 Ranking filters fit in one stable six-column row', async () => {
  const sourceText = await source('../src/v23.3/round16-runtime.mjs');
  assert.match(sourceText, /cw233-ranking-filters[^}]*display:grid[^}]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/s);
  assert.match(sourceText, /overflow:hidden/);
});

test('Round 16 Tables use compact selector labels and full section titles', () => {
  assert.equal(runtime.tableSelectorLabel('serie_a'), 'Серия А');
  assert.equal(runtime.tableSelectorLabel('coppa_italia'), 'КИ');
  assert.equal(runtime.tableSelectorLabel('ucl'), 'ЛЧ');
  assert.equal(runtime.tableSelectorLabel('uel'), 'ЛЕ');
  assert.equal(runtime.tableSelectorLabel('uecl'), 'ЛК');
  assert.equal(runtime.tableSectionTitle('ucl'), 'Лига Чемпионов');
  assert.equal(runtime.tableSectionTitle('uel'), 'Лига Европы');
  assert.equal(runtime.tableSectionTitle('uecl'), 'Лига Конференций');
  assert.equal(runtime.tableSectionTitle('coppa_italia'), 'Кубок Италии');
});

test('Round 16 Tables has no selector horizontal scroll and owns pointerdown priming', async () => {
  const sourceText = await source('../src/v23.3/round16-runtime.mjs');
  assert.match(sourceText, /function\s+primeTablesOverlay/);
  assert.match(sourceText, /addEventListener\(['"]pointerdown['"]/);
  assert.match(sourceText, /dataset\?\.tab\s*===\s*['"]seriea['"]/);
  assert.match(sourceText, /cw233-table-selectors-viewport\{overflow:hidden!important/);
});

test('Round 16 removes late Round 13 table label mutation', async () => {
  const round13 = await source('../src/v23.3/round13-mobile-regressions.mjs');
  assert.doesNotMatch(round13, /function\s+compactTableSelectors/);
});

test('Round 16 Profile maps all four prediction counters from canonical ranking stats', () => {
  assert.deepEqual(profileUi.profileStatsFromRankingRow({
    points:4,
    exact_scores:1,
    correct_outcomes:3,
    scored_predictions:8,
  }), {
    points:4,
    exactScores:1,
    correctOutcomes:3,
    scoredPredictions:8,
  });
  assert.deepEqual(profileUi.profileStatsFromRankingRow(null), {
    points:0,
    exactScores:0,
    correctOutcomes:0,
    scoredPredictions:0,
  });
});
