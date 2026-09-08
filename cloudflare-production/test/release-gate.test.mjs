import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseRevision } from '../scripts/release-revision.mjs';
import { runReleaseGate } from '../scripts/release-gate.mjs';

function response(body,{status=200,url='https://example.test/'}={}){
  return{
    ok:status>=200&&status<300,
    status,
    url,
    async text(){return typeof body==='string'?body:JSON.stringify(body)},
    async json(){return typeof body==='string'?JSON.parse(body):body},
  };
}

const CURRENT_MARKERS=[
  'try{__cwHomePolishDom();__cwHomeBindPolish()}catch(_e){}',
  'Кальчо сегодня',
  'cw-home-profile-premium',
  'disabled aria-disabled="true" tabindex="-1"',
];

function productionHtml(label='new'){
  return `<html>${label} ${CURRENT_MARKERS.join(' ')}</html>`;
}

test('release gate waits for matching Worker bytes before sync and Telegram propagation',async()=>{
  const html=productionHtml();
  const expected=releaseRevision(html);
  const calls=[];
  let workerChecks=0;
  let menuChecks=0;

  const fetchImpl=async(url)=>{
    const value=String(url);
    calls.push(value);
    if(value.startsWith('https://ciao-web-app.ciao-web.workers.dev/')){
      workerChecks+=1;
      return response(workerChecks===1?productionHtml('old'):html,{url:value});
    }
    if(value.includes('/release-sync?revision=')){
      return response({
        ok:true,
        live_revision:expected,
        web_app_url:`https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=${expected}`,
      });
    }
    if(value.includes('/ciao-telegram-entry-probe')){
      menuChecks+=1;
      return response({
        ok:true,
        menu_button:{
          web_app_url:menuChecks===1
            ?'old'
            :`https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=${expected}`,
        },
      });
    }
    if(value.startsWith('https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=')){
      return response(html,{url:'https://ciao-web-app.ciao-web.workers.dev/?v=1'});
    }
    throw new Error(`unexpected url ${url}`);
  };

  const result=await runReleaseGate({
    expectedRevision:expected,
    fetchImpl,
    sleep:async()=>{},
    workerAttempts:3,
    telegramAttempts:3,
  });

  assert.equal(result.revision,expected);
  const syncAt=calls.findIndex(x=>x.includes('/release-sync?revision='));
  const workerAt=calls.findIndex(x=>x.startsWith('https://ciao-web-app.ciao-web.workers.dev/'));
  assert.ok(workerAt>=0&&syncAt>workerAt);
  assert.equal(workerChecks,2);
  assert.equal(menuChecks,2);
});

test('release gate times out before Telegram sync when Worker bytes never match',async()=>{
  const expected=releaseRevision(productionHtml());
  let syncCalls=0;
  const fetchImpl=async(url)=>{
    const value=String(url);
    if(value.startsWith('https://ciao-web-app.ciao-web.workers.dev/'))return response(productionHtml('old'));
    if(value.includes('/release-sync'))syncCalls+=1;
    throw new Error('unexpected fetch');
  };

  await assert.rejects(
    runReleaseGate({expectedRevision:expected,fetchImpl,sleep:async()=>{},workerAttempts:2}),
    /Worker revision did not reach/,
  );
  assert.equal(syncCalls,0);
});
