export const GLOBAL_REFRESH_MARKER = 'ciao-prod-global-refresh-15000-20260907';
const MATCHES_THEME_MARKER = 'ciao-prod-multitournament-card-theme-20260907';
const FINAL_IIFE_MARKER = '  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script>';

export function globalRefreshRuntimeSource() {
  return `
  /* ${GLOBAL_REFRESH_MARKER} */
  const __CW_REFRESH_MS=15000;
  let __cwRefreshBusy=false;
  let __cwRefreshTimer=0;
  let __cwRefreshSeq=0;

  function __cwRefreshScreenKey(){
    let key=String(tab||'');
    try{if(typeof matchViewId!=='undefined'&&matchViewId)key+='|match:'+String(matchViewId)}catch(_e){}
    try{if(typeof clubViewId!=='undefined'&&clubViewId)key+='|club:'+String(clubViewId)}catch(_e){}
    try{if(tab==='calendar'&&typeof __cwMtCompetition!=='undefined')key+='|matches:'+String(__cwMtCompetition||'')+':'+String(__cwMtStageKey||'')}catch(_e){}
    return key;
  }

  function __cwRefreshDisableLegacySchedulers(){
    try{if(__cw10PollTimer)clearTimeout(__cw10PollTimer);__cw10PollTimer=null;__cw10ScheduleNext=function(){return 0}}catch(_e){}
    try{if(__cw11SerieATimer)clearTimeout(__cw11SerieATimer);__cw11SerieATimer=null;__cw11ScheduleSerieA=function(){return 0}}catch(_e){}
    try{if(__cw2014Timer)clearTimeout(__cw2014Timer);__cw2014Timer=null;__cw2014Schedule=function(){return 0};__cw2014Wake=function(){return false}}catch(_e){}
    try{__cwMtStopRefresh();__cwMtStartRefresh=function(){return false}}catch(_e){}
  }

  async function __cwMtRefreshVisible({quiet=true}={}){
    try{
      if(document.hidden||tab!=='calendar'||!__cwMtCompetition||__cwMtCompetition==='serie_a')return false;
      return await __cwMtLoadCompetition(__cwMtCompetition,{quiet:true});
    }catch(_e){return false}
  }

  async function __cwRefreshCurrentCoreScreen(seq,screenKey){
    try{
      if(typeof matchViewId!=='undefined'&&matchViewId){return await refreshLive()}
      if(typeof clubViewId!=='undefined'&&clubViewId)return false;
    }catch(_e){}
    if(!(tab==='predict'||tab==='table'||tab==='seriea'||tab==='profile'||tab==='calendar')||!S)return false;
    const keptDraft=new Map(draft);
    const scrollTop=Number(main?.scrollTop||0);
    try{
      const next=await api({action:'state',round:S.selected_round});
      if(seq!==__cwRefreshSeq||screenKey!==__cwRefreshScreenKey())return false;
      S=next;
      selectedRound=next?.selected_round;
      draft.clear();for(const [k,v] of keptDraft)draft.set(k,v);
      render();
      if(main&&Number.isFinite(scrollTop)){main.scrollTop=scrollTop;requestAnimationFrame(()=>{if(main)main.scrollTop=scrollTop})}
      return true;
    }catch(_e){return false}
  }

  async function __cwRefreshVisibleNow(){
    if(document.hidden||__cwRefreshBusy)return false;
    if(tab==='mine'&&globalThis.CiaoPredictionsScreen?.isOpen?.())return false;
    if(tab==='mine')return false;
    __cwRefreshBusy=true;
    const seq=++__cwRefreshSeq;
    const screenKey=__cwRefreshScreenKey();
    try{
      if(tab==='calendar'&&typeof __cwMtRefreshVisible==='function'){
        const external=typeof __cwMtCompetition!=='undefined'&&__cwMtCompetition&&__cwMtCompetition!=='serie_a';
        const handled=await __cwMtRefreshVisible({quiet:true});
        if(external)return handled;
      }
      return await __cwRefreshCurrentCoreScreen(seq,screenKey);
    }finally{
      __cwRefreshBusy=false;
    }
  }

  function __cwRefreshStart(){
    if(__cwRefreshTimer)clearInterval(__cwRefreshTimer);
    __cwRefreshTimer=setInterval(__cwRefreshVisibleNow,__CW_REFRESH_MS);
  }

  __cwRefreshDisableLegacySchedulers();
  __cwRefreshStart();
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){__cwRefreshSeq+=1;return}
    Promise.resolve(__cwRefreshVisibleNow()).catch(()=>{});
  });
  try{window.__cwRefreshVisibleNow=__cwRefreshVisibleNow}catch(_e){}
  /* /${GLOBAL_REFRESH_MARKER} */
`;
}

export function injectGlobalRefreshPatch(input) {
  const html = String(input || '');
  if (html.includes(GLOBAL_REFRESH_MARKER)) return html;
  if (!html.includes(MATCHES_THEME_MARKER)) throw new Error('production Matches theme layer missing before global refresh runtime');
  const index = html.lastIndexOf(FINAL_IIFE_MARKER);
  if (index < 0) throw new Error('production v22.5 final IIFE marker missing');
  return `${html.slice(0, index)}${globalRefreshRuntimeSource()}${html.slice(index)}`;
}

export function validateGlobalRefreshPatchedHtml(input) {
  const html = String(input || '');
  const count = html.split(GLOBAL_REFRESH_MARKER).length - 1;
  if (count !== 2) throw new Error(`production global refresh marker count invalid: ${count}`);
  const themeAt = html.indexOf(MATCHES_THEME_MARKER);
  const refreshAt = html.indexOf(GLOBAL_REFRESH_MARKER);
  if (themeAt < 0 || refreshAt < 0 || themeAt >= refreshAt) throw new Error('production global refresh layer order invalid');
  const source = globalRefreshRuntimeSource();
  if (!source.includes('const __CW_REFRESH_MS=15000')) throw new Error('production 15 second refresh cadence missing');
  if (!source.includes('visibilitychange')) throw new Error('production refresh visibility handling missing');
  if (source.includes('30000')) throw new Error('legacy 30 second cadence leaked into global refresh source');
  if (source.includes('__cwPred')) throw new Error('legacy Predictions refresh leaked into global scheduler');
  return true;
}
