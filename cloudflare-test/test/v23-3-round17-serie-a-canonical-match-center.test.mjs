import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { renderMatchCenter } from '../src/v23.3/match-center-core.mjs';
import { applyHomeV233SourcePatch } from '../scripts/home-v23-3-source-patch.mjs';

test('Round 17 Serie A renders through the same canonical Match Center shell and native theme', () => {
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
  assert.match(html, /Серия А/);
  assert.match(html, /Интер/);
  assert.match(html, /Милан/);
});

test('Round 17 canonical Match Center core has no Serie A legacy delegation branch', async () => {
  const source = await readFile(new URL('../src/v23.3/match-center-core.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /function delegateSerieA\(/);
  assert.doesNotMatch(source, /legacy_unavailable/);
  assert.doesNotMatch(source, /payload\?\.competition\s*===\s*['"]serie_a['"]/);
  assert.match(source, /return controller\.open\(payload\)/);
});

test('Round 17 legacy Serie A openMatchCenter entry routes into the canonical v23.3 Match Center with fallback only when unavailable', () => {
  const patched = applyHomeV233SourcePatch(`
function openMatchCenter(id){ return 'legacy:' + id; }
predict = __cw231HomeHtml;
`);
  assert.match(patched, /__cw233LegacyOpenMatchCenter/);
  assert.match(patched, /CiaoV233MatchCenter/);
  assert.match(patched, /openCanonicalMatchCenter/);
  assert.match(patched, /competition:\s*['"]serie_a['"]/);
  assert.match(patched, /matchId:\s*['"]serie_a:['"]\s*\+\s*legacyId|matchId:\s*`serie_a:\$\{legacyId\}`/);
  assert.doesNotMatch(patched, /ciao-v233-open-serie-a-match/);
});

test('Round 17 keeps the proven Serie A calendar path while replacing only its Match Center destination', async () => {
  const matchesUi = await readFile(new URL('../src/v23.2/matches-ui.mjs', import.meta.url), 'utf8');
  const round7 = await readFile(new URL('../src/v23.3/round7-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(matchesUi, /competition\s*===\s*['"]serie_a['"]\)\s*\{\s*close\(\);\s*return\s+['"]legacy['"]/);
  assert.match(round7, /cw232-serie-a-back/);
  assert.match(round7, /Назад к турнирам/);
});
