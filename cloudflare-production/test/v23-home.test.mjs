import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../src/v23/index.html',import.meta.url),'utf8');

function between(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0,`missing start marker: ${start}`);
  assert.ok(b>a,`missing end marker: ${end}`);
  return source.slice(a,b);
}

test('v23 Home transforms its generated HTML before it reaches the live DOM',()=>{
  assert.match(source,/ciao-v23-native-home-20260908/);
  assert.doesNotMatch(source,/ciao-prod-home-calcio-polish-20260908/);
  assert.doesNotMatch(source,/ciao-prod-home-calcio-safety-20260908/);
  const home=between('/* ciao-v23-native-home-20260908 */','/* /ciao-v23-native-home-20260908 */');
  assert.match(home,/const __cw23HomeRenderBase=predict/);
  assert.match(home,/function __cw23RenderHomeHtml\s*\(/);
  assert.match(home,/document\.createElement\(['"]div['"]\)/);
  assert.match(home,/parent\.insertBefore\(card,favorite\)/);
  assert.match(home,/return box\.innerHTML/);
});

test('v23 Home contains the approved profile, favorite and Calcio contracts',()=>{
  const home=between('/* ciao-v23-native-home-20260908 */','/* /ciao-v23-native-home-20260908 */');
  assert.match(home,/cw-home-user-card/);
  assert.match(home,/cw-home-profile-premium/);
  assert.match(home,/Ближайший матч/);
  assert.match(home,/__cwHomeOpponentCrest/);
  assert.match(home,/data-cw-home-match/);
  assert.match(home,/data-cw-home-competition/);
  assert.match(home,/Кальчо сегодня/);
  assert.match(home,/Матчи итальянских клубов/);
  for(const competition of ['serie_a','coppa_italia','ucl','uel','uecl']) assert.match(home,new RegExp(competition));
});

test('legacy favorite refresh can no longer overwrite native v23 Home markup',()=>{
  const patch=between('function __cw20PatchFavoriteHome(){','async function __cw20LoadFavoriteStable');
  assert.match(patch,/render\(\)/);
  assert.doesNotMatch(patch,/replaceWith\(/);
});
