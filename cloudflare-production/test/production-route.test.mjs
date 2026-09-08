import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entryHtml=readFileSync(new URL('../../index.html',import.meta.url),'utf8');

test('dynamic production entry accepts the exact active Cloudflare Worker while retaining GitHub fallback support',()=>{
  assert.match(entryHtml,/godievda-pixel\.github\.io/);
  assert.match(entryHtml,/ciao-web-app\.ciao-web\.workers\.dev/);
  assert.match(entryHtml,/u\.protocol!==['"]https:['"]/);
});
