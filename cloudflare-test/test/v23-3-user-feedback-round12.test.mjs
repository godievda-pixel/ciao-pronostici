import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadCompetitionStandings } from '../src/v23.3/data-client.mjs';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('Match Center keeps one stable frame while a Euro/Coppa snapshot resolves', async () => {
  const facade = await source('../src/v23.3/match-center.mjs');
  const core = await source('../src/v23.3/match-center-core.mjs');
  assert.match(facade, /function patchMatchCenterOverlay/);
  assert.match(facade, /Core\.patchMatchCenterOverlay/);
  assert.match(core, /cw233-mc-loading-board|data-cw233-mc-loading-frame/);
  const stateStart = core.indexOf('onStateChange(state)');
  const stateEnd = core.indexOf('});\n\n  async function open', stateStart);
  const stateBranch = core.slice(stateStart, stateEnd);
  assert.doesNotMatch(stateBranch, /overlay\.innerHTML\s*=\s*renderMatchCenter\(state\)/);
  assert.doesNotMatch(stateBranch, /overlay\.scrollTo\(0,\s*0\)/);
});

test('legacy Ciao brand subtitle is ВСЁ О КАЛЬЧО instead of the Serie A season label', async () => {
  const code = await source('../scripts/home-v23-3-source-patch.mjs');
  assert.match(code, /ВСЁ О КАЛЬЧО/);
  assert.doesNotMatch(code, /split\(SEASON_LABEL\)\.join\(''\)/);
});

test('Round 12 hides the legacy logo header outside Home without reserving its separator', async () => {
  const index = await source('../src/v23.3/index.mjs');
  assert.match(index, /round12-stability-performance\.mjs/);
  const code = await source('../src/v23.3/round12-stability-performance.mjs').catch(() => '');
  assert.match(code, /cw233-app-brand-header/);
  assert.match(code, /data-cw233-active-tab|cw233-nonhome/);
  assert.match(code, /ВСЁ О КАЛЬЧО/);
  assert.match(code, /display\s*:\s*none\s*!important/);
});

test('standings GETs are short-TTL cached and deduplicated for instant table revisits', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return Response.json({ ok:true, data:{ rows:[{ position:1, team:{ name:'Рома' }, points:6 }] } });
  };
  const options = { initData:'tg-round12-cache', fetchImpl };
  await Promise.all([
    loadCompetitionStandings('serie_a', options),
    loadCompetitionStandings('serie_a', options),
  ]);
  await loadCompetitionStandings('serie_a', options);
  assert.equal(calls, 1);
});

test('Tables no longer rebuild the whole overlay or reset scroll for every filter load', async () => {
  const code = await source('../src/v23.3/tables-ui.mjs');
  assert.match(code, /function patchTablesHub/);
  assert.match(code, /tablesCache|TABLES_CACHE/);
  const installStart = code.indexOf('export function installTablesUi');
  const install = code.slice(installStart);
  assert.doesNotMatch(install, /show\(html\)\s*\{[\s\S]{0,220}overlay\.innerHTML\s*=\s*html[\s\S]{0,120}scrollTo\(0,\s*0\)/);
});

test('mobile standings resolve the 660px CSS conflict instead of appearing cropped', async () => {
  const round7 = await source('../src/v23.3/round7-regression-fixes.mjs');
  assert.doesNotMatch(round7, /min-width:660px!important/);
  const round12 = await source('../src/v23.3/round12-stability-performance.mjs').catch(() => '');
  assert.match(round12, /cw233-standing-table/);
  assert.match(round12, /@media\s*\(min-width:420px\)/);
  assert.match(round12, /min-width\s*:\s*0\s*!important/);
});

test('Predictions warm from Home immediately and retry prefetch when Telegram auth appears late', async () => {
  const code = await source('../src/v23.3/predictions-ui.mjs');
  assert.match(code, /CiaoV233Home\?\.state\?\.\(\)/);
  assert.match(code, /prediction-bootstrap|hydrating/i);
  assert.match(code, /ciao-v233-home-ready|ciao-v233-home-updated/);
  assert.match(code, /warm|prefetch/i);
});

test('prediction canonical feeds use a shared short cache and parallel Serie A sources', async () => {
  const code = await source('../src/v23.3/prediction-match-resolver.mjs');
  assert.match(code, /CANONICAL_MATCH_CACHE|PREDICTION_MATCH_CACHE/);
  assert.match(code, /CANONICAL_MATCH_INFLIGHT|PREDICTION_MATCH_INFLIGHT/);
  const serieAStart = code.indexOf('async function loadSerieA');
  const serieAEnd = code.indexOf('function assertActiveSeason', serieAStart);
  const serieA = code.slice(serieAStart, serieAEnd);
  assert.match(serieA, /Promise\.allSettled|Promise\.all/);
});
