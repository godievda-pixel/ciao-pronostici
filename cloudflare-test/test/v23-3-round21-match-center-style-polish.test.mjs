import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyHomeV233SourcePatch } from '../scripts/home-v23-3-source-patch.mjs';

function legacyFixture() {
  return `
const API_BASE='/api';
const esc=s=>String(s);
const logo = t => t?.custom_emoji_id ? \`<img class="logo" width="48" height="48" loading="eager" decoding="sync" fetchpriority="auto" data-cw231-stable-logo-load="1" src="\${API_BASE}?asset=emoji&id=\${encodeURIComponent(t.custom_emoji_id)}" alt="">\` : '<span class="logo">⚽</span>';
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

test('Round 21 legacy Match Center logo helper renders BSD crest URLs before emoji fallback', () => {
  const patched = applyHomeV233SourcePatch(legacyFixture());
  assert.match(patched, /logo_url\s*\|\|\s*t\?\.logoUrl\s*\|\|\s*t\?\.crestUrl/);
  assert.match(patched, /src="\$\{esc\(directLogo\)\}"/);
  assert.match(patched, /custom_emoji_id/);
  assert.match(patched, /asset=emoji&id=/);
  assert.match(patched, /⚽/);
});

test('Round 21 external tournament theme outranks legacy #ciao-miniapp-root blue borders', () => {
  const source = readFileSync(new URL('../src/v23.3/legacy-match-center-theme.mjs', import.meta.url), 'utf8');
  for (const selector of ['.mc-toolbar', '.mc-hero', '.mc-tabs', '.mc-section']) {
    assert.match(
      source,
      new RegExp(`#ciao-miniapp-root\\[data-cw233-mc-competition\\] \\${selector.replace('.', '\\.')}`),
      `${selector} must be themed with root-id specificity`,
    );
  }
  assert.match(source, /border-color:var\(--cw233-mc-border\)/);
  assert.match(source, /data-cw233-mc-competition="coppa_italia"[\s\S]*--cw233-mc-border:rgba\(231,7,46,/);
});
