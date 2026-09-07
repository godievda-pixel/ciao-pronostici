import { createLastGoodCache } from './core/cache.mjs';
import { createLiveController } from './core/live-controller.mjs';
import { createRouter } from './core/router.mjs';
import { createStore } from './core/store.mjs';
import { createTelegramBridge } from './core/telegram.mjs';
import { createApiClient, readApiUrl } from './data/api-client.mjs';
import { loadHome, renderHome } from './screens/home.mjs';
import { createMatchCenterController } from './screens/match-center.mjs';
import { loadMatches, renderMatches } from './screens/matches.mjs';
import { loadPredictions, renderPredictions, savePrediction } from './screens/predictions.mjs';
import {
  loadProfileSettings,
  renderProfileSettings,
  saveFavorite,
  saveNotificationSetting,
} from './screens/profile-settings.mjs';
import { loadRanking, renderRanking } from './screens/ranking.mjs';
import { loadTable, renderTables } from './screens/tables.mjs';
import { renderBottomNav } from './ui/bottom-nav.mjs';
import { escapeHtml } from './ui/html.mjs';

const TOP_LEVEL=new Set(['home','predictions','ranking','matches','tables']);
const MATCH_COMPETITIONS=new Set(['serie_a','coppa_italia','ucl','uel','uecl']);
const TABLE_COMPETITIONS=new Set(['serie_a','ucl','uel','uecl']);

function text(value){return String(value??'').trim();}

function deviceTimeZone(value){
  const explicit=text(value);
  if(explicit)return explicit;
  try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}
  catch{return 'UTC';}
}

function defaultRoute(section){
  if(section==='home')return {screen:'home'};
  if(section==='predictions')return {screen:'predictions',subview:'available'};
  if(section==='ranking')return {screen:'ranking',subview:'all'};
  if(section==='matches')return {screen:'matches',tournament:null};
  if(section==='tables')return {screen:'tables',tournament:'serie_a'};
  return {screen:'home'};
}

function competitionFromMatchId(value){
  const id=text(value);
  const competition=id.split(':',1)[0];
  return MATCH_COMPETITIONS.has(competition)?competition:'';
}

function safeNow(clock){
  const raw=clock();
  const date=raw instanceof Date?new Date(raw.getTime()):new Date(raw);
  return Number.isFinite(date.getTime())?date:new Date();
}

