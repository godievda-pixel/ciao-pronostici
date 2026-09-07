export const PREDICTION_STAGE_LOCK_UI_MARKER='ciao-prod-prediction-stage-lock-ui-20260907';
const HOME_FIX_MARKER='ciao-prod-home-predictions-nav-fix-20260907';
const FINAL_IIFE_MARKER='  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script>';

export function previousLeagueStageLabel(stageKey){
  const m=String(stageKey??'').match(/^league-(\d+)$/);
  const n=m?Number(m[1]):NaN;
  return Number.isFinite(n)&&n>1?`${n-1}-го тура`:'предыдущего тура';
}

export function predictionStageLockUiSource(){
  return `
  /* ${PREDICTION_STAGE_LOCK_UI_MARKER} */
  __cwPredUxCurrentStageLabel=function(){
    const key=String(__cwPredStageKey||'');
    const m=key.match(/^league-(\\d+)$/);
    const n=m?Number(m[1]):NaN;
    return Number.isFinite(n)&&n>1?(n-1)+'-го тура':'предыдущего тура';
  };
  try{const styleId='cwpred-stage-lock-ui-style';if(!document.getElementById(styleId)){const style=document.createElement('style');style.id=styleId;style.textContent='\
#ciao-miniapp-root .cwpred-stage-locked{opacity:.52!important;position:relative!important;padding-right:12px!important;color:rgba(255,255,255,.58)!important;background:rgba(255,255,255,.035)!important}\
#ciao-miniapp-root .cwpred-stage-locked::before{content:""!important;position:absolute!important;right:6px!important;top:7px!important;width:5px!important;height:4px!important;border:1px solid currentColor!important;border-bottom:0!important;border-radius:5px 5px 0 0!important;opacity:.42!important;transform:none!important;filter:none!important}\
#ciao-miniapp-root .cwpred-stage-locked::after{content:""!important;position:absolute!important;right:5px!important;top:11px!important;width:7px!important;height:6px!important;border:1px solid currentColor!important;border-radius:2px!important;background:transparent!important;opacity:.42!important;transform:none!important;filter:none!important;font-size:0!important}\
';document.head.appendChild(style)}}catch(_e){}
  /* /${PREDICTION_STAGE_LOCK_UI_MARKER} */
`;
}

export function injectPredictionStageLockUiPatch(input){
  const html=String(input||'');
  if(html.includes(PREDICTION_STAGE_LOCK_UI_MARKER))return html;
  if(!html.includes(HOME_FIX_MARKER))throw new Error('production Home/Predictions fix missing before stage lock UI');
  const index=html.lastIndexOf(FINAL_IIFE_MARKER);
  if(index<0)throw new Error('production v22.5 final IIFE marker missing');
  return `${html.slice(0,index)}${predictionStageLockUiSource()}${html.slice(index)}`;
}

export function validatePredictionStageLockUiPatchedHtml(input){
  const html=String(input||'');
  const count=html.split(PREDICTION_STAGE_LOCK_UI_MARKER).length-1;
  if(count!==2)throw new Error(`production stage-lock UI marker count invalid: ${count}`);
  const homeAt=html.indexOf(HOME_FIX_MARKER),fixAt=html.indexOf(PREDICTION_STAGE_LOCK_UI_MARKER);
  if(homeAt<0||fixAt<0||homeAt>=fixAt)throw new Error('production stage-lock UI order invalid');
  return true;
}
