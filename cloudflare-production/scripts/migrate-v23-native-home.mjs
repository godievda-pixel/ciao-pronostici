import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourcePath=resolve('cloudflare-production/src/v23/index.html');
const OLD='ciao-prod-home-calcio-polish-20260908';
const NATIVE='ciao-v23-native-home-20260908';
const SAFETY='ciao-prod-home-calcio-safety-20260908';

const html=await readFile(sourcePath,'utf8');
if(html.includes(NATIVE)){
  console.log('v23 native Home already migrated');
  process.exit(0);
}
if(!html.includes(`/* ${OLD} */`)||!html.includes(`/* /${OLD} */`))throw new Error('captured Home block missing');

let next=html
  .replace(`/* ${OLD} */`,`/* ${NATIVE} */`)
  .replace(`/* /${OLD} */`,`/* /${NATIVE} */`);

const legacyPatch=/function __cw20PatchFavoriteHome\(\)\{[\s\S]*?\n  \}\n  async function __cw20LoadFavoriteStable/;
if(!legacyPatch.test(next))throw new Error('legacy favorite patch function not found');
next=next.replace(legacyPatch,`function __cw20PatchFavoriteHome(){\n    if(tab!=='predict'||matchViewId||clubViewId)return;\n    render();\n  }\n  async function __cw20LoadFavoriteStable`);

