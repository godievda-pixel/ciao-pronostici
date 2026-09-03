import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as rankingUi from '../src/v23.3/ranking-ui.mjs';
import * as profileUi from '../src/v23.3/profile-rating-ui.mjs';
import { renderTablesHub } from '../src/v23.3/tables-ui.mjs';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('Round 16 Matches hub handoff is immediate and has no animated background exposure', async () => {
  const runtime = await source('../src/v23.3/round10-regression-fixes.mjs');
  assert.doesNotMatch(runtime, /transition\s*:\s*background/i);
  assert.match(runtime, /#ciao-v232-matches-overlay\{background:#07101f!important/);
});

test('Round 16 Ranking uses compact selector labels and full tournament section titles', () => {
  const labels = Object.fromEntries(rankingUi.RANKING_FILTERS.map(item => [item.key, item.label]));
  assert.equal(labels.overall, 'Общий');
  assert.equal(labels.serie_a, 'Серия А');
  assert.equal(labels.coppa_italia, 'КИ');
  assert.equal(labels.ucl, 'ЛЧ');
  assert.equal(labels.uel, 'ЛЕ');
  assert.equal(labels.uecl, 'ЛК');

  assert.equal(typeof rankingUi.rankingSectionTitle, 'function');
  if (typeof rankingUi.rankingSectionTitle === 'function') {
    assert.equal(rankingUi.rankingSectionTitle('overall'), 'Общий рейтинг');
    assert.equal(rankingUi.rankingSectionTitle('serie_a'), 'Серия А');
    assert.equal(rankingUi.rankingSectionTitle('coppa_italia'), 'Кубок Италии');
    assert.equal(rankingUi.rankingSectionTitle('ucl'), 'Лига Чемпионов');
    assert.equal(rankingUi.rankingSectionTitle('uel'), 'Лига Европы');
    assert.equal(rankingUi.rankingSectionTitle('uecl'), 'Лига Конференций');
  }
});

test('Round 16 Ranking filters fit in one stable six-column row', async () => {
  const runtime = await source('../src/v23.3/ranking-ui.mjs');
  assert.match(runtime, /cw233-ranking-filters[^}]*display:grid[^}]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/s);
  assert.match(runtime, /overflow-x:hidden/);
});

test('Round 16 Tables renders compact selector labels directly and keeps full heading', () => {
  const ucl = renderTablesHub({ selectedCompetition:'ucl', data:{ rows:[] } });
  assert.match(ucl, /data-cw233-tables-competition="ucl"[^>]*>ЛЧ<\/button>/);
  assert.doesNotMatch(ucl, /data-cw233-tables-competition="ucl"[^>]*>Лига Чемпионов<\/button>/);
  assert.match(ucl, /<p[^>]*>Лига Чемпионов<\/p>/);

  const coppa = renderTablesHub({ selectedCompetition:'coppa_italia', data:{ matches:[] } });
  assert.match(coppa, /data-cw233-tables-competition="coppa_italia"[^>]*>КИ<\/button>/);
  assert.match(coppa, /<p[^>]*>Кубок Италии<\/p>/);
  assert.doesNotMatch(coppa, /<p[^>]*>Сетка плей-офф<\/p>/);
});

test('Round 16 Tables owns compact labels instead of late Round 13 DOM mutation', async () => {
  const tables = await source('../src/v23.3/tables-ui.mjs');
  const round13 = await source('../src/v23.3/round13-mobile-regressions.mjs');
  assert.match(tables, /TABLE_SELECTOR_LABELS/);
  assert.doesNotMatch(round13, /function\s+compactTableSelectors/);
});

test('Round 16 primes Tables overlay synchronously on pointerdown', async () => {
  const runtime = await source('../src/v23.3/tables-ui.mjs');
  assert.match(runtime, /function\s+primeTablesOverlay/);
  assert.match(runtime, /addEventListener\(['"]pointerdown['"]/);
  assert.match(runtime, /dataset\?\.tab\s*===\s*['"]seriea['"]/);
});

test('Round 16 Profile maps all four legacy counters from canonical ranking stats', () => {
  assert.equal(typeof profileUi.profileStatsFromRankingRow, 'function');
  if (typeof profileUi.profileStatsFromRankingRow !== 'function') return;

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
