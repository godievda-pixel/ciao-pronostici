import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_SOURCE_URL } from '../scripts/build.mjs';

function snippets(source, regex, limit=8, radius=260) {
  const out=[];
  for (const match of source.matchAll(regex)) {
    const index=match.index ?? 0;
    out.push(source.slice(Math.max(0,index-radius), Math.min(source.length,index+match[0].length+radius)).replace(/\s+/g,' '));
    if(out.length>=limit) break;
  }
  return out;
}

test('diagnostic: report true capture click listeners and bottom overlays', async () => {
  const response = await fetch(RELEASE_SOURCE_URL, { headers:{ 'cache-control':'no-cache' } });
  assert.equal(response.ok, true, `release source HTTP ${response.status}`);
  const html = await response.text();
  const report = {
    trueCapture: snippets(html, /(?:document|window|root|main|[A-Za-z_$][\w$]*)\.addEventListener\s*\(\s*['"]click['"][\s\S]{0,1800}?,\s*true\s*\)/gi, 5, 420),
    captureOption: snippets(html, /(?:document|window|root|main|[A-Za-z_$][\w$]*)\.addEventListener\s*\(\s*['"]click['"][\s\S]{0,1800}?capture\s*:\s*true[\s\S]{0,120}?\)/gi, 5, 420),
    navButtonPointer: snippets(html, /\.nav\s+button[^\{]*\{[^}]*pointer-events[^}]*\}/gi, 10, 100),
    fixedHighZ: snippets(html, /[^{}]{0,120}\{[^{}]*(?:position\s*:\s*fixed|position\s*:\s*absolute)[^{}]*z-index\s*:\s*(?:[2-9]\d|[1-9]\d{2,})[^{}]*\}/gi, 16, 60),
  };
  assert.fail(`EVENTDIAG ${JSON.stringify(report)}`);
});
