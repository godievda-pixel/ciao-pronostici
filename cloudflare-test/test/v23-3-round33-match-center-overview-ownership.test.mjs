import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Round 33 external Overview preserves useful legacy blocks and removes only Serie A context/form', async () => {
  const patch = await read('../scripts/home-v23-3-source-patch.mjs');
  assert.match(patch, /__cw233Round33SanitizeExternalOverviewHtml/);
  assert.match(patch, /matchTabContent/);
  assert.match(patch, /cw14-form-card/);
  assert.match(patch, /Контекст\\\\s\+Серии/);
  assert.doesNotMatch(patch, /querySelectorAll\?\.\(['"]\.cw14-form-card,\.cw14-match-info['"]\)/);
});

test('Round 33 runtime no longer replaces external Overview with the minimal Round31 renderer', async () => {
  const source = await read('../src/v23.3/round31-match-center-stability.mjs');
  assert.doesNotMatch(source, /const nextHtml = renderRound31ExternalOverview\(activeExternal\.data\)/);
  assert.doesNotMatch(source, /stopImmediatePropagation\?\.\(\)[\s\S]{0,600}renderExternalOverview\(\)/);
});

test('Round 33 Matches lifecycle owns a persistent suspended marker until Match Center closes', async () => {
  const patch = await read('../scripts/home-v23-3-source-patch.mjs');
  assert.match(patch, /dataset\.cw233MatchCenterSuspended\s*=\s*['"]1['"]/);
  assert.match(patch, /delete matchesOverlay\.dataset\.cw233MatchCenterSuspended/);
  assert.match(patch, /data-cw233-match-center-suspended/);
});

test('Round 33 keeps only the inner Match Center back control visible when Matches is suspended', async () => {
  const patch = await read('../scripts/home-v23-3-source-patch.mjs');
  assert.match(patch, /#ciao-v232-matches-overlay\[data-cw233-match-center-suspended=['"]1['"]\]/);
  assert.match(patch, /display:none!important/);
});
