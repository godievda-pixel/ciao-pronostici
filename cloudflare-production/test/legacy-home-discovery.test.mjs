import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_SOURCE_URL } from '../scripts/build.mjs';

function snippets(source,needle,radius=1400,limit=4){
  const lower=source.toLowerCase();
  const wanted=needle.toLowerCase();
  const out=[];
  let at=0;
  while(out.length<limit){
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
    predictFunction:snippets(html,'function predict(',2200,3),
    favoriteCall:snippets(html,'__cw18FavoriteHome()',1800,4),
    favoriteDashboard:snippets(html,'__cw211FavoriteDashboard()',1600,4),
    todayCall:snippets(html,'__cw211TodayHtml()',1600,4),
    savebar:snippets(html,'class=\\"savebar\\"',1800,4),
    predictionCard:snippets(html,'pred-card',1800,4),
    predictionData:snippets(html,'data-mid=',1800,4),
  };
  console.log(`LEGACY_HOME_DISCOVERY=${JSON.stringify(report)}`);
  assert.match(html,/id=["']ciao-miniapp-root["']/);
});
