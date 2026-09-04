import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('browser graph reaches the canonical Round 39 runtime without importing the legacy Match Center facade', async () => {
  const [index, home, links, runtime] = await Promise.all([
    read('../src/v23.3/index.mjs'),
    read('../src/v23.3/home-integration.mjs'),
    read('../src/v23.3/match-center-links.mjs'),
    read('../src/v23.3/match-center-runtime.mjs'),
  ]);

  assert.match(index, /import '\.\/home-integration\.mjs'/);
  assert.match(home, /from '\.\/match-center-links\.mjs'/);
  assert.match(home, /installCanonicalMatchLinks\(globalThis\.document\)/);
  assert.match(links, /from '\.\/match-center-runtime\.mjs'/);
  assert.match(runtime, /MATCH_CENTER_RUNTIME_BUILD = 'round39-canonical-match-center'/);

  assert.doesNotMatch(index, /import '\.\/match-center\.mjs'/);
  assert.doesNotMatch(home, /from '\.\/match-center\.mjs'/);
  assert.doesNotMatch(links, /from '\.\/match-center\.mjs'|CiaoV233Round37/);
  assert.doesNotMatch(runtime, /openMatchCenter|matchCenterHtml|external-legacy-match|open-serie-a-match/i);
});

test('Round 39 has a dedicated deployed artifact probe for the complete canonical Match Center graph', async () => {
  const probe = await read('../scripts/probe-round39-match-center.mjs');

  for (const moduleName of [
    'match-center-runtime.mjs',
    'match-center-links.mjs',
    'match-center-view.mjs',
    'match-center-store.mjs',
    'match-center-repository.mjs',
    'match-center-contract.mjs',
    'home-integration.mjs',
    'index.mjs',
  ]) assert.match(probe, new RegExp(moduleName.replaceAll('.', '\\.')));

  assert.match(probe, /round39-canonical-match-center/);
  assert.match(probe, /canonicalRouterOnly/);
  assert.match(probe, /canonicalView/);
  assert.match(probe, /singleStore/);
  assert.match(probe, /repositoryBoundary/);
  assert.match(probe, /canonicalContract/);
  assert.match(probe, /browserGraphWired/);
});

test('Round 39 deployed probe is a required develop-push gate and its evidence is uploaded', async () => {
  const workflow = await read('../../.github/workflows/ciao-test-check.yml');

  assert.match(workflow, /Probe deployed Round 39 canonical Match Center/);
  assert.match(workflow, /node scripts\/probe-round39-match-center\.mjs/);
  assert.match(workflow, /name: ciao-v23-3-round39-match-center/);
  assert.match(workflow, /path: cloudflare-test\/artifacts\/v23-3-round39-match-center\.json/);
});
