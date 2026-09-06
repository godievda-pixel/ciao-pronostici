import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_SOURCE_URL } from '../scripts/build.mjs';

function snippets(source, regex, limit=12, radius=180) {
  const out=[];
  for (const match of source.matchAll(regex)) {
    const index=match.index ?? 0;
    out.push(source.slice(Math.max(0,index-radius), Math.min(source.length,index+match[0].length+radius)).replace(/\s+/g,' '));
    if(out.length>=limit) break;
  }
  return out;
}

test('diagnostic: report legacy root replacement operations in production source', async () => {
  const response = await fetch(RELEASE_SOURCE_URL, { headers:{ 'cache-control':'no-cache' } });
  assert.equal(response.ok, true, `release source HTTP ${response.status}`);
  const html = await response.text();
  const report = {
    root: snippets(html, /ciao-miniapp-root/gi),
    documentWrite: snippets(html, /document\.(?:open|write|close)\s*\(/gi),
    innerHtml: snippets(html, /(?:document\.(?:body|documentElement)|[A-Za-z_$][\w$]*)\.innerHTML\s*=/gi),
    replacement: snippets(html, /\.(?:replaceChildren|replaceWith)\s*\(|\.outerHTML\s*=/gi),
  };
  assert.fail(`production root diagnostics: ${JSON.stringify(report)}`);
});
