import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  NOTIFICATION_SETTINGS,
  loadProfileSettings,
  renderProfileSettings,
  saveFavorite,
  saveNotificationSetting,
} from '../src/v23/screens/profile-settings.mjs';
import { createApp } from '../src/v23/app.mjs';
import { parseRoute, serializeRoute } from '../src/v23/core/route-codec.mjs';

function createFakeDom(pathname='/broken-route'){
  const root={
    innerHTML:'',
    listeners:new Map(),
    addEventListener(type,handler){this.listeners.set(type,handler);},
    removeEventListener(type,handler){if(this.listeners.get(type)===handler)this.listeners.delete(type);},
  };
  const location={pathname};
  const windowListeners=new Map();
  const history={
    state:null,
    replaceState(state,_title,path){this.state=state;location.pathname=path;},
    pushState(state,_title,path){this.state=state;location.pathname=path;},
    back(){},
  };
  const windowRef={
    history,
    location,
    scrollY:0,
    scrollTo(){},
    addEventListener(type,handler){windowListeners.set(type,handler);},
    removeEventListener(type,handler){if(windowListeners.get(type)===handler)windowListeners.delete(type);},
  };
  const documentRef={
    getElementById(id){return id==='app'?root:null;},
  };
  return {root,documentRef,windowRef,windowListeners};
}

function clickTarget(dataset){
  return {dataset,closest(){return this;}};
}

function createApi(){
  const calls=[];
  const bootstrap={
    user:{id:1,telegramId:11,displayName:'Даня',username:'danya',photoUrl:''},
    stats:{points:25,rank:3,exact:4},
    favoriteTeam:{id:7,providerTeamId:'101',nameRu:'Интер',crestUrl:'https://example.test/inter.png',countryCode:'IT'},
    favoriteChoices:[
      {id:7,providerTeamId:'101',nameRu:'Интер',crestUrl:'https://example.test/inter.png',countryCode:'IT'},
      {id:8,providerTeamId:'102',nameRu:'Ювентус',crestUrl:'https://example.test/juve.png',countryCode:'IT'},
    ],
    settings:{deadlineReminders:true,lineupNotifications:false,kickoffNotifications:true,resultNotifications:false},
  };
  const api={
    calls,
    async call(action,payload={}){
      calls.push({action,payload});
      if(action==='bootstrap')return bootstrap;
      if(action==='favorite_next_match')return null;
      if(action==='calcio_today')return [];
      if(action==='ranking')return {rows:[{rank:1,displayName:'Даня',points:25,isCurrent:true}]};
      if(action==='matches')return [];
      if(action==='standings')return {competitionNameRu:'Серия А',rows:[]};
      if(action==='predictions_available'||action==='predictions_mine')return [];
      if(action==='favorite_set')return {favoriteTeamId:payload.team_id};
      if(action==='settings_update')return {...bootstrap.settings,...payload};
      if(action==='match_center')throw new Error('not_used');
      throw new Error(`unexpected_action:${action}`);
    },
  };
  return api;
}

function createTelegram(){
  const calls={ready:0,expand:0,onBack:0,show:[],unsubscribe:0};
  let backHandler=null;
  return {
    calls,
    initData(){return 'signed';},
    user(){return {id:11,first_name:'Даня'};},
    ready(){calls.ready+=1;},
    expand(){calls.expand+=1;},
    setBackVisible(value){calls.show.push(value);},
    onBack(handler){calls.onBack+=1;backHandler=handler;return()=>{calls.unsubscribe+=1;backHandler=null;};},
    safeArea(){return {top:0,right:0,bottom:0,left:0};},
    triggerBack(){return backHandler?.();},
  };
}

