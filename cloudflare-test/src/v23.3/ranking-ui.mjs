import { createPredictionClient } from './prediction-client.mjs';

export const USER_FEEDBACK_ROUND3_BUILD = '2026-09-02-r3';
export const USER_FEEDBACK_ROUND4_BUILD = '2026-09-02-r4';
export const USER_FEEDBACK_ROUND5_BUILD = '2026-09-02-r5';
export const USER_FEEDBACK_ROUND6_BUILD = '2026-09-02-r6';
export const USER_FEEDBACK_ROUND7_BUILD = '2026-09-03-r7';
export const USER_FEEDBACK_ROUND11_BUILD = '2026-09-03-r11';
export const USER_FEEDBACK_ROUND38_RANKING_BUILD = '2026-09-04-r38-ranking';

export const RANKING_FILTERS = Object.freeze([
  {key:'overall',label:'Общий'}, {key:'serie_a',label:'Серия А'}, {key:'coppa_italia',label:'КИ'},
  {key:'ucl',label:'ЛЧ'}, {key:'uel',label:'ЛЕ'}, {key:'uecl',label:'ЛК'},
]);

const RANKING_TITLES = Object.freeze({
  overall:'Общий рейтинг', serie_a:'Серия А', coppa_italia:'Кубок Италии',
  ucl:'Лига Чемпионов', uel:'Лига Европы', uecl:'Лига Конференций',
});
const RANKING_THEMES = Object.freeze({
  overall:'serie-a', serie_a:'serie-a', coppa_italia:'coppa',
  ucl:'champions', uel:'europa', uecl:'conference',
});
const LEGACY_CORE_API = '/api/ciao-core-api-fast-v4';
const RANKING_STYLE_ID = 'cw233-ranking-round38-style';
const CACHE_TTL_MS = 60_000;

let client = null;
let active = 'overall';
let rows = [];
let me = null;
let pageActive = false;
let loadGeneration = 0;
const rankingCache = new Map();

function text(value) { return String(value ?? '').trim(); }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function initData() { return text(globalThis.Telegram?.WebApp?.initData); }
function telegramUser() { return globalThis.Telegram?.WebApp?.initDataUnsafe?.user || null; }
function contentNode() { return globalThis.document?.querySelector?.('#ciao-miniapp-root .content') || null; }
function setHtmlIfChanged(node, html) { if (!node || node.innerHTML === html) return false; node.innerHTML = html; return true; }

export function rankingThemeForCompetition(value) {
  return RANKING_THEMES[text(value)] || 'serie-a';
}

export function rankingTitleForCompetition(value) {
  return RANKING_TITLES[text(value)] || 'Рейтинг';
}

export function withRankingPositions(value = []) {
  return (Array.isArray(value) ? value : []).map((row,index) => Object.freeze({ position:index + 1, ...row }));
}

