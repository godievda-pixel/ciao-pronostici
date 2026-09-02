import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (name) => readFile(new URL(`../src/v23.3/${name}`, import.meta.url), 'utf8');

test('Predictions reuse the stable premium app components instead of a fixed overlay', async () => {
  const s = await source('predictions-ui.mjs');
  assert.doesNotMatch(s, /position:\s*fixed/i);
  assert.doesNotMatch(s, /ciao-v233-predictions-overlay/);
  for (const marker of [
    'cw231-prediction-tabs',
    'section-title',
    'matches',
    'match ',
    'score-side',
    'score-value',
    'savebar',
    'class="save"',
    'mine-card',
    'mine-match',
  ]) assert.match(s, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('Ranking reuses the stable premium card/list system instead of a fixed overlay', async () => {
  const s = await source('ranking-ui.mjs');
  assert.doesNotMatch(s, /position:\s*fixed/i);
  assert.doesNotMatch(s, /ciao-v233-ranking-overlay/);
  for (const marker of ['cw231-filters','section-title','class="card"','list-row','class="pos"','class="person"','class="pts"']) {
    assert.match(s, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Home multi-competition renderer keeps v23.1 premium Today markup and card classes', async () => {
  const s = await source('home-integration.mjs');
  assert.match(s, /cw231-today-premium/);
  assert.match(s, /cw231-today-head/);
  assert.match(s, /cw231-today-heading/);
  assert.match(s, /cw231-today-list/);
  assert.match(s, /cw231-today-card/);
  assert.match(s, /cw231-today-bottom/);
  assert.doesNotMatch(s, /cw233-home-card\s/);
});

test('v23.3 custom pages render into the stable content area and let legacy nav update active state first', async () => {
  const prediction = await source('predictions-ui.mjs');
  const ranking = await source('ranking-ui.mjs');
  for (const s of [prediction, ranking]) {
    assert.match(s, /#ciao-miniapp-root \.content/);
    assert.doesNotMatch(s, /stopImmediatePropagation/);
  }
});
