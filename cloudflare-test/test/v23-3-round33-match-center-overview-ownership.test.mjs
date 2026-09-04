import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyRound34ExternalOverviewFormOnlySourcePatch } from '../scripts/round34-external-overview-form-only-source-patch.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

const legacyExternalOverviewShell = `
const __cw233Round33LegacyMatchTabContent = matchTabContent;
function __cw233Round33SanitizeExternalOverviewHtml(html){
  const holder = document.createElement('div');
  holder.innerHTML = String(html || '');
  for (const marker of holder.querySelectorAll?.('.cw14-form-card') || []) {
    const section = marker.closest?.('.mc-section') || marker.closest?.('section');
    (section || marker).remove?.();
  }
  for (const section of holder.querySelectorAll?.('.mc-section,section') || []) {
    if (/Контекст\\s+Серии\\s*[АA]/i.test(String(section?.textContent || ''))) section.remove?.();
  }
  return holder.innerHTML;
}
matchTabContent = function(d,key){
  const html = __cw233Round33LegacyMatchTabContent(d,key);
  if (!__cw233ExternalMatchContext || String(key || '') !== 'overview') return html;
  return __cw233Round33SanitizeExternalOverviewHtml(html);
};
const unrelatedOverviewBlock = 'KEEP_ME';
`;

test('external Overview removes only Form and leaves every other legacy block intact', () => {
  const patched = applyRound34ExternalOverviewFormOnlySourcePatch(legacyExternalOverviewShell);
  const start = patched.indexOf('function __cw233Round33IsFormSection');
  const end = patched.indexOf('matchTabContent = function', start);
  assert.ok(start >= 0, 'Form section detector must exist');
  assert.ok(end > start, 'external Overview sanitizer block must be present');
  const sanitizer = patched.slice(start, end);

  assert.match(sanitizer, /cw14-form-card/);
  assert.match(sanitizer, /Форма/);
  assert.doesNotMatch(sanitizer, /Контекст/);
  assert.doesNotMatch(sanitizer, /Серии/);
  assert.match(patched, /if \(!__cw233ExternalMatchContext \|\| String\(key \|\| ''\) !== 'overview'\) return html/);
  assert.match(patched, /unrelatedOverviewBlock = 'KEEP_ME'/);
});

test('Round 33 runtime no longer replaces external Overview with the minimal Round31 renderer', async () => {
  const source = await read('../src/v23.3/round31-match-center-stability.mjs');
  assert.doesNotMatch(source, /const nextHtml = renderRound31ExternalOverview\(activeExternal\.data\)/);
  assert.doesNotMatch(source, /stopImmediatePropagation\?\.\(\)[\s\S]{0,600}renderExternalOverview\(\)/);
});

test('Round 33 Matches lifecycle owns a persistent suspended marker until Match Center closes', async () => {
  const patch = await read('../scripts/home-v23-3-source-patch.mjs');
  assert.match(patch, /dataset\.cw233MatchCenterSuspended\s*=\s*['"]1['"]/);
  assert.match(patch, /delete matchesOverlay\.dataset\.cw233MatchCenterSuspended/);
  assert.match(patch, /data-cw233-match-center-suspended/);
});

test('Round 33 keeps only the inner Match Center back control visible when Matches is suspended', async () => {
  const patch = await read('../scripts/home-v23-3-source-patch.mjs');
  assert.match(patch, /#ciao-v232-matches-overlay\[data-cw233-match-center-suspended=['"]1['"]\]/);
  assert.match(patch, /display:none!important/);
});
