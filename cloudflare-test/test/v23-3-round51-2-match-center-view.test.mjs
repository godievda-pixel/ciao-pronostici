import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUND512_USER_VIEW_TABS,
  canonicalRound512UserView,
  providerSectionForRound512UserView,
} from '../src/v23.3/round51-2-match-center-view.mjs';

test('Round 51.2 exposes exactly the five approved user-facing Match Center tabs', () => {
  assert.deepEqual(ROUND512_USER_VIEW_TABS, [
    { key:'overview', label:'Обзор' },
    { key:'lineups', label:'Составы' },
    { key:'events', label:'События' },
    { key:'statistics', label:'Статистика' },
    { key:'shots', label:'Удары' },
  ]);
});

test('Round 51.2 maps statistics and shots to the same canonical stats provider section', () => {
  assert.equal(providerSectionForRound512UserView('overview'), 'overview');
  assert.equal(providerSectionForRound512UserView('lineups'), 'lineups');
  assert.equal(providerSectionForRound512UserView('events'), 'events');
  assert.equal(providerSectionForRound512UserView('statistics'), 'stats');
  assert.equal(providerSectionForRound512UserView('shots'), 'stats');
});

test('Round 51.2 canonicalizes unknown user views to overview without exposing provider-only players', () => {
  assert.equal(canonicalRound512UserView('shots'), 'shots');
  assert.equal(canonicalRound512UserView('players'), 'overview');
  assert.equal(canonicalRound512UserView('anything'), 'overview');
});
