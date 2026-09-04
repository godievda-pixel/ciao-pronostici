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

test('Round 20 external legacy bridge suspends the Matches overlay before mounting Match Center', () => {
  const patched = applyHomeV233SourcePatch(fixture());
  assert.match(patched, /ciao-v232-matches-overlay/);
  assert.match(patched, /matchesOverlayWasVisible/);
  assert.match(patched, /matchesOverlayScrollTop/);
  assert.match(patched, /matchesOverlay\.hidden\s*=\s*true/);
  assert.match(patched, /main\.innerHTML\s*=\s*matchCenterHtml\(matchData\)/);
  assert.ok(
    patched.indexOf('matchesOverlay.hidden = true') < patched.indexOf('main.innerHTML = matchCenterHtml(matchData)'),
    'Matches overlay must be hidden before legacy Match Center is mounted',
  );
});

test('Round 20 external legacy close restores the same Matches overlay and scroll position', () => {
  const patched = applyHomeV233SourcePatch(fixture());
  assert.match(patched, /__cw233RestoreMatchesOverlay/);
  assert.match(patched, /matchesOverlay\.hidden\s*=\s*false/);
  assert.match(patched, /matchesOverlay\.scrollTop\s*=\s*context\.matchesOverlayScrollTop/);
  assert.match(patched, /const result = __cw233LegacyFinalClose\(\)/);
  assert.ok(
    patched.indexOf('const result = __cw233LegacyFinalClose()') < patched.indexOf('__cw233RestoreMatchesOverlay(context)'),
    'Legacy Match Center must close before the suspended Matches overlay is restored',
  );
});
