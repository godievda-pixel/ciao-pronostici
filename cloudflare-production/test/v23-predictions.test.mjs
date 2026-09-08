import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl=new URL('../src/v23/index.html',import.meta.url);

async function source(){return readFile(sourceUrl,'utf8')}

test('v23 prediction stage renderers are lock-free but actually disabled',async()=>{
  const html=await source();
  assert.match(html,/ciao-v23-native-predictions-20260908/);
  assert.match(html,/function __cw23SerieRoundBar\s*\(/);
  assert.match(html,/function __cw23ExternalStageBarHtml\s*\(/);
  assert.match(html,/disabled aria-disabled="true" tabindex="-1"/);
  const nativeStart=html.indexOf('ciao-v23-native-predictions-20260908');
  assert.ok(nativeStart>=0);
  const nativeEnd=html.indexOf('/ciao-v23-native-predictions-20260908',nativeStart);
  const native=html.slice(nativeStart,nativeEnd>nativeStart?nativeEnd:undefined);
  assert.doesNotMatch(native,/🔒|🔐/);
  assert.doesNotMatch(html,/ciao-prod-prediction-stage-lock-ui-20260907/);
});

test('v23 Mine cards render the approved unclipped missing-prediction state natively',async()=>{
  const html=await source();
  assert.match(html,/function __cw23MinePredictionBlock\s*\(/);
  assert.match(html,/ВАШ ПРОГНОЗ/);
  assert.match(html,/— : —/);
  assert.match(html,/Прогноз не сделан/);
  assert.match(html,/cw23-mine-missing/);
  assert.match(html,/cw23-mine-primary/);
  assert.doesNotMatch(html,/ciao-prod-prediction-mine-stage-polish-20260907/);
});
