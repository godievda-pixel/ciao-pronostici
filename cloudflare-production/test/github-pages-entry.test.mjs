import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootEntry = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const v23Source = await readFile(new URL('../src/v23/index.html', import.meta.url), 'utf8');

test('GitHub Pages root serves the canonical v23 frontend directly', () => {
  assert.equal(rootEntry, v23Source);
  assert.match(rootEntry, /ciao-v23-native-home-20260908/);
  assert.match(rootEntry, /ciao-v23-native-predictions-20260908/);
});

test('GitHub Pages root has no dynamic frontend release launcher', () => {
  assert.doesNotMatch(rootEntry, /ciao-release-manifest-v1/);
  assert.doesNotMatch(rootEntry, /ciao:production-url/);
  assert.doesNotMatch(rootEntry, /ciao-web-entry-dynamic/);
});
