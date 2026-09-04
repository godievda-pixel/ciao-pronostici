import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderTablesHub, tablesThemeForCompetition } from '../src/v23.3/tables-ui.mjs';
import { resetPredictionDomain } from '../src/v23.3/prediction-sql.mjs';

test('Tables theme derives natively from the selected competition instead of stale decorator state', async () => {
  assert.equal(tablesThemeForCompetition('uecl'), 'conference');
  assert.equal(tablesThemeForCompetition('serie_a'), 'serie-a');
  const html = renderTablesHub({ selectedCompetition:'uecl', loading:true });
  assert.match(html, /data-cw233-tables-selected="uecl"/);
  assert.match(html, /data-cw233-theme="conference"/);
  assert.match(html, /data-cw233-round11-theme="conference"/);

  const tables = await readFile(new URL('../src/v23.3/tables-ui.mjs', import.meta.url), 'utf8');
  const round11 = await readFile(new URL('../src/v23.3/round11-performance-themes.mjs', import.meta.url), 'utf8');
  assert.match(tables, /current\.dataset\.cw233Theme\s*=\s*next\.dataset\?\.cw233Theme/);
  assert.match(tables, /current\.dataset\.cw233Round11Theme\s*=\s*next\.dataset\?\.cw233Round11Theme/);
  assert.doesNotMatch(round11, /tables\.dataset\?\.cw233TablesSelected/);
  assert.doesNotMatch(round11, /tables\.dataset\.cw233Theme\s*=/);
});

test('Predictions use one persistent shell instead of replacing the whole content root', async () => {
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /function ensurePredictionShell/);
  assert.match(source, /cw233-prediction-body-slot/);
  assert.match(source, /cw233-prediction-save-slot/);
  assert.doesNotMatch(source, /main\.innerHTML\s*=\s*`<div class="cw233-prediction-page"/);
  assert.match(source, /queueMicrotask\(run\)|setTimeout\(run,\s*0\)/);
});

test('Predictions tournament theme reaches mode, rounds, score controls and save action', async () => {
  const source = await readFile(new URL('../src/v23.3/round11-performance-themes.mjs', import.meta.url), 'utf8');
  assert.match(source, /cw231-prediction-tabs[^\n]*button\[aria-selected='true'\]/);
  assert.match(source, /cw233-pred-nav[^\n]*button\[aria-selected='true'\]/);
  assert.match(source, /data-cw233-delta/);
  assert.match(source, /savebar[^\n]*\.save/);
  assert.match(source, /var\(--r11a\)/);
});

test('Ranking no longer uses the extra Round 13 full-screen loading overlay', async () => {
  const round13 = await readFile(new URL('../src/v23.3/round13-mobile-regressions.mjs', import.meta.url), 'utf8');
  const ranking = await readFile(new URL('../src/v23.3/ranking-ui.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(round13, /showRankingLoading\(/);
  assert.doesNotMatch(round13, /RANKING_LOADING_ID/);
  assert.match(ranking, /setHtmlIfChanged/);
  assert.match(ranking, /RANKING_FILTERS\.map\(filter=>/);
  assert.doesNotMatch(ranking, /RANKING_FILTERS\.filter\(filter=>filter\.key!=='overall'\)/);
});

test('TEST reset explicitly reports cleared profile participant rows', async () => {
  const calls = [];
  const sql = {
    exec(statement) {
      calls.push(statement);
      if (statement === 'DELETE FROM predictions') return { rowsWritten:4 };
      if (statement === 'DELETE FROM prediction_reconciled_matches') return { rowsWritten:2 };
      if (statement === 'DELETE FROM ranking_snapshots') return { rowsWritten:1 };
      if (statement === 'DELETE FROM participants') return { rowsWritten:3 };
      if (statement.startsWith('UPDATE schema_meta')) return { rowsWritten:1 };
      return { rowsWritten:0 };
    },
  };
  const result = resetPredictionDomain(sql);
  assert.equal(result.predictions, 4);
  assert.equal(result.participants, 3);
  assert.equal(result.profiles, 3);

  const durable = await readFile(new URL('../src/v23.3/prediction-league-do.mjs', import.meta.url), 'utf8');
  assert.match(durable, /profiles:\s*\{\s*ok:\s*true,\s*affected:\s*result\.profiles/);
});

test('Profile predictor points come from the v23.3 ranking domain instead of legacy S.stats.points', async () => {
  const profile = await readFile(new URL('../src/v23.3/profile-rating-ui.mjs', import.meta.url), 'utf8');
  const index = await readFile(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
  assert.match(profile, /createPredictionClient/);
  assert.match(profile, /rankings\(\{\s*scope:'overall'\s*\}/);
  assert.match(profile, /data-cw233-profile-points/);
  assert.match(profile, /stats-grid/);
  assert.doesNotMatch(profile, /S\?\.stats|S\.stats/);
  assert.match(index, /profile-rating-ui\.mjs/);
});