test('settings model uses bootstrap favorite choices, exact four flags and automatic device timezone',async()=>{
  const api=createApi();
  const model=await loadProfileSettings({api,timeZone:'Europe/Berlin'});
  assert.equal(model.profile.displayName,'Даня');
  assert.deepEqual(model.favoriteChoices.map(team=>team.nameRu),['Интер','Ювентус']);
  assert.deepEqual(NOTIFICATION_SETTINGS.map(item=>item.key),[
    'deadlineReminders','lineupNotifications','kickoffNotifications','resultNotifications',
  ]);
  const html=renderProfileSettings(model);
  assert.match(html,/Интер/);
  assert.match(html,/Ювентус/);
  assert.match(html,/data-action="favorite-search"/);
  assert.match(html,/Автоматически · Europe\/Berlin/);
  assert.doesNotMatch(html,/name="timezone"|data-action="timezone-/);
});

test('favorite and notification saves use exact standalone backend actions',async()=>{
  const api=createApi();
  await saveFavorite({api,teamId:8});
  await saveNotificationSetting({api,key:'lineupNotifications',value:true});
  assert.deepEqual(api.calls.slice(-2),[
    {action:'favorite_set',payload:{team_id:8}},
    {action:'settings_update',payload:{lineupNotifications:true}},
  ]);
  const before=api.calls.length;
  await assert.rejects(()=>saveNotificationSetting({api,key:'unknown',value:true}),/settings_key_invalid/);
  assert.equal(api.calls.length,before);
});

test('Matches landing has a real standalone route so bottom navigation can reach five tournament cards',()=>{
  assert.equal(serializeRoute({screen:'matches',tournament:null}),'/matches');
  assert.deepEqual(parseRoute('/matches'),{
    screen:'matches',tournament:null,subview:null,matchId:null,section:null,scrollY:0,
  });
});

test('createApp owns one Telegram init, one delegated click handler and remembers the exact section route',async()=>{
  const {root,documentRef,windowRef}=createFakeDom('/unknown');
  const api=createApi();
  const telegram=createTelegram();
  const app=createApp({documentRef,windowRef,api,telegram,clock:()=>new Date('2026-09-07T05:00:00.000Z'),timeZone:'Europe/Berlin'});

  await app.start();
  await app.start();
  assert.equal(telegram.calls.ready,1);
  assert.equal(telegram.calls.expand,1);
  assert.equal(telegram.calls.onBack,1);
  assert.equal(root.listeners.size,1);
  assert.match(root.innerHTML,/data-screen="home"/);
  assert.match(root.innerHTML,/Главная/);
  assert.equal(windowRef.location.pathname,'/home');

  const click=root.listeners.get('click');
  await click({target:clickTarget({action:'open-settings'})});
  assert.equal(windowRef.location.pathname,'/settings');
  assert.match(root.innerHTML,/data-screen="settings"/);
  assert.match(root.innerHTML,/Автоматически · Europe\/Berlin/);

  await click({target:clickTarget({navItem:'true',section:'ranking'})});
  assert.equal(windowRef.location.pathname,'/ranking/all');
  assert.match(root.innerHTML,/data-screen="ranking"/);

  await click({target:clickTarget({action:'ranking-scope',scope:'europe'})});
  assert.equal(windowRef.location.pathname,'/ranking/europe');
  await click({target:clickTarget({navItem:'true',section:'home'})});
  await click({target:clickTarget({navItem:'true',section:'ranking'})});
  assert.equal(windowRef.location.pathname,'/ranking/europe');
  assert.equal(api.calls.filter(call=>call.action==='ranking'&&call.payload.scope==='europe').length,2);

  app.destroy();
  assert.equal(root.listeners.size,0);
  assert.equal(telegram.calls.unsubscribe,1);
});

test('standalone app source graph never imports legacy/modular frontend modules',async()=>{
  const appSource=await readFile(new URL('../src/v23/app.mjs',import.meta.url),'utf8');
  const settingsSource=await readFile(new URL('../src/v23/screens/profile-settings.mjs',import.meta.url),'utf8');
  const combined=`${appSource}\n${settingsSource}`;
  assert.doesNotMatch(combined,/src\/modular|legacy-surface-adapter|dom-bridge|v22-5/);
});
