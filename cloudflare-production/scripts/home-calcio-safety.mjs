export const HOME_CALCIO_SAFETY_MARKER='ciao-prod-home-calcio-safety-20260908';
const HOME_CALCIO_POLISH_MARKER='ciao-prod-home-calcio-polish-20260908';
const FINAL_IIFE_MARKER='  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script>';

export function homeCalcioSafetyRuntimeSource(){
  return `
  /* ${HOME_CALCIO_SAFETY_MARKER} */
  __cwHomeEnsureExternal=function(){
    if(__cwHomeExternalLoading)return;
    const age=Date.now()-Number(__cwHomeExternalLoadedAt||0);
    if(__cwHomeExternalLoadedAt&&age<15000)return;
    Promise.resolve().then(()=>__cwHomeLoadExternal()).catch(()=>{});
  };
  /* /${HOME_CALCIO_SAFETY_MARKER} */
`;
}

export function injectHomeCalcioSafetyPatch(input){
  const html=String(input||'');
  if(html.includes(HOME_CALCIO_SAFETY_MARKER))return html;
  if(!html.includes(HOME_CALCIO_POLISH_MARKER))throw new Error('production home/calcio polish missing before safety guard');
  const index=html.lastIndexOf(FINAL_IIFE_MARKER);
  if(index<0)throw new Error('production v22.5 final IIFE marker missing');
  return `${html.slice(0,index)}${homeCalcioSafetyRuntimeSource()}${html.slice(index)}`;
}

export function validateHomeCalcioSafetyPatchedHtml(input){
  const html=String(input||'');
  const count=html.split(HOME_CALCIO_SAFETY_MARKER).length-1;
  if(count!==2)throw new Error(`production home/calcio safety marker count invalid: ${count}`);
  const homeAt=html.indexOf(HOME_CALCIO_POLISH_MARKER),safetyAt=html.indexOf(HOME_CALCIO_SAFETY_MARKER);
  if(homeAt<0||safetyAt<0||homeAt>=safetyAt)throw new Error('production home/calcio safety order invalid');
  if(!html.includes('if(__cwHomeExternalLoadedAt&&age<15000)return'))throw new Error('production home/calcio safety cooldown missing');
  return true;
}
