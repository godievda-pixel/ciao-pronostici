import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_SOURCE_URL } from '../scripts/build.mjs';

function snippets(source,needle,radius=420){
  const lower=source.toLowerCase();
  const wanted=needle.toLowerCase();
  const out=[];
  let at=0;
  while(out.length<8){
    const found=lower.indexOf(wanted,at);
    if(found<0)break;
    out.push(source.slice(Math.max(0,found-radius),Math.min(source.length,found+wanted.length+radius)).replace(/\s+/g,' '));
    at=found+wanted.length;
  }
  return out;
}

test('inspect stable v22.5 home anchors without mutating production',async()=>{
  const response=await fetch(RELEASE_SOURCE_URL,{headers:{'cache-control':'no-cache'}});
  assert.equal(response.ok,true,`release HTTP ${response.status}`);
  const html=await response.text();
  const report={
    favoriteHome:snippets(html,'cw18-favorite-home'),
    favoriteRender:snippets(html,'favoriteHome'),
    predictionRender:snippets(html,'function predict'),
    predictionAssign:snippets(html,'predict=function'),
    tabPredict:snippets(html,"data-tab=\\\"predict\\\""),
    tabMine:snippets(html,"data-tab=\\\"mine\\\""),
    tabTable:snippets(html,"data-tab=\\\"table\\\""),
    tabSerieA:snippets(html,"data-tab=\\\"seriea\\\""),
    renderSwitch:snippets(html,'S.tab'),
  };
  console.log(`LEGACY_HOME_DISCOVERY=${JSON.stringify(report)}`);
  assert.match(html,/id=["']ciao-miniapp-root["']/);
});