function pluralRu(value, one, few, many) {
  const number = Math.abs(Math.trunc(Number(value) || 0));
  const mod100 = number % 100;
  const mod10 = number % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function rankingParticipantCountLabel(value) {
  const number = Math.max(0, Math.trunc(Number(value) || 0));
  return `${number} ${pluralRu(number,'участник','участника','участников')}`;
}

export function rankingPointsLabel(value) {
  const number = Math.trunc(Number(value) || 0);
  return `${number} ${pluralRu(number,'очко','очка','очков')}`;
}

function rankingPointsUnit(value) {
  return rankingPointsLabel(value).replace(/^-?\d+\s+/, '');
}

export function predictorIdFromRankingRow(row = {}) {
  const match = text(row?.user_id || row?.userId).match(/^telegram:(\d+)$/);
  const value = Number(match?.[1]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function favoriteTeamAssetUrl(team = {}) {
  const crest = text(
    team?.crestUrl || team?.crest_url || team?.logo_url || team?.logoUrl || team?.logo || team?.crest,
  );
  if (crest) return crest;
  const customEmojiId = text(team?.customEmojiId || team?.custom_emoji_id);
  return customEmojiId ? `${LEGACY_CORE_API}?asset=emoji&id=${encodeURIComponent(customEmojiId)}` : '';
}

function favoriteTeam(row = {}) {
  const team = row?.favorite_team || row?.favoriteTeam || {};
  return {
    name:text(team?.name || team?.team_name) || 'Любимый клуб',
    assetUrl:favoriteTeamAssetUrl(team),
  };
}

function favoriteClub(row = {}, hero = false) {
  const team = favoriteTeam(row);
  const classes = `cw233-ranking-avatar${hero ? ' cw233-ranking-avatar--hero' : ''}`;
  if (team.assetUrl) {
    return `<div class="${classes}" title="${esc(team.name)}"><img class="cw233-ranking-club-logo" src="${esc(team.assetUrl)}" alt="${esc(team.name)}" loading="eager" decoding="async"></div>`;
  }
  return `<div class="${classes} cw233-ranking-club-placeholder" title="${esc(team.name)}" aria-label="${esc(team.name)}"><span aria-hidden="true">•</span></div>`;
}

export function resolveRankingDisplayName(current,tgUser) {
  const serverName=text(current?.display_name||current?.name);
  if(serverName)return serverName;
  const telegramName=[text(tgUser?.first_name),text(tgUser?.last_name)].filter(Boolean).join(' ');
  if(telegramName)return telegramName;
  const username=text(current?.username||tgUser?.username).replace(/^@/,'');
  return username?`@${username}`:'Участник';
}

export function resolveCurrentRankingRow(rankingRows=[],tgUser={}) {
  const list=Array.isArray(rankingRows)?rankingRows:[];
  let index=list.findIndex(row=>row?.is_current===true);
  if(index<0){
    const id=text(tgUser?.id);
    if(id){
      const wanted=`telegram:${id}`;
      index=list.findIndex(row=>text(row?.user_id)===wanted);
    }
  }
  if(index<0)return null;
  return Object.freeze({position:index+1,...list[index]});
}

function podiumClass(position) {
  return position >= 1 && position <= 3 ? ` is-podium is-podium-${position}` : '';
}

export function renderRankingRow(row = {}, currentUserId = '') {
  const position = Math.max(1, Number(row?.position) || 1);
  const userId = text(row?.user_id || row?.userId);
  const predictorId = predictorIdFromRankingRow(row);
  const isMe = Boolean(row?.is_current) || (currentUserId && userId === currentUserId);
  const name = text(row?.display_name || row?.displayName || row?.name) || 'Участник';
  const username = text(row?.username).replace(/^@/,'');
  const points = Number(row?.points) || 0;
  const predictorAttrs = predictorId
    ? ` data-cw233-predictor-id="${predictorId}" role="button" tabindex="0" aria-label="Открыть профиль ${esc(name)}"`
    : '';
  return `<div class="cw233-ranking-row${podiumClass(position)}${isMe?' is-me':''}"${predictorAttrs}><div class="cw233-ranking-position${podiumClass(position)}"><span class="cw233-ranking-position-value">${position}</span></div>${favoriteClub(row)}<div class="cw233-ranking-person"><div class="cw233-ranking-name">${esc(name)}</div>${username?`<span class="cw233-ranking-username">@${esc(username)}</span>`:''}</div><div class="cw233-ranking-points"><strong class="cw233-ranking-points-value">${points}</strong><span class="cw233-ranking-points-unit">${esc(rankingPointsUnit(points))}</span></div></div>`;
}

function ensureRankingPremiumStyle(documentRef = globalThis.document) {
  if (!documentRef?.head || documentRef.getElementById?.(RANKING_STYLE_ID)) return;
  const style=documentRef.createElement('style');
  style.id=RANKING_STYLE_ID;
  style.textContent=`
    .cw233-ranking-page{min-height:100%;background:var(--cw-app-bg,#061128);color:#fff}
    .cw233-ranking-page .cw233-ranking-list{display:grid!important;gap:8px!important;padding:0!important}
    .cw233-ranking-page .cw233-ranking-row{display:grid!important;grid-template-columns:34px 38px minmax(0,1fr) 58px!important;column-gap:10px!important;align-items:center!important;min-height:62px!important;width:100%!important;padding:10px 11px!important;box-sizing:border-box!important;border:1px solid rgba(102,131,225,.16)!important;border-radius:17px!important;background:linear-gradient(145deg,rgba(20,39,86,.84),rgba(8,22,52,.94))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important;transition:border-color .16s ease,transform .16s ease}
    .cw233-ranking-page .cw233-ranking-row[data-cw233-predictor-id]{cursor:pointer;touch-action:manipulation}
    .cw233-ranking-page .cw233-ranking-row[data-cw233-predictor-id]:active{transform:scale(.992)}
    .cw233-ranking-page .cw233-ranking-row.is-podium-1{border-color:rgba(255,209,82,.72)!important;background:linear-gradient(90deg,rgba(255,196,46,.20),rgba(18,38,83,.92) 48%,rgba(255,196,46,.10))!important;box-shadow:inset 3px 0 0 #ffd052!important}
    .cw233-ranking-page .cw233-ranking-row.is-podium-2{border-color:rgba(210,222,245,.55)!important;background:linear-gradient(90deg,rgba(199,213,240,.16),rgba(18,38,83,.92) 48%,rgba(199,213,240,.08))!important;box-shadow:inset 3px 0 0 #d9e3f5!important}
    .cw233-ranking-page .cw233-ranking-row.is-podium-3{border-color:rgba(211,139,83,.55)!important;background:linear-gradient(90deg,rgba(190,111,58,.17),rgba(18,38,83,.92) 48%,rgba(190,111,58,.08))!important;box-shadow:inset 3px 0 0 #d18a58!important}
    .cw233-ranking-page .cw233-ranking-row.is-podium-1 .cw233-ranking-position{background:linear-gradient(145deg,#7a5a14,#d5a72e)!important;border-color:rgba(255,224,130,.70)!important}
    .cw233-ranking-page .cw233-ranking-row.is-podium-2 .cw233-ranking-position{background:linear-gradient(145deg,#53627a,#aab9d1)!important;border-color:rgba(232,240,255,.55)!important}
    .cw233-ranking-page .cw233-ranking-row.is-podium-3 .cw233-ranking-position{background:linear-gradient(145deg,#75472d,#b56d43)!important;border-color:rgba(236,166,117,.55)!important}
    .cw233-ranking-page .cw233-ranking-position{display:grid!important;place-items:center!important;width:34px!important;height:34px!important;min-width:34px!important;border:1px solid rgba(102,131,225,.18);border-radius:11px;background:rgba(31,55,111,.55)}
    .cw233-ranking-page .cw233-ranking-position-value{display:block!important;width:100%!important;text-align:center!important;font-size:11px!important;font-weight:950!important;line-height:1!important;font-variant-numeric:tabular-nums!important}
    .cw233-ranking-page .cw233-ranking-avatar{display:grid!important;place-items:center!important;width:38px!important;height:38px!important;border:1px solid rgba(102,131,225,.28)!important;border-radius:13px!important;background:linear-gradient(145deg,rgba(49,92,255,.28),rgba(25,55,223,.16))!important;overflow:hidden!important}
    .cw233-ranking-page .cw233-ranking-avatar--hero{width:48px!important;height:48px!important;border-radius:15px!important}
    .cw233-ranking-page .cw233-ranking-club-logo{display:block!important;width:30px!important;height:30px!important;object-fit:contain!important}
    .cw233-ranking-page .cw233-ranking-avatar--hero .cw233-ranking-club-logo{width:36px!important;height:36px!important}
    .cw233-ranking-page .cw233-ranking-club-placeholder span{font-size:18px;color:rgba(180,197,255,.45)}
    .cw233-ranking-page .cw233-ranking-person{display:grid!important;align-content:center!important;gap:3px!important;min-width:0!important;overflow:hidden!important}
    .cw233-ranking-page .cw233-ranking-name{display:block!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:12px!important;font-weight:900!important;line-height:1.2!important;color:#fff!important}
    .cw233-ranking-page .cw233-ranking-username{display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:9px!important;color:rgba(177,194,240,.62)!important}
    .cw233-ranking-page .cw233-ranking-points{display:grid!important;grid-template-rows:auto auto!important;justify-items:end!important;align-content:center!important;gap:2px!important;width:58px!important;min-width:58px!important;text-align:right!important}
    .cw233-ranking-page .cw233-ranking-points-value{font-size:17px!important;font-weight:950!important;line-height:1!important;color:#fff!important}
    .cw233-ranking-page .cw233-ranking-points-unit{font-size:7px!important;font-weight:850!important;text-transform:uppercase!important;color:rgba(177,194,240,.62)!important}
    .cw233-ranking-skeleton{display:grid;gap:8px}.cw233-ranking-skeleton-row{height:62px;border-radius:16px;background:linear-gradient(90deg,rgba(48,64,110,.18),rgba(73,92,151,.28),rgba(48,64,110,.18));background-size:220% 100%;animation:cw233-rank-pulse 1.15s ease-in-out infinite}@keyframes cw233-rank-pulse{to{background-position:-120% 0}}
    @media(max-width:390px){.cw233-ranking-page .cw233-ranking-row{grid-template-columns:32px 36px minmax(0,1fr) 54px!important;column-gap:8px!important;padding-left:9px!important;padding-right:9px!important}.cw233-ranking-page .cw233-ranking-position{width:32px!important;height:32px!important;min-width:32px!important}.cw233-ranking-page .cw233-ranking-avatar{width:36px!important;height:36px!important}.cw233-ranking-page .cw233-ranking-club-logo{width:28px!important;height:28px!important}.cw233-ranking-page .cw233-ranking-points{width:54px!important;min-width:54px!important}.cw233-ranking-page .cw233-ranking-name{font-size:11px!important}.cw233-ranking-page .cw233-ranking-points-value{font-size:16px!important}}
  `;
  documentRef.head.appendChild(style);
}

function usernameLine(current,tgUser){
  const username=text(current?.username||tgUser?.username).replace(/^@/,'');
  return username?`@${username}`:'Рейтинг прогнозистов';
}

function heroHtml(){
  const tgUser=telegramUser();
  const name=resolveRankingDisplayName(me,tgUser);
  const subtitle=usernameLine(me,tgUser);
  const rank=Number(me?.position);
  const points=Number(me?.points)||0;
  return `<div class="hero cw233-ranking-hero"><div class="cw233-ranking-identity">${favoriteClub(me,true)}<div class="cw233-ranking-identity-copy"><span class="cw233-ranking-kicker">УЧАСТНИК</span><h2>${esc(name)}</h2><p>${esc(subtitle)}</p></div></div><div class="cw233-ranking-hero-stats"><div class="cw233-ranking-stat"><strong>${rank>0?`#${rank}`:'—'}</strong><span>место</span></div><div class="cw233-ranking-stat"><strong>${points}</strong><span>${esc(rankingPointsUnit(points))}</span></div></div></div>`;
}

function filtersHtml(){
  return `<div class="cw233-ranking-filters-wrap"><div class="cw231-filters cw233-ranking-filters" role="tablist" aria-label="Рейтинг по турнирам">${RANKING_FILTERS.map(filter=>`<button type="button" data-cw233-rank-filter="${filter.key}" aria-selected="${filter.key===active}">${filter.label}</button>`).join('')}</div></div>`;
}

function rankingHtml(){
  const positioned=withRankingPositions(rows);
  if(!positioned.length)return '<div class="empty"><div class="cw233-ranking-empty"><strong>Рейтинг формируется</strong><span>Участники появятся здесь автоматически</span></div></div>';
  const title=rankingTitleForCompetition(active);
  const currentId=text(me?.user_id);
  return `<div class="cw233-ranking-section"><div class="section-title cw233-ranking-section-head"><h3>${esc(title)}</h3><span>${esc(rankingParticipantCountLabel(positioned.length))}</span></div><div class="card"><div class="cw233-ranking-list">${positioned.map(row=>renderRankingRow(row,currentId)).join('')}</div></div></div>`;
}

function ensureRankingShell(){
  if(!pageActive)return null;
  const main=contentNode();
  if(!main)return null;
  let page=main.querySelector('.cw233-ranking-page');
  const theme=rankingThemeForCompetition(active);
  if(!page){
    main.innerHTML=`<div class="cw233-ranking-page" data-cw233-theme="${theme}" data-cw233-round11-theme="${theme}"><div class="cw233-ranking-hero-slot">${heroHtml()}</div>${filtersHtml()}<div class="cw233-ranking-content"></div></div>`;
    page=main.querySelector('.cw233-ranking-page');
  }
  return page;
}

function updateRankingChrome(){
  const page=ensureRankingShell();
  if(!page)return;
  const theme=rankingThemeForCompetition(active);
  page.dataset.cw233Theme=theme;
  page.dataset.cw233Round11Theme=theme;
  const hero=page.querySelector('.cw233-ranking-hero-slot');
  if(hero)setHtmlIfChanged(hero,heroHtml());
  for(const button of page.querySelectorAll('[data-cw233-rank-filter]')){
    button.setAttribute('aria-selected',String(button.dataset.cw233RankFilter===active));
  }
}

function renderRankingContent({loading=false,error=null}={}){
  const page=ensureRankingShell();
  if(!page)return;
  const target=page.querySelector('.cw233-ranking-content');
  if(!target)return;
  if(loading){
    setHtmlIfChanged(target,'<div class="cw233-ranking-skeleton" aria-hidden="true"><div class="cw233-ranking-skeleton-row"></div><div class="cw233-ranking-skeleton-row"></div><div class="cw233-ranking-skeleton-row"></div></div>');
    return;
  }
  if(error){
    setHtmlIfChanged(target,`<div class="empty"><div class="cw233-ranking-empty"><strong>Не удалось загрузить рейтинг</strong><span>${esc(error?.code||'Попробуйте ещё раз')}</span></div></div>`);
    return;
  }
  setHtmlIfChanged(target,rankingHtml());
}

function applyRows(nextRows){
  rows=Array.isArray(nextRows)?nextRows:[];
  me=resolveCurrentRankingRow(rows,telegramUser());
  updateRankingChrome();
  renderRankingContent();
}

function freshCache(scope, now = Date.now()) {
  const cached=rankingCache.get(scope);
  return cached && now-cached.at<CACHE_TTL_MS ? cached : null;
}

async function load(nextScope=active,{force=false}={}){
  const generation=++loadGeneration;
  pageActive=true;
  active=nextScope||'overall';
  const cached=!force?freshCache(active):null;
  if(cached){
    applyRows(cached.rows);
    return cached.rows;
  }
  rows=[];
  me=null;
  updateRankingChrome();
  renderRankingContent({loading:true});
  try{
    client=client||createPredictionClient({initData:initData()});
    const ranking=active==='overall'
      ? await client.rankings({scope:'overall'})
      : await client.rankings({scope:'competition',competition:active});
    if(!pageActive||generation!==loadGeneration)return [];
    const normalized=Array.isArray(ranking)?ranking:[];
    rankingCache.set(active,{rows:normalized,at:Date.now()});
    applyRows(normalized);
    return normalized;
  }catch(error){
    if(!pageActive||generation!==loadGeneration)return [];
    renderRankingContent({error});
    return [];
  }
}

function close(){pageActive=false;loadGeneration+=1;}

export function installRankingUi(documentRef = globalThis.document){
  if(!documentRef?.addEventListener)return null;
  ensureRankingPremiumStyle(documentRef);
  const onClick=event=>{
    const nav=event.target?.closest?.('.nav button[data-tab]');
    if(nav?.dataset?.tab==='table'){void load(active);return;}
    if(nav){close();return;}
    if(!pageActive)return;
    const filter=event.target?.closest?.('[data-cw233-rank-filter]');
    if(filter){
      const next=filter.dataset.cw233RankFilter||'overall';
      if(next===active&&freshCache(next))return;
      void load(next);
    }
  };
  documentRef.addEventListener('click',onClick);
  return Object.freeze({
    open:()=>load(active),
    close,
    invalidate:scope=>scope?rankingCache.delete(scope):rankingCache.clear(),
    disconnect:()=>documentRef.removeEventListener?.('click',onClick),
  });
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installRankingUi(document),{once:true});
  else installRankingUi(document);
}
