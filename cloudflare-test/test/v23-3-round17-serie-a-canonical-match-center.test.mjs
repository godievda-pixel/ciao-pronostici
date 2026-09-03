import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { renderMatchCenter } from '../src/v23.3/match-center-core.mjs';
import { applyHomeV233SourcePatch } from '../scripts/home-v23-3-source-patch.mjs';

test('canonical Match Center renderer still supports the Serie A theme for future parity work', () => {
  const html = renderMatchCenter({
    match:{
      competition:'serie_a',
      matchId:'serie_a:123',
      kickoffAt:'2026-09-06T18:45:00Z',
      status:'scheduled',
      homeTeam:{ name:'Интер', crestUrl:'inter.png' },
      awayTeam:{ name:'Милан', crestUrl:'milan.png' },
    },
  });
  assert.match(html, /data-cw233-mc-theme="serie-a"/);
  assert.match(html, /data-cw233-competition="serie_a"/);
  assert.match(html, /data-cw233-match="serie_a:123"/);
});

test('Serie A canonical links delegate to the proven full legacy Match Center until feature parity exists', async () => {
  const source = await readFile(new URL('../src/v23.3/match-center-core.mjs', import.meta.url), 'utf8');
  assert.match(source, /function delegateSerieA\(/);
  assert.match(source, /ciao-v233-open-serie-a-match/);
  assert.match(source, /payload\?\.competition\s*===\s*['"]serie_a['"]/);
  assert.match(source, /legacy_unavailable/);
});

test('Home source patch preserves original legacy openMatchCenter and consumes only the Serie A delegation event', () => {
  const patched = applyHomeV233SourcePatch(`
function openMatchCenter(id){ return 'legacy:' + id; }
predict = __cw231HomeHtml;
`);
  assert.match(patched, /ciao-v233-open-serie-a-match/);
  assert.match(patched, /openMatchCenter\(legacyId\)/);
  assert.doesNotMatch(patched, /__cw233LegacyOpenMatchCenter/);
  assert.doesNotMatch(patched, /CiaoV233MatchCenter/);
  assert.doesNotMatch(patched, /openCanonicalMatchCenter/);
});

test('Serie A keeps the proven legacy calendar and full Match Center path', async () => {
  const matchesUi = await readFile(new URL('../src/v23.2/matches-ui.mjs', import.meta.url), 'utf8');
  const round7 = await readFile(new URL('../src/v23.3/round7-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(matchesUi, /competition\s*===\s*['"]serie_a['"]\)\s*\{\s*close\(\);\s*return\s+['"]legacy['"]/);
  assert.match(round7, /cw232-serie-a-back/);
  assert.match(round7, /Назад к турнирам/);
});
