export const PREDICTION_LIVE_SCROLL_POLISH_MARKER='ciao-prod-prediction-live-scroll-polish-20260907';
const STAGE_LOCK_MARKER='ciao-prod-prediction-stage-lock-ui-20260907';
const FINAL_IIFE_MARKER='  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script>';

export function predictionLiveScrollPolishSource(){
  return `
  /* ${PREDICTION_LIVE_SCROLL_POLISH_MARKER} */
  function __cwPredPolishStatusBadges(){
    try{
      root.querySelectorAll('.cwpred-status').forEach(el=>{
        const live=String(el.textContent||'').trim().toUpperCase().startsWith('LIVE');
        el.classList.toggle('cwpred-status--live',live);
      });
    }catch(_e){}
  }

  function __cwPredPolishCaptureViewport(){
    try{
      const viewportH=Number(window.innerHeight||document.documentElement?.clientHeight||0);
      const cards=[...root.querySelectorAll('.cwpred-card')];
      const card=cards.find(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<viewportH})||null;
      const attr=card?.hasAttribute('data-cwpred-match')?'data-cwpred-match':card?.hasAttribute('data-mid')?'data-mid':'';
      const rounds=root.querySelector('.cwpred-rounds');
      return {
        attr,
        key:attr?String(card?.getAttribute(attr)||''):'',
        top:card?Number(card.getBoundingClientRect().top):NaN,
        windowY:Number(window.scrollY||document.documentElement?.scrollTop||document.body?.scrollTop||0),
        mainY:Number(main?.scrollTop||0),
        roundsX:Number(rounds?.scrollLeft||0),
      };
    }catch(_e){return null}
  }

  function __cwPredPolishRestoreViewport(snapshot){
    if(!snapshot)return;
    try{if(main&&Number.isFinite(snapshot.mainY))main.scrollTop=snapshot.mainY}catch(_e){}
    try{const rounds=root.querySelector('.cwpred-rounds');if(rounds&&Number.isFinite(snapshot.roundsX))rounds.scrollLeft=snapshot.roundsX}catch(_e){}
    try{
      let target=null;
      if(snapshot.attr&&snapshot.key){
        target=[...root.querySelectorAll('.cwpred-card')].find(el=>String(el.getAttribute(snapshot.attr)||'')===snapshot.key)||null;
      }
      if(target&&Number.isFinite(snapshot.top)){
        const delta=Number(target.getBoundingClientRect().top)-snapshot.top;
        if(Number.isFinite(delta)&&Math.abs(delta)>.5)window.scrollBy(0,delta);
      }else if(Number.isFinite(snapshot.windowY)){
        window.scrollTo(0,snapshot.windowY);
      }
    }catch(_e){}
  }

  try{const styleId='cwpred-live-scroll-polish-style';if(!document.getElementById(styleId)){const style=document.createElement('style');style.id=styleId;style.textContent='\
#ciao-miniapp-root .cwpred-status.cwpred-status--live{color:#fff!important;background:linear-gradient(135deg,#E7072E,#A90424)!important;border-color:rgba(255,100,120,.72)!important;box-shadow:0 5px 16px rgba(231,7,46,.34),inset 0 1px 0 rgba(255,255,255,.14)!important;text-shadow:0 1px 1px rgba(0,0,0,.18)}\
#ciao-miniapp-root .cwpred-card{overflow-anchor:none}\
';document.head.appendChild(style)}}catch(_e){}

  const __cwPredPolishLegacyRender=render;
  render=function(){const result=__cwPredPolishLegacyRender();__cwPredPolishStatusBadges();return result};

  const __cwPredPolishLegacyRefreshVisible=__cwPredRefreshVisible;
  __cwPredRefreshVisible=async function(options={}){
    const snapshot=tab==='mine'?__cwPredPolishCaptureViewport():null;
    const result=await __cwPredPolishLegacyRefreshVisible(options);
    __cwPredPolishStatusBadges();
    if(snapshot){
      __cwPredPolishRestoreViewport(snapshot);
      requestAnimationFrame(()=>{
        __cwPredPolishRestoreViewport(snapshot);
        __cwPredPolishStatusBadges();
        requestAnimationFrame(()=>__cwPredPolishRestoreViewport(snapshot));
      });
    }
    return result;
  };
  try{window.__cwPredRefreshVisible=__cwPredRefreshVisible}catch(_e){}
  __cwPredPolishStatusBadges();
  /* /${PREDICTION_LIVE_SCROLL_POLISH_MARKER} */
`;
}

export function injectPredictionLiveScrollPolishPatch(input){
  const html=String(input||'');
  if(html.includes(PREDICTION_LIVE_SCROLL_POLISH_MARKER))return html;
  if(!html.includes(STAGE_LOCK_MARKER))throw new Error('production prediction stage-lock layer missing before live/scroll polish');
  const index=html.lastIndexOf(FINAL_IIFE_MARKER);
  if(index<0)throw new Error('production v22.5 final IIFE marker missing');
  return `${html.slice(0,index)}${predictionLiveScrollPolishSource()}${html.slice(index)}`;
}

export function validatePredictionLiveScrollPolishPatchedHtml(input){
  const html=String(input||'');
  const count=html.split(PREDICTION_LIVE_SCROLL_POLISH_MARKER).length-1;
  if(count!==2)throw new Error(`production live/scroll polish marker count invalid: ${count}`);
  const lockAt=html.indexOf(STAGE_LOCK_MARKER),fixAt=html.indexOf(PREDICTION_LIVE_SCROLL_POLISH_MARKER);
  if(lockAt<0||fixAt<0||lockAt>=fixAt)throw new Error('production live/scroll polish order invalid');
  const source=predictionLiveScrollPolishSource();
  for(const required of ["startsWith('LIVE')",'cwpred-status--live','#E7072E','getBoundingClientRect().top','window.scrollBy','requestAnimationFrame']){
    if(!source.includes(required))throw new Error(`production live/scroll polish contract missing: ${required}`);
  }
  return true;
}
