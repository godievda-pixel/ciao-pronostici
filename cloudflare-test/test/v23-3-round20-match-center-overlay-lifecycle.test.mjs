import test from 'node:test';
import assert from 'node:assert/strict';
import { applyHomeV233SourcePatch } from '../scripts/home-v23-3-source-patch.mjs';

function fixture() {
  return `
const __cw231HomeHtml = () => '';
let predict;
const root = document.body;
const main = document.body;
let matchReturnTab='predict',matchViewId=null,matchCenterTab='overview',matchData=null,matchLoading=false,tab='predict',clubViewId=null;
function matchCenterHtml(d){ return String(d); }
function matchTabContent(){ return ''; }
function bindMatchCenter(){}
function closeMatchCenter(){}
function patchMatchCenter(){}
async function refreshMatchCenter(){}
function render(){}
function openMatchCenter(){}
predict = __cw231HomeHtml;
`;
}

test('Round 20 adds one overlay lifecycle seam around the existing external legacy Match Center', () => {
  const patched = applyHomeV233SourcePatch(fixture());
  assert.match(patched, /cw233-external-match-overlay-lifecycle-r21/);
  assert.match(patched, /ciao-v232-matches-overlay/);
  assert.match(patched, /__cw233SuspendMatchesOverlay/);
  assert.match(patched, /__cw233R21MatchesOverlayState/);
  assert.match(patched, /matchesOverlayScrollTop/);
  assert.match(patched, /matchesOverlay\.hidden\s*=\s*true/);
  assert.match(patched, /ciao-v233-open-external-legacy-match/);
});

test('Round 20 restores the suspended Matches overlay after the real legacy Match Center closes', () => {
  const patched = applyHomeV233SourcePatch(fixture());
  assert.match(patched, /const __cw233R21FinalClose = closeMatchCenter/);
  assert.match(patched, /__cw233RestoreMatchesOverlay/);
  assert.match(patched, /const result = __cw233R21FinalClose\(\)/);
  assert.match(patched, /__cw233RestoreMatchesOverlay\(context\)/);
  assert.match(patched, /matchesOverlay\.hidden\s*=\s*false/);
  assert.match(patched, /matchesOverlay\.scrollTop\s*=\s*context\.matchesOverlayScrollTop/);
  assert.ok(
    patched.indexOf('const result = __cw233R21FinalClose()') < patched.indexOf('__cw233RestoreMatchesOverlay(context)'),
    'Legacy Match Center must close before the suspended Matches overlay is restored',
  );
});
