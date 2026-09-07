import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchLegacyHttp, legacyErrorPayload } from '../compat-v22-5-http.mjs';

test('legacy suffix dispatches raw v22.5 payload without v23 envelope',async()=>{
  const seen=[];
  const dispatcher={dispatch:async(slug,body,context)=>{seen.push({slug,body,context});return {ok:true,selected_round:3};}};
  const result=await dispatchLegacyHttp({
    url:'https://test.supabase.co/functions/v1/ciao-v23-api/ciao-core-api-fast-v6',
    body:{action:'state',round:3},
    context:{userId:7,tgUser:{id:1001}},
    dispatcher,
  });
  assert.equal(result.handled,true);
  assert.deepEqual(result.data,{ok:true,selected_round:3});
  assert.equal(seen[0].slug,'ciao-core-api-fast-v6');
});

test('canonical v23 request without suffix is not intercepted',async()=>{
  const dispatcher={dispatch:async()=>{throw new Error('must_not_dispatch')}};
  const result=await dispatchLegacyHttp({url:'https://test.supabase.co/functions/v1/ciao-v23-api',body:{action:'bootstrap'},context:{},dispatcher});
  assert.deepEqual(result,{handled:false,data:null});
});

test('legacy errors use old flat error shape',()=>{
  const error=Object.assign(new Error('subscription_required'),{status:403,extra:{join_url:'https://t.me/CiaoCalcio'}});
  assert.deepEqual(legacyErrorPayload(error),{ok:false,error:'subscription_required',subscription_required:true,join_url:'https://t.me/CiaoCalcio'});
});
