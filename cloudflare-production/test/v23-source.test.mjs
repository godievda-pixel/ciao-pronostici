import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl=new URL('../src/v23/index.html',import.meta.url);

test('v23 source is a tracked snapshot of current production behavior',async()=>{
  const html=await readFile(sourceUrl,'utf8');
  assert.match(html,/Ciao, Web!/);
  assert.match(html,/ciao-prod-home-calcio-polish-20260908/);
  assert.match(html,/ciao-prod-multitournament-predictions-20260907/);
  assert.doesNotMatch(html,/PLACEHOLDER|CAPTURE_ME|TODO_V23_SOURCE/);
});
