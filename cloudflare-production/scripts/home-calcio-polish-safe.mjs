import {
  HOME_CALCIO_POLISH_MARKER,
  homeCalcioPolishRuntimeSource,
} from './home-calcio-polish.mjs';

const MINE_STAGE_MARKER='ciao-prod-prediction-mine-stage-polish-20260907';
const FINAL_IIFE_MARKER='  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script>';
const BROKEN_FONT="font-family:'Unbounded','Manrope',sans-serif";
const SAFE_FONT='font-family:"Unbounded","Manrope",sans-serif';
const EXPECTED_FONT_REPLACEMENTS=2;
const HOME_BOOTSTRAP='\n  try{__cwHomePolishDom();__cwHomeBindPolish()}catch(_e){}\n';

export function homeCalcioPolishRuntimeSourceSafe(){
  const source=homeCalcioPolishRuntimeSource();
  const count=source.split(BROKEN_FONT).length-1;
  if(count!==EXPECTED_FONT_REPLACEMENTS){
    throw new Error(`home/calcio unsafe font literal count invalid: ${count}`);
  }
  const safe=source.split(BROKEN_FONT).join(SAFE_FONT)+HOME_BOOTSTRAP;
  new Function(safe);
  return safe;
}

export function injectHomeCalcioPolishSafePatch(input){
  const html=String(input||'');
  if(html.includes(HOME_CALCIO_POLISH_MARKER))return html;
  if(!html.includes(MINE_STAGE_MARKER))throw new Error('production mine/stage polish missing before safe home/calcio polish');
  const index=html.lastIndexOf(FINAL_IIFE_MARKER);
  if(index<0)throw new Error('production v22.5 final IIFE marker missing');
  const runtime=homeCalcioPolishRuntimeSourceSafe();
  return `${html.slice(0,index)}${runtime}${html.slice(index)}`;
}

export function validateHomeCalcioPolishSafePatchedHtml(input){
  const html=String(input||'');
  const count=html.split(HOME_CALCIO_POLISH_MARKER).length-1;
  if(count!==2)throw new Error(`production safe home/calcio marker count invalid: ${count}`);
  const mineAt=html.indexOf(MINE_STAGE_MARKER);
  const homeAt=html.indexOf(HOME_CALCIO_POLISH_MARKER);
  const homeEnd=html.indexOf(HOME_CALCIO_POLISH_MARKER,homeAt+HOME_CALCIO_POLISH_MARKER.length);
  if(mineAt<0||homeAt<0||homeEnd<0||mineAt>=homeAt)throw new Error('production safe home/calcio layer order invalid');
  const layer=html.slice(homeAt,homeEnd+HOME_CALCIO_POLISH_MARKER.length);
  if(layer.includes(BROKEN_FONT))throw new Error('unsafe nested Home/Calcio font literal leaked into injected runtime');
  if(!layer.includes(SAFE_FONT))throw new Error('safe Home/Calcio font literal missing from injected runtime');
  new Function(homeCalcioPolishRuntimeSourceSafe());
  return true;
}
