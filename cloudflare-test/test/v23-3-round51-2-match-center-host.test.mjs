import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUND512_DRAWER_ID,
  ROUND512_SNAP_HEIGHTS,
  round512DrawerStyle,
  resolveRound512DrawerSnap,
} from '../src/v23.3/round51-2-match-center-host.mjs';

test('Round 51.2 bottom drawer uses three approved snap heights with standard as the default visual state', () => {
  assert.equal(ROUND512_DRAWER_ID, 'ciao-v2512-match-center-drawer');
  assert.deepEqual(ROUND512_SNAP_HEIGHTS, {
    compact:46,
    standard:78,
    expanded:94,
  });
  const style = round512DrawerStyle('standard');
  assert.equal(style.position, 'fixed');
  assert.equal(style.bottom, '0');
  assert.equal(style.left, '0');
  assert.equal(style.right, '0');
  assert.equal(style.height, '78dvh');
  assert.equal('inset' in style, false);
  assert.equal(style.overflow, 'hidden');
});

test('Round 51.2 drawer drag advances or retreats by one snap and dismisses only below compact', () => {
  assert.equal(resolveRound512DrawerSnap('compact', -80), 'standard');
  assert.equal(resolveRound512DrawerSnap('standard', -80), 'expanded');
  assert.equal(resolveRound512DrawerSnap('expanded', -80), 'expanded');
  assert.equal(resolveRound512DrawerSnap('expanded', 80), 'standard');
  assert.equal(resolveRound512DrawerSnap('standard', 80), 'compact');
  assert.equal(resolveRound512DrawerSnap('compact', 80), 'dismiss');
});

test('Round 51.2 drawer ignores short accidental drags', () => {
  assert.equal(resolveRound512DrawerSnap('standard', 20), 'standard');
  assert.equal(resolveRound512DrawerSnap('compact', 20), 'compact');
  assert.equal(resolveRound512DrawerSnap('expanded', -20), 'expanded');
});
