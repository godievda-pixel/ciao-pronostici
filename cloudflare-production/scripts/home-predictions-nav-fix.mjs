export const HOME_PREDICTIONS_NAV_FIX_MARKER='ciao-prod-home-predictions-nav-fix-20260907';
const GLOBAL_REFRESH_MARKER='ciao-prod-global-refresh-15000-20260907';
const FINAL_IIFE_MARKER='  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script>';

export function homePredictionsNavFixSource(){
  return `
  /* ${HOME_PREDICTIONS_NAV_FIX_MARKER} */
  function __cwHomePredFixNav(){
    try{
      const home=root.querySelector('button[data-tab="predict"]');
      const predictions=root.querySelector('button[data-tab="mine"]');
      const homeLabel=home?.querySelector('.nav-label');
      const predictionsLabel=predictions?.querySelector('.nav-label');
      if(homeLabel)homeLabel.textContent='Главная';
      if(predictionsLabel)predictionsLabel.textContent='Прогнозы';
      if(predictions)predictions.style.display='';
      if(home)home.classList.toggle('active',tab==='predict');
      if(predictions)predictions.classList.toggle('active',tab==='mine');
    }catch(_e){}
  }

  __cwPredFixNav=__cwHomePredFixNav;
  predict=function(){return __cwPredLegacyPredict()};
  mine=function(){return __cwPredCenterHtml()};

  __cwPredApplyTheme=function(){
    try{
      const theme=tab==='mine'&&__cwPredCompetition?__cwPredTheme(__cwPredCompetition):'';
      if(theme)root.setAttribute('data-cwpred-screen-theme',theme);
      else root.removeAttribute('data-cwpred-screen-theme');
    }catch(_e){}
  };

  const __cwHomePredLegacyPredictionRefresh=__cwPredRefreshVisible;
  __cwPredRefreshVisible=async function(options={}){
    if(tab!=='mine')return false;
    return await __cwHomePredLegacyPredictionRefresh(options);
  };

  const __cwHomePredLegacyCoreRefresh=__cwRefreshCurrentCoreScreen;
  __cwRefreshCurrentCoreScreen=async function(seq,screenKey){
    if(tab==='predict'&&S){
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
      }catch(_e){
        draft.clear();for(const [k,v] of keptDraft)draft.set(k,v);
        return false;
      }
    }
    return await __cwHomePredLegacyCoreRefresh(seq,screenKey);
  };

  const __cwHomePredLegacyRefreshVisibleNow=__cwRefreshVisibleNow;
  __cwRefreshVisibleNow=async function(){
    if(tab!=='predict')return await __cwHomePredLegacyRefreshVisibleNow();
    if(document.hidden||__cwRefreshBusy)return false;
    __cwRefreshBusy=true;
    const seq=++__cwRefreshSeq;
    const screenKey=__cwRefreshScreenKey();
    try{return await __cwRefreshCurrentCoreScreen(seq,screenKey)}
    finally{__cwRefreshBusy=false}
  };
  try{window.__cwRefreshVisibleNow=__cwRefreshVisibleNow}catch(_e){}
  __cwRefreshStart();

  __cwHomePredFixNav();
  __cwPredApplyTheme();
  if(tab==='predict'||tab==='mine')render();
  /* /${HOME_PREDICTIONS_NAV_FIX_MARKER} */
`;
}

export function injectHomePredictionsNavFixPatch(input){
  const html=String(input||'');
  if(html.includes(HOME_PREDICTIONS_NAV_FIX_MARKER))return html;
  if(!html.includes(GLOBAL_REFRESH_MARKER))throw new Error('production global refresh layer missing before Home/Predictions nav fix');
  const index=html.lastIndexOf(FINAL_IIFE_MARKER);
  if(index<0)throw new Error('production v22.5 final IIFE marker missing');
  return `${html.slice(0,index)}${homePredictionsNavFixSource()}${html.slice(index)}`;
}

export function validateHomePredictionsNavFixPatchedHtml(input){
  const html=String(input||'');
  const count=html.split(HOME_PREDICTIONS_NAV_FIX_MARKER).length-1;
  if(count!==2)throw new Error(`production Home/Predictions nav fix marker count invalid: ${count}`);
  const refreshAt=html.indexOf(GLOBAL_REFRESH_MARKER);
  const fixAt=html.indexOf(HOME_PREDICTIONS_NAV_FIX_MARKER);
  if(refreshAt<0||fixAt<0||refreshAt>=fixAt)throw new Error('production Home/Predictions nav fix layer order invalid');
  const source=homePredictionsNavFixSource();
  for(const required of ["textContent='Главная'","textContent='Прогнозы'","predict=function(){return __cwPredLegacyPredict()}","mine=function(){return __cwPredCenterHtml()}","if(tab!=='mine')return false","__cwRefreshStart()"]){
    if(!source.includes(required))throw new Error(`production Home/Predictions nav contract missing: ${required}`);
  }
  return true;
}
