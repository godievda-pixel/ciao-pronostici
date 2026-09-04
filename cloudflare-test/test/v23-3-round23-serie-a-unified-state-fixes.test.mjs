import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyHomeV233SourcePatch } from '../scripts/home-v23-3-source-patch.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

const legacyFixture = `
const __cw231HomeHtml = () => '';
let predict;
const root = document.body;
const main = document.body;
let matchReturnTab='calendar',matchViewId=null,matchCenterTab='overview',matchData=null,matchLoading=false,tab='calendar';
function matchCenterHtml(d){ return String(d); }
function matchTabContent(d, activeTab){ return String(activeTab) + String(d); }
function bindMatchCenter(){}
function closeMatchCenter(){}
function patchMatchCenter(){}
async function refreshMatchCenter(){}
function render(){}
predict = __cw231HomeHtml;
refreshMatchCenter=async function(){ return 'cw20-final'; };
/* ===== /Ciao, Web! v20.15 stable match center live patch ===== */
`;

test('Round 23 toolbar frame stays removed while the Match Center back control remains available', async () => {
  const source = await read('../src/v23.3/legacy-match-center-theme.mjs');
  assert.doesNotMatch(source, /match-center-open:not\(\[data-cw233-mc-competition\]\)[\s\S]*?\.mc-back[\s\S]*?display:\s*none!important/);
  assert.match(source, /match-center-open \.mc-back[\s\S]*?display:\s*flex!important/);
  assert.match(source, /match-center-open \.mc-toolbar[\s\S]*?border-bottom:\s*0!important/);
});

test('Round 23 context surfaces and lineup switches inherit current tournament variables', async () => {
  const source = await read('../src/v23.3/legacy-match-center-theme.mjs');
  for (const selector of ['.cw14-info-item', '.cw14-form-card']) {
    assert.ok(source.includes(`#ciao-miniapp-root.match-center-open ${selector}`), `${selector} must remain competition-themed`);
  }
  assert.match(source, /\.cw14-info-item,[\s\S]*?\.cw14-form-card[\s\S]*?var\(--cw233-mc-accent\)[\s\S]*?var\(--cw233-mc-accent-2\)/);
  for (const selector of ['.cw20-stat-mini', '.cw20-player-row', '.cw20-event-card']) {
    assert.match(source, new RegExp(selector.replace('.', '\\.') + '[\\s\\S]*?background:var\\(--cw233-mc-surface\\)!important'));
  }
  assert.match(source, /\.mc-lineup-switch button[\s\S]*?background:var\(--cw233-mc-surface\)!important/);
  assert.match(source, /\.mc-lineup-switch button(?:\.active|\[aria-selected=['"]true['"]\])[\s\S]*?linear-gradient\(135deg,var\(--cw233-mc-accent\),var\(--cw233-mc-accent-2\)\)/);
});

test('Round 23 never restores the Matches overlay after navigation left calendar', () => {
  const patched = applyHomeV233SourcePatch(legacyFixture);
  assert.match(patched, /cw233-round23-unified-state-fixes/);
  assert.match(patched, /if\s*\(tab\s*!==\s*['"]calendar['"]\)\s*return/);
  assert.match(patched, /button\[data-tab\][\s\S]*?cw233R21MatchesOverlayState\s*=\s*null/);
});

test('Round 23 external Match Center tabs render locally from the current external snapshot', () => {
  const patched = applyHomeV233SourcePatch(legacyFixture);
  assert.match(patched, /__cw233ExternalMatchContext[\s\S]*?data-mc-tab/);
  assert.match(patched, /matchCenterTab\s*=\s*nextTab/);
  assert.match(patched, /matchTabContent\(matchData,\s*nextTab\)/);
  assert.match(patched, /data-mc-tab-content/);
  const round23 = patched.slice(patched.indexOf('cw233-round23-unified-state-fixes'));
  assert.doesNotMatch(round23, /matchApi\(matchViewId\)/);
});

test('Round 23 Serie A Predictions use the same #0C5AA8 / #287FC7 palette as Match Center', async () => {
  const source = await read('../src/v23.3/round11-performance-themes.mjs');
  assert.match(source, /--r11a:#0c5aa8;--r11b:#287fc7/);
  assert.match(source, /linear-gradient\(165deg,#071626 0%,#061321 48%,#050f1a 100%\)/);
});

test('Round 23 Serie A Matches ambience uses the same Match Center palette', async () => {
  const source = await read('../src/v23.3/round10-regression-fixes.mjs');
  assert.match(source, /data-cw233-round10-theme=['"]serie-a['"][\s\S]*?#071626/);
  assert.match(source, /html\.cw233-serie-a-active #ciao-miniapp-root \.content[\s\S]*?#071626/);
  assert.match(source, /rgba\(12,90,168,/);
  assert.match(source, /rgba\(40,127,199,/);
});
