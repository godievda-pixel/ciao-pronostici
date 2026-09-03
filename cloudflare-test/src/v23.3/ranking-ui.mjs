import { createPredictionClient } from './prediction-client.mjs';

export const USER_FEEDBACK_ROUND3_BUILD = '2026-09-02-r3';
export const USER_FEEDBACK_ROUND4_BUILD = '2026-09-02-r4';
export const USER_FEEDBACK_ROUND5_BUILD = '2026-09-02-r5';
export const USER_FEEDBACK_ROUND6_BUILD = '2026-09-02-r6';
export const USER_FEEDBACK_ROUND7_BUILD = '2026-09-03-r7';
export const USER_FEEDBACK_ROUND11_BUILD = '2026-09-03-r11';

export const RANKING_FILTERS = Object.freeze([
  {key:'overall',label:'Общий'}, {key:'serie_a',label:'Серия А'}, {key:'coppa_italia',label:'КИ'},
  {key:'ucl',label:'ЛЧ'}, {key:'uel',label:'ЛЕ'}, {key:'uecl',label:'ЛК'},
]);

const RANKING_TITLES = Object.freeze({
  overall:'Общий рейтинг',
  serie_a:'Серия А',
  coppa_italia:'Кубок Италии',
  ucl:'Лига Чемпионов',
  uel:'Лига Европы',
  uecl:'Лига Конференций',
});
const RANKING_THEMES = Object.freeze({
  overall:'serie-a', serie_a:'serie-a', coppa_italia:'coppa',
  ucl:'champions', uel:'europa', uecl:'conference',
});

export function rankingThemeForCompetition(value) {
  return RANKING_THEMES[String(value ?? '').trim()] || 'serie-a';
}

export function rankingTitleForCompetition(value) {
  return RANKING_TITLES[String(value ?? '').trim()] || 'Рейтинг';
}

export function withRankingPositions(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row,index) => Object.freeze({ position:index + 1, ...row }));
}
function pluralRu(value, one, few, many) {
  const number = Math.abs(Math.trunc(Number(value) || 0)); const mod100 = number % 100; const mod10 = number % 10;
  if (mod100 >= 11 && mod100 <= 14) return many; if (mod10 === 1) return one; if (mod10 >= 2 && mod10 <= 4) return few; return many;
}
export function rankingParticipantCountLabel(value) {
  const number = Math.max(0, Math.trunc(Number(value) || 0)); return `${number} ${pluralRu(number,'участник','участника','участников')}`;
}
export function rankingPointsLabel(value) {
  const number = Math.trunc(Number(value) || 0); return `${number} ${pluralRu(number,'очко','очка','очков')}`;
}
function rankingPointsUnit(value) { return rankingPointsLabel(value).replace(/^-?\d+\s+/, ''); }

let client = null;
let active = 'overall';
let rows = [];
let me = null;
let pageActive = false;
let loadGeneration = 0;
const rankingCache = new Map();
const RANKING_STYLE_ID = 'cw233-ranking-round7-style';

function text(value) { return String(value ?? '').trim(); }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c])); }
function initData() { return text(globalThis.Telegram?.WebApp?.initData); }
function telegramUser() { return globalThis.Telegram?.WebApp?.initDataUnsafe?.user || null; }
function contentNode() { return document.querySelector('#ciao-miniapp-root .content'); }
function setHtmlIfChanged(node, html) { if (!node || node.innerHTML === html) return false; node.innerHTML = html; return true; }

