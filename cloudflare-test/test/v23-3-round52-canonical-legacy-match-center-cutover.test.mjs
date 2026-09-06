import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyHomeV233SourcePatch } from '../scripts/home-v23-3-source-patch.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Round 52 canonical router opens the legacy Match Center boundary, never Round51.2', async () => {
  const source = await read('../src/v23.3/match-center-links.mjs');
  assert.match(source, /from '\.\/match-center\.mjs'/);
  assert.doesNotMatch(source, /round51-2-match-center/);
  assert.doesNotMatch(source, /CiaoV2512MatchCenterRuntime/);
});

test('Round 52 active module list contains no Round51 Match Center visual owner', async () => {
  const source = await read('../src/v23.3/index.mjs');
  assert.doesNotMatch(source, /round51-1-active-match-center-ui/);
  assert.doesNotMatch(source, /round51-2-match-center/);
  assert.match(source, /round51-1-current-round/);
});

test('v23.1 source patch remains the only rendered Match Center shell', () => {
  const fixture = `
const __cw231HomeHtml = () => '';
let predict;
const root = document.body;
const main = document.body;
let matchReturnTab='predict',matchViewId=null,matchCenterTab='overview',matchData=null,matchLoading=false,tab='predict';
function openMatchCenter(){}
function matchCenterHtml(d){ return String(d); }
function matchTabContent(){ return ''; }
function bindMatchCenter(){}
function closeMatchCenter(){}
function patchMatchCenter(){}
async function refreshMatchCenter(){}
function render(){}
predict = __cw231HomeHtml;
`;
  const patched = applyHomeV233SourcePatch(fixture);
  assert.match(patched, /ciao-v233-open-serie-a-match/);
  assert.match(patched, /ciao-v233-open-external-legacy-match/);
  assert.match(patched, /main\.innerHTML = matchCenterHtml\(matchData\)/);
  assert.match(patched, /bindMatchCenter\(\)/);
  assert.doesNotMatch(patched, /round51-2-bottom-drawer/);
});
