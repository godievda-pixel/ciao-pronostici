import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl=new URL('../src/v23/index.html',import.meta.url);

async function source(){return readFile(sourceUrl,'utf8')}

test('v23 Home is rendered natively in profile -> favorite -> Calcio order',async()=>{
  const html=await source();
  assert.match(html,/ciao-v23-native-home-20260908/);
  assert.match(html,/function __cw23HomeHtml\s*\(/);
  assert.match(html,/return\s+__cw23ProfileHtml\(\)\+__cw23FavoriteHome\(\)\+__cw23CalcioTodayHtml\(\)/);
  assert.match(html,/predict\s*=\s*function\s*\(\)\s*\{\s*return\s+__cw23HomeHtml\(\)\s*\}/);
  assert.doesNotMatch(html,/ciao-prod-home-calcio-polish-20260908/);
  assert.doesNotMatch(html,/ciao-prod-home-calcio-safety-20260908/);
});

test('v23 favorite card and Calcio Today are native match-center surfaces',async()=>{
  const html=await source();
  assert.match(html,/Кальчо сегодня/);
  assert.match(html,/cw23-profile-card/);
  assert.match(html,/cw23-favorite-card/);
  assert.match(html,/cw23-profile-club-premium/);
  assert.match(html,/function __cw23NearestFavoriteMatch\s*\(/);
  assert.match(html,/function __cw23OpponentCrest\s*\(/);
  assert.match(html,/data-cw23-match=/);
  assert.match(html,/data-cw23-competition=/);
  assert.match(html,/function __cw23CalcioTodayMatches\s*\(/);
  for(const competition of ['serie_a','coppa_italia','ucl','uel','uecl']) assert.match(html,new RegExp(competition));
});
