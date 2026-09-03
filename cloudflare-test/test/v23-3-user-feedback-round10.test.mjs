import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('UEFA league-stage tabs fit all 8 rounds on one mobile row without horizontal scrolling', async () => {
  const source = await readFile(new URL('../src/v23.3/round10-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /grid-template-columns:\s*repeat\(8,\s*minmax\(0,1fr\)\)/);
  assert.match(source, /overflow-x:\s*hidden/);
  assert.doesNotMatch(source, /scrollIntoView/);
});

test('favorite club nearest-match card stays visible and links to the canonical next match', async () => {
  const source = await readFile(new URL('../src/v23.3/round10-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /Ближайший матч/);
  assert.match(source, /data-cw233-favorite-next/);
  assert.match(source, /data-cw233-competition/);
  assert.match(source, /data-cw233-match/);
  assert.match(source, /kickoffAt/);
  assert.match(source, /crestUrl|logo_url|logoUrl/);
  assert.doesNotMatch(source, /nth-child\(2\).*display:none/s);
});

test('prediction date and stage headings no longer render match-count captions', async () => {
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /selected\.matches\.length\}\s*матч\./);
  assert.doesNotMatch(source, /group\.matches\.length\}\s*матч\./);
});

test('Serie A crest enrichment uses BSD as a secondary source for predictions and standings', async () => {
  const worker = await readFile(new URL('../src/worker.js', import.meta.url), 'utf8');
  const resolver = await readFile(new URL('../src/v23.3/prediction-match-resolver.mjs', import.meta.url), 'utf8');
  assert.match(worker, /BSD_API_KEY/);
  assert.match(worker, /fetchBsdMatches/);
  assert.match(worker, /enrichSerieAStandingsCrests/);
  assert.match(worker, /canonical|normalizeTeamAlias|russianTeamName/);
  assert.match(resolver, /fetchBsdMatches/);
  assert.match(resolver, /serie_a/);
  assert.match(resolver, /crestUrl/);
});

test('each Match tournament has a premium full-screen ambient background in its own theme', async () => {
  const source = await readFile(new URL('../src/v23.3/round10-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /data-cw232-theme=['"]serie-a['"]/);
  assert.match(source, /data-cw232-theme=['"]coppa['"]/);
  assert.match(source, /data-cw232-theme=['"]champions['"]/);
  assert.match(source, /data-cw232-theme=['"]europa['"]/);
  assert.match(source, /data-cw232-theme=['"]conference['"]/);
  assert.match(source, /radial-gradient/);
  assert.match(source, /linear-gradient/);
  assert.match(source, /#ciao-v232-matches-overlay/);
});

test('Round 10 runtime is enabled from v23.3 entry point', async () => {
  const source = await readFile(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
  assert.match(source, /round10-regression-fixes\.mjs/);
  assert.match(source, /round10RegressionFixes:\s*'enabled'/);
});