const oldDomSection=/  function __cwHomePolishToday\(\)\{[\s\S]*?\n  function __cwHomeExternalCenterHtml\(\)\{/;
if(!oldDomSection.test(next))throw new Error('legacy Home DOM polish section not found');
const nativeDom=`  function __cw23PolishToday(scope){
    const section=scope?.querySelector?.('.cw211-today');if(!section)return;
    const games=__cwHomeCalcioTodayMatches();section.classList.add('cw-home-calcio');
    section.innerHTML='<div class="cw211-today-head cw-home-today-head"><div><small>Матчи итальянских клубов</small><b>Кальчо сегодня</b></div><span>'+(games.length?String(games.length)+' '+(games.length===1?'матч':games.length<5?'матча':'матчей'):'матчей нет')+'</span></div>'+(games.length?'<div class="cw211-today-list cw-home-today-list">'+games.slice(0,10).map(__cwHomeTodayCard).join('')+'</div>':'<div class="cw-home-today-empty">Сегодня матчей итальянских клубов нет</div>');
  }

  function __cw23PolishFavorite(scope){
    const shell=scope?.querySelector?.('.cw211-home-shell');if(!shell)return;
    const profile=shell.querySelector?.('.cw211-profile-btn');if(profile){profile.classList.add('cw-home-profile-premium');profile.textContent='Профиль клуба'}
    const cards=shell.querySelectorAll?.('.cw211-favorite-body .cw211-info-card')||[];const host=cards[1];if(!host)return;
    const match=__cwHomeNearestFavorite();if(!match)return;
    const opponent=__cwHomeOpponent(match),external=!match.__legacy;
    host.classList.add('cw-home-favorite-match');host.setAttribute('data-cw-home-match',String(match.matchId||''));host.setAttribute('data-cw-home-competition',String(match.competition||'serie_a'));host.setAttribute('tabindex','0');host.setAttribute('role','button');
    if(match.__legacy)host.setAttribute('data-cw211-match',String(match.matchId||''));else host.removeAttribute('data-cw211-match');
    host.innerHTML='<small>'+(['live','halftime','extra_time','penalties'].includes(__cwHomeStatus(match))?'Матч идёт':'Ближайший матч')+'</small><div class="cw-home-favorite-matchline">'+__cwHomeOpponentCrest(match)+'<div class="cw-home-favorite-opponent"><b>'+__cwHomeEsc(opponent?.name||'Соперник')+'</b><span>'+__cwHomeEsc(__cwHomeCompetitionLabel(match.competition))+' · '+__cwHomeEsc(__cwHomeMatchLabel(match))+'</span></div><strong class="cw-home-favorite-score">'+__cwHomeEsc(__cwHomeMatchScore(match))+'</strong></div><span class="cw-home-favorite-hint">Открыть матч-центр <i>→</i></span>';
    if(external)host.classList.add('cw-home-favorite-match--external');else host.classList.remove('cw-home-favorite-match--external');
  }

  function __cw23PolishPredictionStages(scope){
    try{scope?.querySelectorAll?.('.round-chip.locked,.round-chip.cwpred-stage-locked,[data-cwpred-stage][aria-disabled="true"]').forEach(btn=>{btn.innerHTML=String(btn.innerHTML||'').replace(/[\\u{1F512}\\u{1F510}]/gu,'');btn.querySelectorAll?.('.lock,.round-lock,.cw-lock').forEach(node=>node.remove());btn.disabled=true;btn.setAttribute('aria-disabled','true');btn.setAttribute('tabindex','-1')})}catch(_e){}
  }

  function __cw23RenderHomeHtml(html){
    const box=document.createElement('div');box.innerHTML=String(html||'');
    const favorite=box.querySelector('.cw211-home-shell');
    if(favorite?.parentElement){
      const parent=favorite.parentElement;
      const card=box.querySelector('.hero');
      if(card&&card!==favorite&&card.parentElement===parent){card.classList.add('cw-home-user-card');if(card.nextElementSibling!==favorite)parent.insertBefore(card,favorite)}
    }
    __cw23PolishToday(box);__cw23PolishFavorite(box);__cw23PolishPredictionStages(box);
    return box.innerHTML;
  }

  function __cwHomeExternalCenterHtml(){`;
next=next.replace(oldDomSection,nativeDom);

const oldPredict=/  const __cwHomePolishPredictBase=predict;\n  predict=function\(\)\{return __cwHomeExternalCenter\?__cwHomeExternalCenterHtml\(\):__cwHomePolishPredictBase\(\)\};/;
if(!oldPredict.test(next))throw new Error('legacy Home predict wrapper missing');
next=next.replace(oldPredict,`  const __cw23HomeRenderBase=predict;\n  predict=function(){if(__cwHomeExternalCenter)return __cwHomeExternalCenterHtml();__cwHomeEnsureExternal();return __cw23RenderHomeHtml(__cw23HomeRenderBase())};`);

const oldBind=/  const __cwHomePolishBindBase=bind;\n  bind=function\(\)\{__cwHomePolishDom\(\);__cwHomePolishBindBase\(\);__cwHomeBindPolish\(\)\};/;
if(!oldBind.test(next))throw new Error('legacy Home bind wrapper missing');
next=next.replace(oldBind,`  const __cw23HomeBindBase=bind;\n  bind=function(){const result=__cw23HomeBindBase();__cwHomeBindPolish();return result};`);

next=next.replace(/\n\s*try\{__cwHomePolishDom\(\);__cwHomeBindPolish\(\)\}catch\(_e\)\{\}\s*/,'\n');

const safetyRe=new RegExp(`\\n\\s*/\\* ${SAFETY} \\*/[\\s\\S]*?/\\* /${SAFETY} \\*/\\s*`);
if(!safetyRe.test(next))throw new Error('legacy Home safety block missing');
next=next.replace(safetyRe,'\n');

for(const forbidden of [OLD,SAFETY,'function __cwHomePolishDom()'])if(next.includes(forbidden))throw new Error(`legacy Home artifact still present: ${forbidden}`);
for(const required of [NATIVE,'const __cw23HomeRenderBase=predict','function __cw23RenderHomeHtml','Кальчо сегодня','cw-home-profile-premium'])if(!next.includes(required))throw new Error(`native Home artifact missing: ${required}`);

await writeFile(sourcePath,next,'utf8');
console.log(JSON.stringify({ok:true,before:Buffer.byteLength(html),after:Buffer.byteLength(next)}));
