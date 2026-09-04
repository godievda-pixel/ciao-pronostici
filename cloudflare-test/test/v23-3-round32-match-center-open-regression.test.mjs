import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

function functionBody(source, name) {
  const start = source.indexOf(`const ${name} =`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = source.indexOf('\n  };', start);
  assert.notEqual(end, -1, `${name} body must be readable`);
  return source.slice(start, end + 5);
}

test('Round 32 open events do not mutate/hide the Matches overlay before the lifecycle owner captures it', async () => {
  const source = await read('../src/v23.3/round31-match-center-stability.mjs');
  const externalOpen = functionBody(source, 'onExternalOpen');
  const serieAOpen = functionBody(source, 'onSerieAOpen');

  assert.doesNotMatch(externalOpen, /claimViewport\s*\(/);
  assert.doesNotMatch(serieAOpen, /claimViewport\s*\(/);
  assert.doesNotMatch(source, /overlay\.hidden\s*=\s*true/);
  assert.doesNotMatch(source, /overlay\?\.setAttribute\?\.\(['"]aria-hidden['"]/);
});

test('Round 32 compatibility code no longer reacts to root class transitions or observes Match Center DOM', async () => {
  const source = await read('../src/v23.3/round31-match-center-stability.mjs');

  assert.doesNotMatch(source, /MutationObserver/);
  assert.doesNotMatch(source, /observer\?\.observe\?\./);
  assert.doesNotMatch(source, /subtree:true/);
  assert.doesNotMatch(source, /observer\?\.observe\?\.\(matchesOverlay/);
});

test('Round 32 compatibility code no longer owns the outer tournament header or viewport lifecycle', async () => {
  const source = await read('../src/v23.3/round31-match-center-stability.mjs');

  assert.doesNotMatch(source, /OWNED_CLASS/);
  assert.doesNotMatch(source, /syncViewportOwnership/);
  assert.doesNotMatch(source, /html\.\$\{OWNED_CLASS\} #ciao-v232-matches-overlay/);
});

test('Round 32 has a dedicated live deployment probe for the viewport-owner regression', async () => {
  const probe = await read('../scripts/probe-round32-deployment.mjs');
  assert.match(probe, /USER_FEEDBACK_ROUND32_BUILD/);
  assert.match(probe, /USER_FEEDBACK_ROUND38_LIFECYCLE_BUILD/);
  assert.match(probe, /match-center-lifecycle\.mjs/);
  assert.match(probe, /noLegacyViewportOwner/);
  assert.match(probe, /singleLifecycleOwner/);
});

test('Round 32 live probe now validates the Round 38 lifecycle owner instead of the superseded legacy close path', async () => {
  const probe = await read('../scripts/probe-round32-deployment.mjs');
  assert.match(probe, /cw238-match-center-owned/);
  assert.match(probe, /cw238MatchCenterSuspended/);
  assert.match(probe, /restoreMatchSource/);
  assert.doesNotMatch(probe, /syncViewportOwnership/);
  assert.doesNotMatch(probe, /__cw233R21FinalClose/);
});

test('Round 32 live probe is a required develop-push gate and uploads its observation', async () => {
  const workflow = await read('../../.github/workflows/ciao-test-check.yml');
  assert.match(workflow, /Probe deployed Round 32 fixes/);
  assert.match(workflow, /node scripts\/probe-round32-deployment\.mjs/);
  assert.match(workflow, /name: ciao-v23-3-round32-deployment/);
  assert.match(workflow, /path: cloudflare-test\/artifacts\/v23-3-round32-deployment\.json/);
});
