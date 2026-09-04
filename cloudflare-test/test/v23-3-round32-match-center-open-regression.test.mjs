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
