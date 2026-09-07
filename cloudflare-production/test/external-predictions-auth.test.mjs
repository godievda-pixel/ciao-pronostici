import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeTelegramRequest, TelegramAuthError } from '../../supabase/functions/ciao-external-predictions/auth.mjs';

const enc=new TextEncoder();
async function hmac(keyBytes,message){const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(message)))}
const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
async function signedInitData(botToken,user){const p=new URLSearchParams();p.set('auth_date',String(Math.floor(Date.now()/1000)));p.set('query_id','AAE-test');p.set('user',JSON.stringify(user));const pairs=[...p.entries()].map(([k,v])=>`${k}=${v}`).sort().join('\n');const secret=await hmac(enc.encode('WebAppData'),botToken);p.set('hash',hex(await hmac(secret,pairs)));return p.toString()}

function fakeDb(row){return{from(name){assert.equal(name,'cp_users');return{select(){return this},eq(){return this},async maybeSingle(){return{data:row,error:null}},insert(){throw new Error('unexpected insert')},update(){throw new Error('unexpected update')}}}}}

test('valid Telegram WebApp signature plus CiaoCalcio membership resolves existing user',async()=>{
  const token='123456:TEST_TOKEN';const raw=await signedInitData(token,{id:123,first_name:'Daniil',username:'danya'});const req=new Request('https://x',{headers:{'x-telegram-init-data':raw}});
  const fetchImpl=async()=>new Response(JSON.stringify({ok:true,result:{status:'member'}}),{status:200,headers:{'content-type':'application/json'}});
  const result=await authorizeTelegramRequest(req,{db:fakeDb({id:7,telegram_id:123,display_name:'Daniil',username:'danya',is_active:true}),botToken:token,fetchImpl});
  assert.equal(result.user.id,7);assert.equal(result.telegramUser.id,123);
});

test('authorization errors do not leak bot token',async()=>{
  const token='secret-token';const req=new Request('https://x',{headers:{'x-telegram-init-data':'auth_date=1&hash=nope'}});
  await assert.rejects(()=>authorizeTelegramRequest(req,{db:fakeDb(null),botToken:token,fetchImpl:fetch}),err=>err instanceof TelegramAuthError&&!String(err.message).includes(token));
});
