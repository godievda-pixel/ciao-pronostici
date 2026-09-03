import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shouldIncludeMatch } from '../src/v23.2/match-normalizer.mjs';
import { adaptBsdEvents } from '../src/v23.2/bsd-adapter.mjs';

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

test('BSD adapter drops provider round 636 qualification fixtures before the Match UI sees them', () => {
  const rows = adaptBsdEvents({ results:[
    {
      id:63601, event_date:'2026-07-20T19:00:00Z', status:'finished',
      round_name:'Qualification Round 2', round_number:636,
      home_team:{id:'milan',name:'Milan',country_code:'ITA'},
      away_team:{id:'qualifier',name:'Qualifier',country_code:'ISR'},
      home_score:0, away_score:0,
    },
    {
      id:6001, event_date:'2026-09-10T19:00:00Z', status:'scheduled',
      round_name:'League Stage', round_number:6,
      home_team:{id:'milan',name:'Milan',country_code:'ITA'},
      away_team:{id:'chelsea',name:'Chelsea',country_code:'ENG'},
    },
  ] }, 'uecl');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].round, 6);
});

test('Round 9 no longer owns UEFA scrolling or removes the Favorite Club nearest-match card', async () => {
  const source = await readFile(new URL('../src/v23.3/round9-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /scrollIntoView/);
  assert.doesNotMatch(source, /pruneFavoriteNearest/);
  assert.doesNotMatch(source, /nth-child\(2\).*display:none/s);
  assert.match(source, /Round 10/);
});

test('Serie A legacy screen keeps the compact tournament header and hides the old Ciao hero', async () => {
  const source = await readFile(new URL('../src/v23.3/round9-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /cw233-serie-a-competition-head/);
  assert.match(source, />Матчи</);
  assert.match(source, />Серия А</);
  assert.match(source, />Италия</);
  assert.match(source, /cw233-serie-a-active/);
  assert.match(source, /legacy-hero/);
});

test('Round 9 runtime remains enabled as the Serie A legacy-header bridge', async () => {
  const source = await readFile(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
  assert.match(source, /round9-regression-fixes\.mjs/);
  assert.match(source, /round9RegressionFixes:\s*'enabled'/);
});
