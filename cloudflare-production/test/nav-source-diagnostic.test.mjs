import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_SOURCE_URL } from '../scripts/build.mjs';

function snippets(source, regex, limit=3, radius=80) {
  const out=[];
  for (const match of source.matchAll(regex)) {
    const index=match.index ?? 0;
    out.push(source.slice(Math.max(0,index-radius), Math.min(source.length,index+match[0].length+radius)).replace(/\s+/g,' '));
    if(out.length>=limit) break;
  }
  return out;
}
function count(source, regex){ return Array.from(source.matchAll(regex)).length; }

test('diagnostic: report exact legacy bottom-nav listener code', async () => {
  const response = await fetch(RELEASE_SOURCE_URL, { headers:{ 'cache-control':'no-cache' } });
  assert.equal(response.ok, true, `release source HTTP ${response.status}`);
  const html = await response.text();
  const report = {
    navQuery: snippets(html, /querySelectorAll\(\s*['"]\.nav button['"]\s*\)[\s\S]{0,420}/gi),
    navClosest: snippets(html, /closest\(\s*['"]\.nav button['"]\s*\)[\s\S]{0,260}/gi),
    datasetTab: snippets(html, /dataset\.tab[\s\S]{0,260}/gi),
    pointerdownCount: count(html, /addEventListener\s*\(\s*['"]pointerdown['"]/gi),
    stopImmediateCount: count(html, /stopImmediatePropagation\s*\(/gi),
    captureClickCount: count(html, /addEventListener\s*\(\s*['"]click['"][\s\S]{0,100}(?:true|capture)/gi),
  };
  assert.fail(`NAVDIAG ${JSON.stringify(report)}`);
});
