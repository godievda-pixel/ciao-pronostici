import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_SOURCE_URL } from '../scripts/build.mjs';

function snippets(source,needle,radius=760){
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
    homeShell:snippets(html,'cw211-home-shell'),
    todayHtml:snippets(html,'__cw211TodayHtml'),
    favoriteDashboard:snippets(html,'__cw211FavoriteDashboard'),
    predictBase:snippets(html,'__cw211PredictBase'),
    dashboardBase:snippets(html,'FavoriteDashboard()+'),
    currentPredict:snippets(html,'cw211-today')
  };
  console.log(`LEGACY_HOME_DISCOVERY=${JSON.stringify(report)}`);
  assert.match(html,/id=["']ciao-miniapp-root["']/);
});
