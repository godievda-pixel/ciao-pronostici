import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderTablesHub } from '../src/v23.3/tables-ui.mjs';

test('standings are compact before mounting', () => {
  const html = renderTablesHub({
    selectedCompetition:'serie_a',
    data:{ rows:[{ position:1, played:2, goalDifference:8, points:6, team:{ id:1, name:'Рома', crestUrl:'/roma.png' } }] },
  });
  assert.match(html, /<th>#<\/th><th>Команда<\/th><th>И<\/th><th>РМ<\/th><th>О<\/th>/);
  assert.doesNotMatch(html, /<th>В<\/th>|<th>Н<\/th>|<th>П<\/th>|<th>Г<\/th>/);
  assert.match(html, /width="36" height="36"/);
});

test('qualification zones use premium row treatment instead of strip-only marker', async () => {
  const source = await readFile(new URL('../src/v23.3/tables-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /cw233-zone--ucl/);
  assert.match(source, /box-shadow:inset 0 0 0 1px/);
  assert.match(source, /radial-gradient|linear-gradient/);
  assert.doesNotMatch(source, /td:first-child:before\{content:"";position:absolute;left:0;top:9px;bottom:9px;width:3px/);
});

test('Round 37 has no standings DOM compaction observer', async () => {
  const source = await readFile(new URL('../src/v23.3/round37-runtime.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /compactStandingTable|compactTables|MutationObserver/);
});
