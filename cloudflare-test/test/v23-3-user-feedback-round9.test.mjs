import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shouldIncludeMatch } from '../src/v23.2/match-normalizer.mjs';
import { competitionNavigationGroups } from '../src/v23.2/matches-ui.mjs';

const team = name => ({ id:name, name, countryCode:name === 'Милан' ? 'ITA' : 'ENG', crestUrl:'' });
const match = (overrides = {}) => ({
  matchId:'uecl:1', competition:'uecl', season:'2026-27', stage:'League Stage', round:1,
  kickoffAt:'2026-09-10T19:00:00Z', status:'scheduled', minute:null,
  homeTeam:team('Милан'), awayTeam:team('Челси'), homeScore:null, awayScore:null,
  ...overrides,
});

test('UEFA qualification matches are excluded before they can become bogus round tabs', () => {
  assert.equal(shouldIncludeMatch(match({ stage:'Qualification Round 2', round:636 })), false);
  assert.equal(shouldIncludeMatch(match({ stage:'1st Qualifying Round', round:1 })), false);
  assert.equal(shouldIncludeMatch(match({ stage:'Preliminary Round', round:1 })), false);
  assert.equal(shouldIncludeMatch(match({ stage:'League Stage', round:6 })), true);
});

test('defensive navigation filtering never exposes the provider round 636', () => {
  const groups = competitionNavigationGroups([
    match({ matchId:'uecl:q', stage:'Qualification Round 2', round:636 }),
    match({ matchId:'uecl:6', stage:'League Stage', round:6 }),
  ], 'uecl');
  assert.deepEqual(groups.map(group => group.key), ['round:6']);
});

test('UEFA tabs make the selected last round visible instead of leaving it off-screen', async () => {
  const source = await readFile(new URL('../src/v23.3/round9-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /scrollIntoView/);
  assert.match(source, /aria-selected=["']true["']/);
  assert.match(source, /scroll-padding-inline/);
});

test('favorite club legacy nearest-match mini-card is removed, not merely rebound to new data', async () => {
  const source = await readFile(new URL('../src/v23.3/round9-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /Ближайший матч/);
  assert.match(source, /remove\(\)/);
  assert.match(source, /cw211-favorite-body/);
  assert.match(source, /nth-child\(2\).*display:none/s);
});

test('Serie A legacy screen gets the same compact tournament header as other competitions and hides the old Ciao hero', async () => {
  const source = await readFile(new URL('../src/v23.3/round9-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /cw233-serie-a-competition-head/);
  assert.match(source, />Матчи</);
  assert.match(source, />Серия А</);
  assert.match(source, />Италия</);
  assert.match(source, /cw233-serie-a-active/);
  assert.match(source, /legacy-hero/);
});

test('Tables Round 9 premium layer is explicitly tournament-aware and keeps real crest images preferred over initials', async () => {
  const source = await readFile(new URL('../src/v23.3/round9-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /data-cw233-theme=['"]serie-a['"]/);
  assert.match(source, /data-cw233-theme=['"]champions['"]/);
  assert.match(source, /data-cw233-theme=['"]europa['"]/);
  assert.match(source, /data-cw233-theme=['"]conference['"]/);
  assert.match(source, /cw233-table-logo/);
  assert.match(source, /crestUrl|logo_url|logoUrl/);
});

test('Round 9 runtime is enabled from the v23.3 entry point', async () => {
  const source = await readFile(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
  assert.match(source, /round9-regression-fixes\.mjs/);
  assert.match(source, /round9RegressionFixes:\s*'enabled'/);
});
