import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimePatchSource } from '../scripts/bsd-crests.mjs';

test('club profile crest artwork is 52px without resizing the 64px tile', () => {
  const source = runtimePatchSource();
  assert.match(source, /\.cw16-club-crest img\{width:52px!important;height:52px!important\}/);
  assert.doesNotMatch(source, /\.cw16-club-crest\{[^}]*width:52px/);
});
