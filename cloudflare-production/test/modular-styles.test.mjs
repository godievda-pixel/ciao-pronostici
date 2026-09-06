import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');

const REQUIRED_STYLES=Object.freeze([
  './ui/home-matches.css',
  './ui/match-center.css',
  './ui/matches.css',
  './ui/predictions.css',
  './ui/ranking.css',
  './ui/tables.css',
]);

test('app.css loads every modular screen stylesheet exactly once',async()=>{
  const css=await readFile(resolve(root,'src/modular/app.css'),'utf8');
  for(const href of REQUIRED_STYLES){
    const escaped=href.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const matches=css.match(new RegExp(`@import\\s+(?:url\\()?['\"]${escaped}['\"]\\)?\\s*;`,'g'))||[];
    assert.equal(matches.length,1,`${href} must be imported exactly once`);
  }
});

test('app.css gives the modular host an isolated production surface without restyling legacy content',async()=>{
  const css=await readFile(resolve(root,'src/modular/app.css'),'utf8');
  assert.match(css,/\.ciao-modular-host\s*\{/);
  assert.match(css,/\.ciao-modular-host\s*\{[^}]*box-sizing\s*:\s*border-box/s);
  assert.doesNotMatch(css,/(^|\})\s*(body|html|#ciao-miniapp-root)\s*\{/m);
});
