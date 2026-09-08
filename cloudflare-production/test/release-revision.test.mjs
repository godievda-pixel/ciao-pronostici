import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseRevision, isReleaseRevision } from '../scripts/release-revision.mjs';

test('release revision is the first 12 lowercase hex chars of SHA-256', () => {
  assert.equal(releaseRevision('hello'), '2cf24dba5fb0');
  assert.match(releaseRevision('hello'), /^[0-9a-f]{12}$/);
});

test('release revision is deterministic and changes when bytes change', () => {
  const a = releaseRevision(new TextEncoder().encode('same'));
  const b = releaseRevision(new TextEncoder().encode('same'));
  const c = releaseRevision(new TextEncoder().encode('same!'));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('release revision validator accepts only 12 lowercase hex characters', () => {
  assert.equal(isReleaseRevision('e833e3ab9551'), true);
  assert.equal(isReleaseRevision('E833E3AB9551'), false);
  assert.equal(isReleaseRevision('e833e3ab955'), false);
  assert.equal(isReleaseRevision('e833e3ab95511'), false);
  assert.equal(isReleaseRevision('zz33e3ab9551'), false);
});