function ensureRankingPremiumStyle() {
  if (typeof document === 'undefined' || document.getElementById(RANKING_STYLE_ID)) return;
  const style=document.createElement('style'); style.id=RANKING_STYLE_ID; style.textContent=`
    .cw233-ranking-page .cw233-ranking-list{display:grid!important;gap:8px!important;padding:0!important}
    .cw233-ranking-page .cw233-ranking-row{display:grid!important;grid-template-columns:34px 36px minmax(0,1fr) 58px!important;column-gap:10px!important;align-items:center!important;min-height:62px!important;width:100%!important;padding:10px 11px!important;box-sizing:border-box!important;border:1px solid transparent!important;transition:border-color .2s ease,background .2s ease}
    .cw233-ranking-page .cw233-ranking-row.is-podium-1{border-color:rgba(255,209,82,.72)!important;background:linear-gradient(90deg,rgba(255,196,46,.20),rgba(255,196,46,.055) 48%,rgba(255,196,46,.13))!important;box-shadow:inset 3px 0 0 #ffd052!important}
    .cw233-ranking-page .cw233-ranking-row.is-podium-2{border-color:rgba(210,222,245,.55)!important;background:linear-gradient(90deg,rgba(199,213,240,.16),rgba(199,213,240,.04) 48%,rgba(199,213,240,.10))!important;box-shadow:inset 3px 0 0 #d9e3f5!important}
    .cw233-ranking-page .cw233-ranking-row.is-podium-3{border-color:rgba(211,139,83,.55)!important;background:linear-gradient(90deg,rgba(190,111,58,.17),rgba(190,111,58,.04) 48%,rgba(190,111,58,.10))!important;box-shadow:inset 3px 0 0 #d18a58!important}
    .cw233-ranking-page .cw233-ranking-row.is-podium-1 .cw233-ranking-position{background:linear-gradient(145deg,#7a5a14,#d5a72e)!important;border-color:rgba(255,224,130,.70)!important}
    .cw233-ranking-page .cw233-ranking-row.is-podium-2 .cw233-ranking-position{background:linear-gradient(145deg,#53627a,#aab9d1)!important;border-color:rgba(232,240,255,.55)!important}
    .cw233-ranking-page .cw233-ranking-row.is-podium-3 .cw233-ranking-position{background:linear-gradient(145deg,#75472d,#b56d43)!important;border-color:rgba(236,166,117,.55)!important}
    .cw233-ranking-page .cw233-ranking-position{display:grid!important;place-items:center!important;width:34px!important;height:34px!important;min-width:34px!important}.cw233-ranking-page .cw233-ranking-position-value{display:block!important;width:100%!important;text-align:center!important;font-size:11px!important;font-weight:950!important;line-height:1!important;font-variant-numeric:tabular-nums!important}
    .cw233-ranking-page .cw233-ranking-person{display:grid!important;align-content:center!important;gap:3px!important;min-width:0!important;overflow:hidden!important}.cw233-ranking-page .cw233-ranking-name{display:block!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:12px!important;font-weight:900!important;line-height:1.2!important;letter-spacing:-.01em!important;color:#fff!important}.cw233-ranking-page .cw233-ranking-username{display:block!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:9px!important;line-height:1.15!important;color:var(--muted)!important}
    .cw233-ranking-page .cw233-ranking-points{display:grid!important;grid-template-rows:auto auto!important;justify-items:end!important;align-content:center!important;gap:2px!important;width:58px!important;min-width:58px!important;line-height:1!important;text-align:right!important}.cw233-ranking-page .cw233-ranking-points-value{display:block!important;font-size:17px!important;font-weight:950!important;line-height:1!important;color:#fff!important;font-variant-numeric:tabular-nums!important}.cw233-ranking-page .cw233-ranking-points-unit{display:block!important;max-width:58px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:7px!important;font-weight:850!important;line-height:1!important;letter-spacing:.02em!important;text-transform:uppercase!important;color:var(--muted)!important}
    .cw233-ranking-skeleton{display:grid;gap:8px}.cw233-ranking-skeleton-row{height:62px;border-radius:16px;background:linear-gradient(90deg,rgba(48,64,110,.18),rgba(73,92,151,.28),rgba(48,64,110,.18));background-size:220% 100%;animation:cw233-rank-pulse 1.15s ease-in-out infinite}@keyframes cw233-rank-pulse{to{background-position:-120% 0}}
    @media(max-width:390px){.cw233-ranking-page .cw233-ranking-row{grid-template-columns:32px 34px minmax(0,1fr) 54px!important;column-gap:8px!important;padding-left:9px!important;padding-right:9px!important}.cw233-ranking-page .cw233-ranking-position{width:32px!important;height:32px!important;min-width:32px!important}.cw233-ranking-page .cw233-ranking-points{width:54px!important;min-width:54px!important}.cw233-ranking-page .cw233-ranking-name{font-size:11px!important}.cw233-ranking-page .cw233-ranking-points-value{font-size:16px!important}}
  `; document.head.appendChild(style);
}

