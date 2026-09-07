import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimePatchSource } from '../scripts/bsd-crests.mjs';

test('club profile crest artwork is enlarged to 58px without resizing the 64px tile', () => {
  const source = runtimePatchSource();
  assert.match(source, /\.cw16-club-crest img\{width:58px!important;height:58px!important\}/);
  assert.doesNotMatch(source, /\.cw16-club-crest\{[^}]*width:58px/);
});
