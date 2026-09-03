import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(`../src/v23.3/${path}`, import.meta.url), 'utf8');
}

test('Round 17 Tables own tournament theme and compact selector labels at render time', async () => {
  const mod = await import('../src/v23.3/tables-ui.mjs');
  assert.equal(mod.tablesThemeForCompetition?.('serie_a'), 'serie-a');
  assert.equal(mod.tablesThemeForCompetition?.('coppa_italia'), 'coppa');
  assert.equal(mod.tablesThemeForCompetition?.('ucl'), 'champions');
  assert.equal(mod.tablesThemeForCompetition?.('uel'), 'europa');
  assert.equal(mod.tablesThemeForCompetition?.('uecl'), 'conference');

  const europa = mod.renderTablesHub({ selectedCompetition:'uel', loading:true });
  assert.match(europa, /data-cw233-theme="europa"/);
  assert.match(europa, /data-cw233-round11-theme="europa"/);
  assert.match(europa, /data-cw233-tables-competition="ucl"[^>]*>ЛЧ<\/button>/);
  assert.match(europa, /data-cw233-tables-competition="uel"[^>]*>ЛЕ<\/button>/);
  assert.match(europa, /data-cw233-tables-competition="uecl"[^>]*>ЛК<\/button>/);
  assert.match(europa, /data-cw233-tables-competition="coppa_italia"[^>]*>КИ<\/button>/);
  assert.match(europa, /<p>Лига Европы<\/p>/);
});

test('Round 17 Ranking owns tournament theme and compact filter labels in its source model', async () => {
  const mod = await import('../src/v23.3/ranking-ui.mjs');
  assert.equal(mod.rankingThemeForCompetition?.('overall'), 'serie-a');
  assert.equal(mod.rankingThemeForCompetition?.('coppa_italia'), 'coppa');
  assert.equal(mod.rankingThemeForCompetition?.('ucl'), 'champions');
  assert.equal(mod.rankingThemeForCompetition?.('uel'), 'europa');
  assert.equal(mod.rankingThemeForCompetition?.('uecl'), 'conference');
  assert.equal(mod.RANKING_FILTERS.find(item => item.key === 'coppa_italia')?.label, 'КИ');
});

test('Round 17 late premium layers no longer mutate Tables or Ranking ownership', async () => {
  const [round8, round11, round16] = await Promise.all([
    source('round8-performance-premium.mjs'),
    source('round11-performance-themes.mjs'),
    source('round16-runtime.mjs'),
  ]);

  assert.doesNotMatch(round8, /function decorateTables\(/);
  assert.doesNotMatch(round8, /data-cw233-tables-selected/);
  assert.doesNotMatch(round11, /function applyRound11Themes\(/);
  assert.doesNotMatch(round11, /dataset\.cw233Round11Theme\s*=/);
  assert.doesNotMatch(round16, /function patchTableLabels\(/);
  assert.doesNotMatch(round16, /function patchRanking\(/);
});

test('Round 17 Tables and Ranking do not dispatch a theme event for a later decorator to repair them', async () => {
  const [tables, ranking] = await Promise.all([
    source('tables-ui.mjs'),
    source('ranking-ui.mjs'),
  ]);
  assert.doesNotMatch(tables, /dispatchEvent\?\.\(new Event\('ciao-v233-round11-theme'\)\)/);
  assert.doesNotMatch(ranking, /function dispatchThemeRefresh\(/);
});
