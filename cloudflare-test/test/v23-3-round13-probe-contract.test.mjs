import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('TEST deployment probe tracks Round 12 adaptive tables and Round 13 runtime instead of obsolete 660px width', async () => {
  const source = await readFile(new URL('../scripts/probe-test-deployment-v233.mjs', import.meta.url), 'utf8');

  assert.match(source, /\/v23\.3\/round12-stability-performance\.mjs/);
  assert.match(source, /\/v23\.3\/round13-mobile-regressions\.mjs/);
  assert.match(source, /hasRound12Runtime/);
  assert.match(source, /hasRound13Runtime/);
  assert.doesNotMatch(source, /hasRound7Runtime[^\n]*min-width:660px!important/);
  assert.match(source, /deployed TEST is missing Round 12 adaptive table runtime/);
  assert.match(source, /deployed TEST is missing Round 13 mobile regression runtime/);
});

test('Round 7 deployment marker checks only surviving Round 7 behavior', async () => {
  const source = await readFile(new URL('../scripts/probe-test-deployment-v233.mjs', import.meta.url), 'utf8');
  const markerStart = source.indexOf('hasRound7Runtime:');
  const markerEnd = source.indexOf('\n      hasRound12Runtime:', markerStart);
  const marker = source.slice(markerStart, markerEnd > markerStart ? markerEnd : markerStart + 600);

  assert.match(marker, /USER_FEEDBACK_ROUND7_BUILD/);
  assert.match(marker, /cw232-serie-a-back/);
  assert.match(marker, /z-index:80!important/);
  assert.doesNotMatch(marker, /min-width:660px!important/);
});
