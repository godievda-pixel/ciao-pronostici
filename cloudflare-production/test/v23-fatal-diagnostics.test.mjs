import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/v23/app.mjs';

function fakeRuntime(){
  const root={innerHTML:'',listeners:new Map(),addEventListener(type,handler){this.listeners.set(type,handler);},removeEventListener(){}};
  const location={pathname:'/home'};
  const history={state:null,replaceState(state,_title,path){this.state=state;location.pathname=path;},pushState(state,_title,path){this.state=state;location.pathname=path;},back(){}};
  const windowRef={history,location,scrollY:0,scrollTo(){},addEventListener(){},removeEventListener(){}};
  const documentRef={getElementById(id){return id==='app'?root:null;}};
  const telegram={initData(){return 'signed';},ready(){},expand(){},setBackVisible(){},onBack(){return()=>{};}};
  return {root,windowRef,documentRef,telegram};
}

test('fatal standalone screen shows only safe normalized API message and code', async()=>{
  const {root,windowRef,documentRef,telegram}=fakeRuntime();
  const api={async call(){throw Object.freeze({code:'team_localization_missing',message:'Не удалось выполнить запрос',status:500,rawBody:'SECRET'});}};
  const app=createApp({documentRef,windowRef,telegram,api,timeZone:'Europe/Stockholm'});
  await app.start();
  assert.match(root.innerHTML,/Не удалось выполнить запрос/);
  assert.match(root.innerHTML,/team_localization_missing/);
  assert.doesNotMatch(root.innerHTML,/SECRET/);
});
