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

test('Round 32 open events do not mutate/hide the Matches overlay before the legacy lifecycle captures it', async () => {
  const source = await read('../src/v23.3/round31-match-center-stability.mjs');
  const externalOpen = functionBody(source, 'onExternalOpen');
  const serieAOpen = functionBody(source, 'onSerieAOpen');

  assert.doesNotMatch(externalOpen, /claimViewport\s*\(/);
  assert.doesNotMatch(serieAOpen, /claimViewport\s*\(/);
  assert.doesNotMatch(source, /overlay\.hidden\s*=\s*true/);
  assert.doesNotMatch(source, /overlay\?\.setAttribute\?\.\(['"]aria-hidden['"]/);
});

test('Round 32 Match Center ownership reacts only to root open/close class transitions, not its own subtree mutations', async () => {
  const source = await read('../src/v23.3/round31-match-center-stability.mjs');

  assert.match(source, /observer\?\.observe\?\.\(root,\s*\{\s*attributes:true,\s*attributeFilter:\['class'\]\s*\}\)/s);
  assert.doesNotMatch(source, /subtree:true/);
  assert.doesNotMatch(source, /observer\?\.observe\?\.\(matchesOverlay/);
});

test('Round 32 keeps the outer tournament header hidden by ownership CSS while leaving the real overlay state to the legacy close/restore lifecycle', async () => {
  const source = await read('../src/v23.3/round31-match-center-stability.mjs');

  assert.match(source, /html\.\$\{OWNED_CLASS\} #ciao-v232-matches-overlay\s*\{[^}]*display:none!important/s);
  assert.match(source, /const syncViewportOwnership = \(\) =>/);
  assert.match(source, /root\.classList\?\.contains\?\.\('match-center-open'\)[\s\S]*html\?\.classList\?\.add\?\.\(OWNED_CLASS\)/);
});

test('Round 32 has a dedicated live deployment probe for the viewport-owner regression', async () => {
  const probe = await read('../scripts/probe-round32-deployment.mjs');
  assert.match(probe, /USER_FEEDBACK_ROUND32_BUILD/);
  assert.match(probe, /syncViewportOwnership/);
  assert.match(probe, /__cw233SuspendMatchesOverlay/);
  assert.match(probe, /ciao-v233-open-external-legacy-match/);
  assert.match(probe, /ciao-v233-open-serie-a-match/);
  assert.match(probe, /observer\\\?\\\.observe/);
  assert.match(probe, /overlay\\\.hidden/);
});

test('Round 32 live probe is a required develop-push gate and uploads its observation', async () => {
  const workflow = await read('../../.github/workflows/ciao-test-check.yml');
  assert.match(workflow, /Probe deployed Round 32 fixes/);
  assert.match(workflow, /node scripts\/probe-round32-deployment\.mjs/);
  assert.match(workflow, /name: ciao-v23-3-round32-deployment/);
  assert.match(workflow, /path: cloudflare-test\/artifacts\/v23-3-round32-deployment\.json/);
});
