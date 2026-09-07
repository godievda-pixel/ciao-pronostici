import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmojiAssetService } from '../services/compat-v22-5-emoji.mjs';

test('emoji asset is resolved through Telegram and never through a production API',async()=>{
  const calls=[];
  const telegram=async(method,body)=>{calls.push([method,body]);if(method==='getCustomEmojiStickers')return {ok:true,result:[{file_id:'file-1'}]};if(method==='getFile')return {ok:true,result:{file_path:'stickers/a.webp'}};throw new Error('unexpected');};
  const fetchImpl=async url=>{calls.push(['fetch',url]);return new Response('image',{status:200,headers:{'content-type':'image/webp'}});};
  const service=createEmojiAssetService({telegram,fetchImpl,botToken:'TEST_TOKEN'});
  const response=await service.get('123456');
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'image/webp');
  assert.match(String(calls.at(-1)[1]),/^https:\/\/api\.telegram\.org\/file\/botTEST_TOKEN\/stickers\/a\.webp$/);
  assert.equal(calls.some(call=>String(call[1]??'').includes('supabase.co')),false);
});

test('invalid custom emoji id fails before Telegram calls',async()=>{
  let called=false;
  const service=createEmojiAssetService({telegram:async()=>{called=true;},fetchImpl:fetch,botToken:'x'});
  const response=await service.get('bad-id');
  assert.equal(response.status,400);
  assert.equal(called,false);
});