export function createApp({
  documentRef=globalThis.document,
  windowRef=globalThis.window,
  api=null,
  telegram=null,
  clock=()=>new Date(),
  timeZone='',
}={}){
  const root=documentRef?.getElementById?.('app');
  if(!root)throw new Error('v23_app_root_missing');
  if(typeof clock!=='function')throw new Error('v23_clock_required');

  const tg=telegram??createTelegramBridge(windowRef);
  const client=api??createApiClient({
    fetchImpl:windowRef?.fetch?.bind?.(windowRef)??globalThis.fetch,
    endpoint:readApiUrl(documentRef),
    getInitData:()=>tg.initData(),
  });
  const tz=deviceTimeZone(timeZone);
  const cache=createLastGoodCache();
  const store=createStore({
    route:null,
    model:null,
    predictionCompetition:'all',
    settingsModel:null,
  });

  let started=false;
  let destroyed=false;
  let unsubscribeTelegramBack=()=>{};
  let router;
  let matchCenter;

  function currentRoute(){return router?.current?.()??store.get().route??{screen:'home'};}

  function renderShell(content,route){
    const screen=route?.screen??'home';
    const showNav=screen!=='settings'&&screen!=='match';
    const active=TOP_LEVEL.has(screen)?screen:'home';
    root.innerHTML=`<main class="app-shell" data-app-runtime="standalone-v23"><div class="app-content">${content}</div>${showNav?renderBottomNav(active):''}</main>`;
  }

  function renderFatal(route,error){
    const message=text(error?.message)||'Не удалось загрузить данные';
    const code=text(error?.code);
    const diagnostic=code?`<div class="status-state__detail">Код: ${escapeHtml(code)}</div>`:'';
    renderShell(`<section class="screen-stack"><div class="status-state status-state--error" data-state="error">${escapeHtml(message)}${diagnostic}</div></section>`,route??{screen:'home'});
  }

  async function renderScreen(route,{manageLive=true}={}){
    const normalized={...route};
    store.set(state=>({...state,route:normalized}));
    if(TOP_LEVEL.has(normalized.screen))router.rememberSectionRoute(normalized.screen,normalized);

    try{
      if(normalized.screen==='home'){
        const model=await loadHome(client,cache,clock,tz);
        store.set(state=>({...state,model}));
        renderShell(renderHome(model),normalized);
      }else if(normalized.screen==='predictions'){
        const mode=normalized.subview==='mine'?'mine':'available';
        const competition=store.get().predictionCompetition||'all';
        const model=await loadPredictions({api:client,mode,competition,now:safeNow(clock),timeZone:tz});
        store.set(state=>({...state,model}));
        renderShell(renderPredictions(model),normalized);
      }else if(normalized.screen==='ranking'){
        const scope=['all','italy','europe'].includes(normalized.subview)?normalized.subview:'all';
        const model=await loadRanking({api:client,scope});
        store.set(state=>({...state,model}));
        renderShell(renderRanking(model),normalized);
      }else if(normalized.screen==='matches'){
        if(!normalized.tournament){
          const model={competition:null,groups:[],items:[]};
          store.set(state=>({...state,model}));
          renderShell(renderMatches(model),normalized);
        }else{
          const model=await loadMatches({api:client,competition:normalized.tournament,now:safeNow(clock),timeZone:tz});
          store.set(state=>({...state,model}));
          renderShell(renderMatches(model),normalized);
        }
      }else if(normalized.screen==='tables'){
        const tournament=TABLE_COMPETITIONS.has(normalized.tournament)?normalized.tournament:'serie_a';
        const model=await loadTable({api:client,competition:tournament});
        store.set(state=>({...state,model}));
        renderShell(renderTables(model),normalized);
      }else if(normalized.screen==='settings'){
        const model=await loadProfileSettings({api:client,timeZone:tz});
        store.set(state=>({...state,model,settingsModel:model}));
        renderShell(renderProfileSettings(model),normalized);
      }else if(normalized.screen==='match'){
        await matchCenter.open({
          competition:normalized.tournament,
          matchId:normalized.matchId,
          section:normalized.section||'overview',
        });
      }else{
        await router.replace({screen:'home'});
        return;
      }

      if(!manageLive)return;
      if(normalized.screen==='home'){
        await live.start({screen:'home'});
      }else if(normalized.screen==='matches'&&normalized.tournament){
        await live.start({screen:'matches',tournament:normalized.tournament});
      }else if(normalized.screen==='match'){
        await live.start({screen:'match',competition:normalized.tournament,matchId:normalized.matchId,section:normalized.section||'overview'});
      }else{
        live.stop();
      }
    }catch(error){
      if(manageLive)live.stop();
      renderFatal(normalized,error);
    }
  }

  async function refreshLive(context){
    const route=currentRoute();
    if(context?.screen==='home'){
      const model=await loadHome(client,cache,clock,tz);
      if(route.screen==='home'){
        store.set(state=>({...state,model}));
        renderShell(renderHome(model),route);
      }
      return model;
    }
    if(context?.screen==='matches'&&MATCH_COMPETITIONS.has(context.tournament)){
      const model=await loadMatches({api:client,competition:context.tournament,now:safeNow(clock),timeZone:tz});
      if(route.screen==='matches'&&route.tournament===context.tournament){
        store.set(state=>({...state,model}));
        renderShell(renderMatches(model),route);
      }
      return model;
    }
    if(context?.screen==='match'&&route.screen==='match'&&route.matchId===context.matchId){
      await matchCenter.refresh(context.section||'overview');
      return matchCenter.state();
    }
    return null;
  }

  const live=createLiveController({refresh:refreshLive});

  router=createRouter({
    history:windowRef?.history,
    location:windowRef?.location,
    eventTarget:windowRef,
    render:route=>renderScreen(route),
    readScroll:()=>Number(windowRef?.scrollY)||0,
    restoreScroll:value=>windowRef?.scrollTo?.(0,value),
    onBackAvailability:available=>tg.setBackVisible?.(available),
  });

  matchCenter=createMatchCenterController({
    api:client,
    router,
    clock,
    timeZone:tz,
    render:view=>{
      const route=currentRoute();
      store.set(state=>({...state,model:view}));
      import('./screens/match-center.mjs').then(({renderMatchCenter})=>{
        if(currentRoute().screen==='match')renderShell(renderMatchCenter(view),route);
      });
    },
  });

  async function rerenderPredictions(feedback=null){
    const route=currentRoute();
    const mode=route.subview==='mine'?'mine':'available';
    const competition=store.get().predictionCompetition||'all';
    const model=await loadPredictions({api:client,mode,competition,now:safeNow(clock),timeZone:tz});
    model.feedback=feedback;
    store.set(state=>({...state,model}));
    renderShell(renderPredictions(model),route);
  }

  async function rerenderSettings(feedback=null){
    const route=currentRoute();
    const model=await loadProfileSettings({api:client,timeZone:tz});
    model.feedback=feedback;
    store.set(state=>({...state,model,settingsModel:model}));
    renderShell(renderProfileSettings(model),route);
  }

  async function handleClick(event){
    const node=event?.target?.closest?.('[data-action],[data-nav-item]');
    if(!node)return;
    const data=node.dataset??{};

    if(data.navItem==='true'){
      const section=text(data.section);
      const target=router.sectionRoute(section)??defaultRoute(section);
      await router.navigate(target);
      return;
    }

    const action=text(data.action);
    if(action==='open-settings'){
      await router.navigate({screen:'settings'});
      return;
    }
    if(action==='settings-back'||action==='match-back'){
      await router.back();
      return;
    }
    if(action==='prediction-mode'){
      await router.navigate({screen:'predictions',subview:data.mode==='mine'?'mine':'available'});
      return;
    }
    if(action==='prediction-filter'){
      store.set(state=>({...state,predictionCompetition:text(data.competition)||'all'}));
      await renderScreen(currentRoute(),{manageLive:false});
      return;
    }
    if(action==='ranking-scope'){
      const scope=['all','italy','europe'].includes(data.scope)?data.scope:'all';
      await router.navigate({screen:'ranking',subview:scope});
      return;
    }
    if(action==='open-tournament'){
      const competition=text(data.competition);
      if(MATCH_COMPETITIONS.has(competition))await router.navigate({screen:'matches',tournament:competition});
      return;
    }
    if(action==='table-competition'){
      const competition=text(data.competition);
      if(TABLE_COMPETITIONS.has(competition))await router.navigate({screen:'tables',tournament:competition});
      return;
    }
    if(action==='open-match'){
      const matchId=text(data.matchId);
      const competition=competitionFromMatchId(matchId);
      if(competition)await router.navigate({screen:'match',tournament:competition,matchId,section:'overview'});
      return;
    }
    if(action==='match-tab'){
      const section=text(data.section)||'overview';
      const route=currentRoute();
      if(route.screen==='match')await router.replace({...route,section});
      return;
    }
    if(action==='save-prediction'){
      const card=node.closest?.('[data-prediction-card]');
      const home=card?.querySelector?.('input[data-score="home"]')?.value;
      const away=card?.querySelector?.('input[data-score="away"]')?.value;
      const feedback=await savePrediction({api:client,competition:data.competition,matchId:data.matchId,homeScore:home,awayScore:away,now:safeNow(clock)});
      await rerenderPredictions(feedback);
      return;
    }
    if(action==='save-favorite'){
      const model=store.get().settingsModel??{};
      const value=text(root.querySelector?.('[data-action="favorite-search"]')?.value);
      const team=(model.favoriteChoices??[]).find(item=>text(item.nameRu).toLocaleLowerCase('ru-RU')===value.toLocaleLowerCase('ru-RU'));
      if(!team){
        await rerenderSettings({ok:false,message:'Выберите клуб из списка'});
        return;
      }
      const feedback=await saveFavorite({api:client,teamId:team.id});
      await rerenderSettings(feedback);
      return;
    }
    if(action==='notification-toggle'){
      const feedback=await saveNotificationSetting({api:client,key:data.key,value:data.value==='true'});
      await rerenderSettings(feedback);
    }
  }

  return Object.freeze({
    async start(){
      if(started)return currentRoute();
      if(destroyed)throw new Error('v23_app_destroyed');
      started=true;
      tg.ready?.();
      tg.expand?.();
      root.addEventListener?.('click',handleClick);
      unsubscribeTelegramBack=tg.onBack?.(()=>router.back())??(()=>{});
      return await router.start();
    },
    destroy(){
      if(destroyed)return;
      destroyed=true;
      live.stop();
      router.destroy();
      root.removeEventListener?.('click',handleClick);
      unsubscribeTelegramBack();
    },
    current:()=>currentRoute(),
    state:()=>store.get(),
    liveState:()=>live.state(),
  });
}

export function startStandaloneApp({documentRef=globalThis.document,windowRef=globalThis.window}={}){
  const telegram=createTelegramBridge(windowRef);
  const api=createApiClient({
    fetchImpl:windowRef?.fetch?.bind?.(windowRef)??globalThis.fetch,
    endpoint:readApiUrl(documentRef),
    getInitData:()=>telegram.initData(),
  });
  const app=createApp({documentRef,windowRef,api,telegram});
  return app.start().then(()=>app);
}

if(typeof document!=='undefined'&&typeof window!=='undefined'){
  Promise.resolve().then(()=>startStandaloneApp()).catch(()=>{
    const root=document.getElementById?.('app');
    if(root)root.innerHTML='<main class="app-shell"><div class="status-state status-state--error" data-state="error">Не удалось запустить приложение</div></main>';
  });
}
