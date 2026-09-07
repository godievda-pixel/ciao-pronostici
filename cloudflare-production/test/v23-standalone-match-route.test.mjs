import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/v23/app.mjs';

const match={
  id:'ucl:77',providerMatchId:'77',competition:'ucl',competitionNameRu:'Лига чемпионов',season:'2026',
  stage:'Общий этап',round:null,kickoffAt:'2026-09-07T18:45:00.000Z',status:'live',minute:68,
  home:{id:'101',nameRu:'Интер'},away:{id:'202',nameRu:'Арсенал'},score:{home:2,away:1},
  isItalianRelevant:true,isQualification:false,
};

function fakeDom(pathname='/match/ucl/77/overview'){
  const root={
    innerHTML:'',listeners:new Map(),
    addEventListener(type,handler){this.listeners.set(type,handler);},
    removeEventListener(type,handler){if(this.listeners.get(type)===handler)this.listeners.delete(type);},
  };
  const location={pathname};
  const listeners=new Map();
  const history={
    state:null,
    replaceState(state,_title,path){this.state=state;location.pathname=path;},
    pushState(state,_title,path){this.state=state;location.pathname=path;},
    back(){},
  };
  const windowRef={
    history,location,scrollY:0,scrollTo(){},
    addEventListener(type,handler){listeners.set(type,handler);},
    removeEventListener(type,handler){if(listeners.get(type)===handler)listeners.delete(type);},
  };
  const documentRef={getElementById(id){return id==='app'?root:null;}};
  return {root,windowRef,documentRef};
}

function telegram(){
  return {
    initData(){return 'signed';},user(){return {id:11};},ready(){},expand(){},setBackVisible(){},
    onBack(){return()=>{};},safeArea(){return {top:0,right:0,bottom:0,left:0};},
  };
}

function target(dataset){return {dataset,closest(){return this;}};}

test('Match Center tab switch updates the canonical route section for refresh/deep-link restoration',async()=>{
  const {root,windowRef,documentRef}=fakeDom();
  const calls=[];
  const api={call:async(action,payload)=>{
    calls.push({action,payload});
    if(action!=='match_center')throw new Error(`unexpected:${action}`);
    return {match,data:payload.section==='events'?{incidents:[]}:{}};
  }};
  const app=createApp({documentRef,windowRef,api,telegram:telegram(),clock:()=>new Date('2026-09-07T17:00:00.000Z'),timeZone:'Europe/Berlin'});
  try{
    await app.start();
    assert.equal(windowRef.location.pathname,'/match/ucl/77/overview');

    const click=root.listeners.get('click');
    await click({target:target({action:'match-tab',section:'events'})});

    assert.equal(windowRef.location.pathname,'/match/ucl/77/events');
    assert.equal(app.current().section,'events');
    assert.ok(calls.some(call=>call.action==='match_center'&&call.payload.section==='events'));
  }finally{
    app.destroy();
  }
});
