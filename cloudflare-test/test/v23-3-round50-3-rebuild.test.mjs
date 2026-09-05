import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUND503_VIEW_TABS,
  canonicalRound503ViewTab,
  providerTabForRound503View,
  round503SnapHeights,
  resolveRound503Snap,
} from '../src/v23.3/round50-3-match-center-view.mjs';

test('Round 50.3 exposes exactly the approved five user views in order', () => {
  assert.deepEqual(ROUND503_VIEW_TABS.map(tab => [tab.key, tab.label]), [
    ['overview', 'Обзор'],
    ['lineups', 'Составы'],
    ['events', 'События'],
    ['statistics', 'Статистика'],
    ['shots', 'Удары'],
  ]);
});

test('Round 50.3 maps Statistics and Shots to the existing stats provider contract', () => {
  assert.equal(providerTabForRound503View('overview'), 'overview');
  assert.equal(providerTabForRound503View('lineups'), 'lineups');
  assert.equal(providerTabForRound503View('events'), 'events');
  assert.equal(providerTabForRound503View('statistics'), 'stats');
  assert.equal(providerTabForRound503View('shots'), 'stats');
  assert.equal(canonicalRound503ViewTab('unknown'), 'overview');
});

test('Round 50.3 drawer snap targets are deterministic viewport-relative heights', () => {
  assert.deepEqual(round503SnapHeights(800), {
    compact:368,
    standard:624,
    expanded:752,
  });
});

test('Round 50.3 drawer expands on a meaningful upward drag and dismisses only downward from compact', () => {
  assert.deepEqual(
    resolveRound503Snap({ viewportHeight:800, currentHeight:624, deltaY:-120 }),
    { action:'snap', snap:'expanded', height:752 },
  );
  assert.deepEqual(
    resolveRound503Snap({ viewportHeight:800, currentHeight:368, deltaY:120 }),
    { action:'dismiss' },
  );
});