export function resolveRankingDisplayName(current,tgUser) {
  const serverName=text(current?.display_name||current?.name); if(serverName)return serverName;
  const telegramName=[text(tgUser?.first_name),text(tgUser?.last_name)].filter(Boolean).join(' '); if(telegramName)return telegramName;
  const username=text(current?.username||tgUser?.username).replace(/^@/,''); return username?`@${username}`:'Участник';
}
export function resolveCurrentRankingRow(rankingRows=[],tgUser={}) {
  const list=Array.isArray(rankingRows)?rankingRows:[]; let index=list.findIndex(row=>row?.is_current===true);
  if(index<0){const id=text(tgUser?.id);if(id){const wanted=`telegram:${id}`;index=list.findIndex(row=>text(row?.user_id)===wanted);}}
  if(index<0)return null; return Object.freeze({position:index+1,...list[index]});
}
function initials(value){const clean=text(value).replace(/^@/,'');const parts=clean.split(/\s+/).filter(Boolean).slice(0,2);return(parts.map(part=>part[0]||'').join('').toUpperCase()||'У').slice(0,2);}
function usernameLine(current,tgUser){const username=text(current?.username||tgUser?.username).replace(/^@/,'');return username?`@${username}`:'Рейтинг прогнозистов';}
function heroHtml(){const tgUser=telegramUser();const name=resolveRankingDisplayName(me,tgUser);const subtitle=usernameLine(me,tgUser);const rank=Number(me?.position);const points=Number(me?.points)||0;return `<div class="hero cw233-ranking-hero"><div class="cw233-ranking-identity"><div class="cw233-ranking-avatar cw233-ranking-avatar--hero">${esc(initials(name))}</div><div class="cw233-ranking-identity-copy"><span class="cw233-ranking-kicker">УЧАСТНИК</span><h2>${esc(name)}</h2><p>${esc(subtitle)}</p></div></div><div class="cw233-ranking-hero-stats"><div class="cw233-ranking-stat"><strong>${rank>0?`#${rank}`:'—'}</strong><span>место</span></div><div class="cw233-ranking-stat"><strong>${points}</strong><span>${esc(rankingPointsUnit(points))}</span></div></div></div>`;}
function filtersHtml(){return `<div class="cw233-ranking-filters-wrap"><div class="cw231-filters cw233-ranking-filters" role="tablist" aria-label="Рейтинг по турнирам">${RANKING_FILTERS.map(filter=>`<button type="button" data-cw233-rank-filter="${filter.key}" aria-selected="${filter.key===active}">${filter.label}</button>`).join('')}</div></div>`;}
function podiumClass(position){return position>=1&&position<=3?` is-podium is-podium-${position}`:'';}
function rankingHtml(){const positioned=withRankingPositions(rows);if(!positioned.length)return '<div class="empty"><div class="cw233-ranking-empty"><strong>Рейтинг формируется</strong><span>Участники появятся здесь автоматически</span></div></div>';const title=rankingTitleForCompetition(active);return `<div class="cw233-ranking-section"><div class="section-title cw233-ranking-section-head"><h3>${esc(title)}</h3><span>${esc(rankingParticipantCountLabel(positioned.length))}</span></div><div class="card"><div class="cw233-ranking-list">${positioned.map(row=>{const isMe=me?.user_id===row.user_id;const name=text(row.display_name)||'Участник';const username=text(row.username).replace(/^@/,'');const points=Number(row.points)||0;return `<div class="cw233-ranking-row${podiumClass(row.position)}${isMe?' is-me':''}"><div class="cw233-ranking-position${podiumClass(row.position)}"><span class="cw233-ranking-position-value">${row.position}</span></div><div class="cw233-ranking-avatar">${esc(initials(name))}</div><div class="cw233-ranking-person"><div class="cw233-ranking-name">${esc(name)}</div>${username?`<span class="cw233-ranking-username">@${esc(username)}</span>`:''}</div><div class="cw233-ranking-points"><strong class="cw233-ranking-points-value">${points}</strong><span class="cw233-ranking-points-unit">${esc(rankingPointsUnit(points))}</span></div></div>`;}).join('')}</div></div></div>`;}

function ensureRankingShell(){
  if(!pageActive)return null;const main=contentNode();if(!main)return null;
  let page=main.querySelector('.cw233-ranking-page');
  const theme=rankingThemeForCompetition(active);
  if(!page){main.innerHTML=`<div class="cw233-ranking-page" data-cw233-theme="${theme}" data-cw233-round11-theme="${theme}"><div class="cw233-ranking-hero-slot">${heroHtml()}</div>${filtersHtml()}<div class="cw233-ranking-content"></div></div>`;page=main.querySelector('.cw233-ranking-page');}
  return page;
}
function updateRankingChrome(){
  const page=ensureRankingShell();if(!page)return;const theme=rankingThemeForCompetition(active);page.dataset.cw233Theme=theme;page.dataset.cw233Round11Theme=theme;
  const hero=page.querySelector('.cw233-ranking-hero-slot');if(hero)setHtmlIfChanged(hero,heroHtml());
  for(const button of page.querySelectorAll('[data-cw233-rank-filter]'))button.setAttribute('aria-selected',String(button.dataset.cw233RankFilter===active));
}
function renderRankingContent({loading=false,error=null}={}){
  const page=ensureRankingShell();if(!page)return;const target=page.querySelector('.cw233-ranking-content');if(!target)return;
  if(loading){setHtmlIfChanged(target,'<div class="cw233-ranking-skeleton" aria-hidden="true"><div class="cw233-ranking-skeleton-row"></div><div class="cw233-ranking-skeleton-row"></div><div class="cw233-ranking-skeleton-row"></div></div>');return;}
  if(error){setHtmlIfChanged(target,`<div class="empty"><div class="cw233-ranking-empty"><strong>Не удалось загрузить рейтинг</strong><span>${esc(error?.code||'Попробуйте ещё раз')}</span></div></div>`);return;}
  setHtmlIfChanged(target,rankingHtml());
}
function applyRows(nextRows){rows=Array.isArray(nextRows)?nextRows:[];me=resolveCurrentRankingRow(rows,telegramUser());updateRankingChrome();renderRankingContent();}

async function prefetchRankingScope(filter){
  const auth=initData();if(!auth)return false;client=client||createPredictionClient({initData:auth});
  try{
    const value=filter.key==='overall'?await client.rankings({scope:'overall'}):await client.rankings({scope:'competition',competition:filter.key});
    if(Array.isArray(value))rankingCache.set(filter.key,{rows:value,at:Date.now()});
    return true;
  }catch{return false;}
}

async function load(nextScope=active){
  const generation=++loadGeneration;pageActive=true;active=nextScope||'overall';client=client||createPredictionClient({initData:initData()});
  const cached=rankingCache.get(active);
  if(cached){applyRows(cached.rows);}else{rows=[];me=null;updateRankingChrome();renderRankingContent({loading:true});}
  try{
    const ranking=active==='overall'?await client.rankings({scope:'overall'},cached?{force:true}:undefined):await client.rankings({scope:'competition',competition:active},cached?{force:true}:undefined);
    if(!pageActive||generation!==loadGeneration)return;
    const normalized=Array.isArray(ranking)?ranking:[];rankingCache.set(active,{rows:normalized,at:Date.now()});applyRows(normalized);
  }catch(error){if(!pageActive||generation!==loadGeneration)return;if(cached){applyRows(cached.rows);}else renderRankingContent({error});}
}
function close(){pageActive=false;loadGeneration+=1;}
function scheduleRankingPrefetch(){
  const run=()=>{void prefetchRankingScope(RANKING_FILTERS[0]);};
  if(typeof globalThis.queueMicrotask==='function')globalThis.queueMicrotask(run);else setTimeout(run,0);
  const warmCompetitions=()=>{for(const filter of RANKING_FILTERS.filter(filter=>filter.key!=='overall'))void prefetchRankingScope(filter);};
  if(typeof globalThis.requestIdleCallback==='function')globalThis.requestIdleCallback(warmCompetitions,{timeout:900});else setTimeout(warmCompetitions,450);
}

export function installRankingUi(){
  if(typeof document==='undefined')return null;ensureRankingPremiumStyle();scheduleRankingPrefetch();document.addEventListener('click',event=>{
    const nav=event.target?.closest?.('.nav button[data-tab]');if(nav?.dataset?.tab==='table'){void load(active);return;}if(nav){close();return;}if(!pageActive)return;
    const filter=event.target?.closest?.('[data-cw233-rank-filter]');if(filter){const next=filter.dataset.cw233RankFilter||'overall';if(next===active&&rankingCache.has(next))return;void load(next);}
  });return Object.freeze({open:()=>load(active),close});
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installRankingUi(),{once:true});else installRankingUi();}
