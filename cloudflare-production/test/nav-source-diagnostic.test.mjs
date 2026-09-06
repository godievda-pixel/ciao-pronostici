import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_SOURCE_URL } from '../scripts/build.mjs';

function snippets(source, regex, limit=8, radius=320) {
  const out=[];
  for (const match of source.matchAll(regex)) {
    const index=match.index ?? 0;
    out.push(source.slice(Math.max(0,index-radius), Math.min(source.length,index+match[0].length+radius)).replace(/\s+/g,' '));
    if(out.length>=limit) break;
  }
  return out;
}

test('diagnostic: report click capture and savebar/nav stacking contract', async () => {
  const response = await fetch(RELEASE_SOURCE_URL, { headers:{ 'cache-control':'no-cache' } });
  assert.equal(response.ok, true, `release source HTTP ${response.status}`);
  const html = await response.text();
  const report = {
    captureClick: snippets(html, /addEventListener\s*\(\s*['"]click['"][\s\S]{0,180}(?:true|capture)/gi, 3, 500),
    savebarCss: snippets(html, /(?:#ciao-miniapp-root\s+)?\.savebar\s*\{[^}]*\}/gi, 10, 80),
    navCss: snippets(html, /(?:#ciao-miniapp-root\s+)?\.nav\s*\{[^}]*\}/gi, 10, 80),
    savebarMarkup: snippets(html, /<[^>]+class=["'][^"']*savebar[^"']*["'][^>]*>/gi, 5, 360),
  };
  assert.fail(`STACKDIAG ${JSON.stringify(report)}`);
});
