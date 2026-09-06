import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_SOURCE_URL } from '../scripts/build.mjs';

function clip(value, limit=700) {
  return String(value || '').replace(/\s+/g, ' ').slice(0, limit);
}

function matches(source, regex, limit=8) {
  return Array.from(source.matchAll(regex), m => clip(m[0])).slice(0, limit);
}

test('diagnostic: report exact legacy bottom-nav listener code', async () => {
  const response = await fetch(RELEASE_SOURCE_URL, { headers:{ 'cache-control':'no-cache' } });
  assert.equal(response.ok, true, `release source HTTP ${response.status}`);
  const html = await response.text();
  const report = {
    navForEach: matches(html, /querySelectorAll\(\s*['"]\.nav button['"]\s*\)[\s\S]{0,700}?addEventListener\([\s\S]{0,450}/gi, 4),
    buttonClick: matches(html, /(?:\b\w+|\))\.addEventListener\(\s*['"]click['"][\s\S]{0,600}/gi, 12),
    dataTabHandlers: matches(html, /(?:dataset\.tab|\[data-tab\])[\s\S]{0,520}?(?:addEventListener|onclick|render\()/gi, 8),
    stopImmediate: matches(html, /[\s\S]{0,180}stopImmediatePropagation\s*\([\s\S]{0,240}/gi, 8),
  };
  assert.fail(`NAVDIAG ${JSON.stringify(report)}`);
});
