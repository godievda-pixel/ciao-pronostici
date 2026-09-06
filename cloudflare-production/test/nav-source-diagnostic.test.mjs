import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_SOURCE_URL } from '../scripts/build.mjs';

function snippets(source, regex, limit=16, radius=260) {
  const out=[];
  for (const match of source.matchAll(regex)) {
    const index=match.index ?? 0;
    out.push(source.slice(Math.max(0,index-radius), Math.min(source.length,index+match[0].length+radius)).replace(/\s+/g,' '));
    if(out.length>=limit) break;
  }
  return out;
}

test('diagnostic: report legacy bottom-nav event ownership in production source', async () => {
  const response = await fetch(RELEASE_SOURCE_URL, { headers:{ 'cache-control':'no-cache' } });
  assert.equal(response.ok, true, `release source HTTP ${response.status}`);
  const html = await response.text();
  const report = {
    navButtons: snippets(html, /\.nav\s+button/gi),
    dataTab: snippets(html, /dataset\.tab|data-tab/gi),
    pointerdown: snippets(html, /addEventListener\s*\(\s*['"]pointerdown['"]/gi),
    clickCapture: snippets(html, /addEventListener\s*\(\s*['"]click['"][\s\S]{0,120}(?:true|capture)/gi),
    stopImmediate: snippets(html, /stopImmediatePropagation\s*\(/gi),
  };
  assert.fail(`production nav event diagnostics: ${JSON.stringify(report)}`);
});
