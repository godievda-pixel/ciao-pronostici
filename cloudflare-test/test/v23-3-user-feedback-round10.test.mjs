import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildSerieACrestRegistry,
  enrichSerieAMatchesWithCrests,
  enrichSerieAStandingsWithCrests,
} from '../src/v23.3/serie-a-crest-source.mjs';

test('UEFA league-stage tabs fit all 8 rounds on one mobile row without horizontal scrolling', async () => {
  const source = await readFile(new URL('../src/v23.3/round10-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /grid-template-columns:\s*repeat\(8,\s*minmax\(0,1fr\)\)/);
  assert.match(source, /overflow-x:\s*hidden/);
  assert.doesNotMatch(source, /scrollIntoView/);
});

test('favorite club nearest-match card stays visible and links to the canonical next match', async () => {
  const source = await readFile(new URL('../src/v23.3/round10-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /Ближайший матч/);
  assert.match(source, /cw233FavoriteNext/);
  assert.match(source, /cw233Competition/);
  assert.match(source, /cw233Match/);
  assert.match(source, /kickoffAt/);
  assert.match(source, /crestUrl|logo_url|logoUrl/);
  assert.doesNotMatch(source, /nth-child\(2\).*display:none/s);
});

test('prediction date and stage headings hide match-count captions', async () => {
  const source = await readFile(new URL('../src/v23.3/round10-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /cw231-prediction-tabs~\.section-title>span\{display:none!important\}/);
});

test('Serie A crest registry canonicalizes BSD and Russian team names for legacy matches', () => {
  const registry = buildSerieACrestRegistry([
    { team:{ id:'bsd-milan', name:'AC Milan', rawName:'AC Milan', crestUrl:'https://img.example/milan.png' } },
    { team:{ id:'bsd-juve', name:'Juventus', rawName:'Juventus', crestUrl:'https://img.example/juve.png' } },
  ]);
  const [match] = enrichSerieAMatchesWithCrests([{
    matchId:'serie_a:77', competition:'serie_a',
    homeTeam:{ id:'legacy-1', name:'Милан', crestUrl:'' },
    awayTeam:{ id:'legacy-2', name:'Ювентус', crestUrl:'' },
  }], registry);
  assert.equal(match.homeTeam.crestUrl, 'https://img.example/milan.png');
  assert.equal(match.awayTeam.crestUrl, 'https://img.example/juve.png');
});

test('Serie A standings use the same BSD crest registry by canonical club name', () => {
  const registry = buildSerieACrestRegistry([
    { team:{ id:'bsd-genoa', name:'Genoa', rawName:'Genoa', crestUrl:'https://img.example/genoa.png' } },
  ]);
  const standings = enrichSerieAStandingsWithCrests({ rows:[
    { position:1, team:{ id:'legacy-genoa', name:'Дженоа', rawName:'Дженоа', crestUrl:'' }, points:6 },
  ] }, registry);
  assert.equal(standings.rows[0].team.crestUrl, 'https://img.example/genoa.png');
});

test('Serie A BSD crest source is wired into both worker standings/matches and prediction resolver', async () => {
  const worker = await readFile(new URL('../src/worker.js', import.meta.url), 'utf8');
  const resolver = await readFile(new URL('../src/v23.3/prediction-match-resolver.mjs', import.meta.url), 'utf8');
  const source = await readFile(new URL('../src/v23.3/serie-a-crest-source.mjs', import.meta.url), 'utf8');
  assert.match(source, /sports\.bzzoiro\.com\/api\/v2/);
  assert.match(source, /normalizeTeamAlias/);
  assert.match(source, /russianTeamName/);
  assert.match(worker, /fetchSerieACrestRegistry/);
  assert.match(worker, /enrichSerieAMatchesWithCrests/);
  assert.match(worker, /enrichSerieAStandingsWithCrests/);
  assert.match(resolver, /fetchSerieACrestRegistry/);
  assert.match(resolver, /enrichSerieAMatchesWithCrests/);
});

test('each Match tournament has a premium full-screen ambient background in its own theme', async () => {
  const source = await readFile(new URL('../src/v23.3/round10-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /cw233-round10-theme='serie-a'/);
  assert.match(source, /cw233-round10-theme='coppa'/);
  assert.match(source, /cw233-round10-theme='champions'/);
  assert.match(source, /cw233-round10-theme='europa'/);
  assert.match(source, /cw233-round10-theme='conference'/);
  assert.match(source, /radial-gradient/);
  assert.match(source, /linear-gradient/);
  assert.match(source, /#ciao-v232-matches-overlay/);
  assert.match(source, /cw233-serie-a-active/);
});

test('Round 10 runtime is enabled from v23.3 entry point', async () => {
  const source = await readFile(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
  assert.match(source, /round10-regression-fixes\.mjs/);
  assert.match(source, /round10RegressionFixes:\s*'enabled'/);
});
