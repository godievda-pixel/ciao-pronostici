import { BSD_TEAM_ID_BY_LOCAL_ID } from './bsd-crests.mjs';

export const MULTITOURNAMENT_PATCH_MARKER = 'ciao-prod-multitournament-matches-20260907';
const FINAL_IIFE_MARKER = '  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script>';

const COMPETITIONS = Object.freeze([
  { key: 'serie_a', title: 'Серия А', theme: 'serie-a', wide: true },
  { key: 'coppa_italia', title: 'Кубок Италии', theme: 'coppa', wide: false },
  { key: 'ucl', title: 'Лига Чемпионов', theme: 'champions', wide: false },
  { key: 'uel', title: 'Лига Европы', theme: 'europa', wide: false },
  { key: 'uecl', title: 'Лига Конференций', theme: 'conference', wide: false },
]);

function reverseTeamMap() {
  return Object.freeze(Object.fromEntries(
    Object.entries(BSD_TEAM_ID_BY_LOCAL_ID).map(([localId, bsdId]) => [String(bsdId), Number(localId)]),
  ));
}

function cardSource(item) {
  const wide = item.wide ? ' cwmt-tournament-card--wide' : '';
  return '<button data-cwmt-competition="' + item.key + '" class="cwmt-tournament-card' + wide + '" data-cwmt-theme="' + item.theme + '" type="button"><span>' + item.title + '</span><i aria-hidden="true">→</i></button>';
}

export function multitournamentRuntimeSource() {
  const competitionJson = JSON.stringify(Object.fromEntries(COMPETITIONS.map(item => [item.key, item])));
  const reverseMapJson = JSON.stringify(reverseTeamMap());
  const cards = COMPETITIONS.map(cardSource).join('');

  return `
  /* ${MULTITOURNAMENT_PATCH_MARKER} */
  const __CWMT_COMPETITIONS=${competitionJson};
  const __CWMT_LOCAL_BY_BSD=${reverseMapJson};
  const __cwMtLegacyCalendar=calendar;
  const __cwMtLegacyBind=bind;
  const __cwMtLegacyRefreshLive=refreshLive;
  let __cwMtCompetition='';
  let __cwMtStageKey='';
  let __cwMtPayload=null;
  let __cwMtLoading=false;
  let __cwMtError='';
  let __cwMtRequestVersion=0;
  let __cwMtRefreshTimer=0;
  let __cwMtRefreshError='';

  function __cwMtEsc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function __cwMtMeta(key){return __CWMT_COMPETITIONS[key]||null}
  function __cwMtTheme(key){return __cwMtMeta(key)?.theme||'serie-a'}
  function __cwMtCrest(team){const url=String(team?.crestUrl||'').trim();return url?'<img class="board-logo cwmt-board-logo" loading="lazy" decoding="async" src="'+__cwMtEsc(url)+'" alt="">':'<span class="board-logo cwmt-board-logo cwmt-board-logo--empty" aria-hidden="true"></span>'}
  function __cwMtLocalClubId(team){const id=String(team?.id??'');return Number(__CWMT_LOCAL_BY_BSD[id]||0)}
  function __cwMtTeamHtml(team,side){const local=team?.isItalian?__cwMtLocalClubId(team):0;const body=__cwMtCrest(team)+'<span class="board-team-name">'+__cwMtEsc(team?.name||'—')+'</span>';return local?'<button type="button" class="board-team cwmt-team cwmt-team--'+side+' cwmt-team--link" data-cwmt-local-club="'+local+'">'+body+'</button>':'<div class="board-team cwmt-team cwmt-team--'+side+'">'+body+'</div>'}
  function __cwMtKickoff(value){const time=Date.parse(value||'');if(!Number.isFinite(time))return 'Время уточняется';try{return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(new Date(time))}catch(_e){return 'Время уточняется'}}
  function __cwMtCenterHtml(match){const score=(match?.homeScore!=null&&match?.awayScore!=null)?String(match.homeScore)+':'+String(match.awayScore):'';if(match?.status==='live'){const minute=Number(match?.minute);return '<div class="board-score">'+__cwMtEsc(score||'LIVE')+'</div><div class="cwmt-live">LIVE'+(Number.isFinite(minute)?' · '+minute+'′':'')+'</div>'}if(match?.status==='finished')return '<div class="board-score">'+__cwMtEsc(score||'—')+'</div><div class="cwmt-status">Завершён</div>';if(match?.status==='postponed')return '<div class="cwmt-status cwmt-status--notice">Перенесён</div>';if(match?.status==='cancelled')return '<div class="cwmt-status cwmt-status--notice">Отменён</div>';return '<div class="board-score cwmt-kickoff">'+__cwMtEsc(__cwMtKickoff(match?.kickoffAt))+'</div>'}
  function __cwMtMatchCardHtml(match){return '<article class="scoreboard-card cwmt-match-card" data-cwmt-match="'+__cwMtEsc(match?.matchId||'')+'"><div class="scoreboard-main cwmt-match-main">'+__cwMtTeamHtml(match?.homeTeam,'home')+'<div class="cwmt-match-center">'+__cwMtCenterHtml(match)+'</div>'+__cwMtTeamHtml(match?.awayTeam,'away')+'</div></article>'}
  function __cwMtGroups(){const matches=Array.isArray(__cwMtPayload?.matches)?__cwMtPayload.matches:[],map=new Map();for(const match of matches){const key=String(match?.stageKey||'matches');if(!map.has(key))map.set(key,{key,label:String(match?.stageLabel||'Матчи'),order:Number(match?.stageOrder??9999),matches:[]});map.get(key).matches.push(match)}const firstTime=group=>{const times=group.matches.map(m=>Date.parse(m?.kickoffAt||'')).filter(Number.isFinite);return times.length?Math.min(...times):Number.POSITIVE_INFINITY};return [...map.values()].sort((a,b)=>firstTime(a)-firstTime(b)||a.order-b.order||a.label.localeCompare(b.label,'ru'))}
  function __cwMtSelectedGroup(){const groups=__cwMtGroups();if(!groups.length)return null;if(!__cwMtStageKey||!groups.some(g=>g.key===__cwMtStageKey))__cwMtStageKey=groups[0].key;return groups.find(g=>g.key===__cwMtStageKey)||groups[0]}
  function __cwMtStageShortLabel(group){const key=String(group?.key||'');const league=key.match(/^league-(\d+)$/);if(league)return league[1]+' тур';if(key==='playoff')return 'Стыки';if(key==='r32')return '1/16';if(key==='r16')return '1/8';if(key==='qf')return '1/4';if(key==='sf')return '1/2';if(key==='final')return 'Финал';return String(group?.label||'Матчи')}
  function __cwMtStageBarHtml(){const groups=__cwMtGroups();return groups.length?'<div class="rounds cwmt-rounds">'+groups.map(g=>'<button type="button" class="round-chip '+(g.key===__cwMtStageKey?'active':'')+'" data-cwmt-stage="'+__cwMtEsc(g.key)+'" title="'+__cwMtEsc(g.label)+'">'+__cwMtEsc(__cwMtStageShortLabel(g))+'</button>').join('')+'</div>':''}
  function __cwMtCoverHtml(key){const meta=__cwMtMeta(key)||__CWMT_COMPETITIONS.serie_a;return '<section class="cwmt-cover" data-cwmt-theme="'+__cwMtEsc(meta.theme)+'"><div class="cwmt-cover-row"><button type="button" class="cwmt-back" data-cwmt-action="hub" aria-label="Назад">←</button><h2>'+__cwMtEsc(meta.title)+'</h2></div></section>'}
  function __cwMtHubHtml(){return '<section class="cwmt-hub"><div class="section-title cwmt-hub-title"><h3>Матчи</h3></div><div class="cwmt-grid">${cards}</div></section>'}

  function __cwMtIsoDate(year,month,day){return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')}
  function __cwMtSeasonRange(now=new Date()){const d=now instanceof Date?now:new Date(now),year=d.getFullYear(),month=d.getMonth()+1,startYear=month>=7?year:year-1;return {from:__cwMtIsoDate(startYear,7,1),to:__cwMtIsoDate(startYear+1,6,30)}}
  function __cwMtGroupSignature(payload){const rows=Array.isArray(payload?.matches)?payload.matches:[],keys=[];for(const m of rows){const k=String(m?.stageKey||'matches');if(!keys.includes(k))keys.push(k)}return keys.join('|')}
  function __cwMtApplyPayload(version,payload,{quiet=false}={}){if(version!==__cwMtRequestVersion)return false;if(!payload||String(payload?.competition||'')!==String(__cwMtCompetition||''))return false;const selected=__cwMtStageKey,prevSignature=__cwMtGroupSignature(__cwMtPayload),nextSignature=__cwMtGroupSignature(payload);__cwMtPayload=payload;__cwMtLoading=false;__cwMtError='';__cwMtRefreshError='';const groups=__cwMtGroups();if(selected&&groups.some(g=>g.key===selected))__cwMtStageKey=selected;else __cwMtStageKey=groups[0]?.key||'';if(quiet&&prevSignature===nextSignature&&main){__cwMtPatchVisibleMatches(payload)}else render();return true}
  function __cwMtPatchVisibleMatches(payload){if(!main)return false;const rows=Array.isArray(payload?.matches)?payload.matches:[],hosts=[...(main.querySelectorAll?.('[data-cwmt-match]')||[])];for(const match of rows){const wanted=String(match?.matchId||''),host=hosts.find(el=>String(el.getAttribute?.('data-cwmt-match')||'')===wanted);if(!host)continue;const center=host.querySelector?.('.cwmt-match-center');if(center)center.innerHTML=__cwMtCenterHtml(match)}return true}
  async function __cwMtLoadCompetition(key,{quiet=false}={}){if(!__cwMtMeta(key)||key==='serie_a')return false;const version=++__cwMtRequestVersion;const selectedAtStart=__cwMtCompetition;if(!quiet){__cwMtLoading=true;__cwMtError='';render()}try{const range=__cwMtSeasonRange(new Date()),url=new URL('/api/cw22/matches',location.origin);url.searchParams.set('competition',key);url.searchParams.set('from',range.from);url.searchParams.set('to',range.to);const response=await fetch(url,{headers:{accept:'application/json','x-telegram-init-data':initData},cache:'no-store'});if(!response?.ok)throw new Error('HTTP '+Number(response?.status||0));const body=await response.json(),payload=body?.data;if(version!==__cwMtRequestVersion||selectedAtStart!==__cwMtCompetition||key!==__cwMtCompetition)return false;return __cwMtApplyPayload(version,payload,{quiet})}catch(error){if(version!==__cwMtRequestVersion||selectedAtStart!==__cwMtCompetition||key!==__cwMtCompetition)return false;__cwMtLoading=false;if(quiet&&__cwMtPayload){__cwMtRefreshError=String(error?.message||'refresh_failed');return false}__cwMtError=String(error?.message||'load_failed');render();return false}}
  function __cwMtStopRefresh(){if(__cwMtRefreshTimer){clearInterval(__cwMtRefreshTimer);__cwMtRefreshTimer=0}}
  function __cwMtStartRefresh(){__cwMtStopRefresh();if(!(tab==='calendar'&&__cwMtCompetition&&__cwMtCompetition!=='serie_a'))return;__cwMtRefreshTimer=setInterval(()=>{if(tab==='calendar'&&__cwMtCompetition&&__cwMtCompetition!=='serie_a'&&!document.hidden)__cwMtLoadCompetition(__cwMtCompetition,{quiet:true})},30000)}

  function __cwMtExternalCompetitionHtml(){const meta=__cwMtMeta(__cwMtCompetition);if(!meta)return __cwMtHubHtml();const cover=__cwMtCoverHtml(__cwMtCompetition);if(__cwMtLoading&&!__cwMtPayload)return cover+'<div class="cwmt-state">Загружаем матчи…</div>';if(__cwMtError&&!__cwMtPayload)return cover+'<div class="cwmt-state"><b>Не удалось загрузить матчи</b><button type="button" data-cwmt-action="retry">Повторить</button></div>';const group=__cwMtSelectedGroup();if(!group)return cover+'<div class="cwmt-state">Матчей пока нет</div>';return cover+__cwMtStageBarHtml()+'<div class="section-title cwmt-stage-title"><h3>'+__cwMtEsc(group.label)+'</h3></div><div class="scoreboards cwmt-scoreboards">'+group.matches.map(__cwMtMatchCardHtml).join('')+'</div>'}

  calendar=function(){if(!__cwMtCompetition)return __cwMtHubHtml();if(__cwMtCompetition==='serie_a')return __cwMtCoverHtml('serie_a')+__cwMtLegacyCalendar();return __cwMtExternalCompetitionHtml()};

  async function __cwMtOpenCompetition(key){if(!__cwMtMeta(key))return;__cwMtStopRefresh();__cwMtCompetition=key;__cwMtStageKey='';__cwMtError='';__cwMtRefreshError='';if(key==='serie_a'){__cwMtPayload=null;render();return}__cwMtPayload=null;render();await __cwMtLoadCompetition(key,{quiet:false});__cwMtStartRefresh()}
  function __cwMtOpenHub(){__cwMtStopRefresh();__cwMtCompetition='';__cwMtStageKey='';__cwMtPayload=null;__cwMtLoading=false;__cwMtError='';__cwMtRefreshError='';__cwMtRequestVersion+=1;render()}
  function __cwMtResetOnLeave(){__cwMtStopRefresh();__cwMtCompetition='';__cwMtStageKey='';__cwMtPayload=null;__cwMtLoading=false;__cwMtError='';__cwMtRefreshError='';__cwMtRequestVersion+=1}

  bind=function(){__cwMtLegacyBind();root.querySelectorAll('[data-cwmt-competition]').forEach(btn=>btn.addEventListener('click',()=>__cwMtOpenCompetition(String(btn.getAttribute('data-cwmt-competition')||''))));root.querySelectorAll('[data-cwmt-stage]').forEach(btn=>btn.addEventListener('click',()=>{__cwMtStageKey=String(btn.getAttribute('data-cwmt-stage')||'');render()}));root.querySelector('[data-cwmt-action="hub"]')?.addEventListener('click',__cwMtOpenHub);root.querySelector('[data-cwmt-action="retry"]')?.addEventListener('click',()=>__cwMtLoadCompetition(__cwMtCompetition,{quiet:false}));root.querySelectorAll('[data-cwmt-local-club]').forEach(btn=>btn.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();const id=Number(btn.getAttribute('data-cwmt-local-club'));if(id>0)openClubProfile(id)}));root.querySelectorAll('button[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{if(String(btn.getAttribute('data-tab')||'')!=='calendar')__cwMtResetOnLeave()}))};

  refreshLive=async function(){const result=await __cwMtLegacyRefreshLive();return result};

  try{const n=root.querySelector('button[data-tab="mine"] .nav-label');if(n)n.textContent='Прогнозы'}catch(_e){}
  try{const n=root.querySelector('button[data-tab="table"] .nav-label');if(n)n.textContent='Рейтинг'}catch(_e){}
  try{const n=root.querySelector('button[data-tab="seriea"] .nav-label');if(n)n.textContent='Таблицы'}catch(_e){}
  try{const styleId='cwmt-production-style';if(!document.getElementById(styleId)){const style=document.createElement('style');style.id=styleId;style.textContent='\
#ciao-miniapp-root .cwmt-hub{padding-top:2px}\
#ciao-miniapp-root .cwmt-hub-title{margin-bottom:12px}\
#ciao-miniapp-root .cwmt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}\
#ciao-miniapp-root .cwmt-tournament-card{position:relative;min-height:94px;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:16px 15px;display:flex;align-items:flex-end;justify-content:space-between;text-align:left;color:#fff;font:inherit;font-weight:900;font-size:15px;line-height:1.12;overflow:hidden;box-shadow:0 12px 28px rgba(0,0,0,.18);transition:transform .12s ease,border-color .15s ease}\
#ciao-miniapp-root .cwmt-tournament-card:active{transform:scale(.985)}\
#ciao-miniapp-root .cwmt-tournament-card i{font-style:normal;font-size:21px;line-height:1;opacity:.82}\
#ciao-miniapp-root .cwmt-tournament-card--wide{grid-column:1/-1;min-height:104px}\
#ciao-miniapp-root [data-cwmt-theme="serie-a"]{--cwmt-a:#3150ff;--cwmt-b:#0b2f88;background:radial-gradient(circle at 88% 0%,rgba(92,164,255,.35),transparent 40%),linear-gradient(135deg,var(--cwmt-a),var(--cwmt-b))}\
#ciao-miniapp-root [data-cwmt-theme="coppa"]{--cwmt-a:#159457;--cwmt-b:#9f2435;background:linear-gradient(120deg,rgba(21,148,87,.52),transparent 44%),linear-gradient(240deg,rgba(159,36,53,.56),transparent 48%),#11151d}\
#ciao-miniapp-root [data-cwmt-theme="champions"]{--cwmt-a:#3d4ec9;--cwmt-b:#33246f;background:radial-gradient(circle at 85% 10%,rgba(112,126,255,.42),transparent 34%),linear-gradient(135deg,var(--cwmt-a),var(--cwmt-b))}\
#ciao-miniapp-root [data-cwmt-theme="europa"]{--cwmt-a:#e66a13;--cwmt-b:#3a1b08;background:radial-gradient(circle at 88% 8%,rgba(255,126,31,.42),transparent 35%),linear-gradient(135deg,var(--cwmt-a),var(--cwmt-b))}\
#ciao-miniapp-root [data-cwmt-theme="conference"]{--cwmt-a:#28a968;--cwmt-b:#0b3b28;background:radial-gradient(circle at 88% 8%,rgba(71,216,137,.35),transparent 35%),linear-gradient(135deg,var(--cwmt-a),var(--cwmt-b))}\
#ciao-miniapp-root .cwmt-cover{min-height:82px;border-radius:21px;padding:14px 16px;margin-bottom:12px;display:flex;align-items:center;overflow:hidden;border:1px solid rgba(255,255,255,.12);box-shadow:0 14px 30px rgba(0,0,0,.18)}\
#ciao-miniapp-root .cwmt-cover-row{width:100%;display:flex;align-items:center;gap:12px}\
#ciao-miniapp-root .cwmt-cover h2{margin:0;color:#fff;font-size:24px;line-height:1.03;letter-spacing:-.035em}\
#ciao-miniapp-root .cwmt-back{flex:0 0 38px;width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(4,10,30,.28);color:#fff;font:900 19px/1 inherit;display:grid;place-items:center;padding:0}\
#ciao-miniapp-root .cwmt-rounds{display:flex;gap:8px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;padding:2px 2px 9px;margin-bottom:2px}\
#ciao-miniapp-root .cwmt-rounds::-webkit-scrollbar{display:none}\
#ciao-miniapp-root .cwmt-rounds .round-chip{flex:0 0 auto;min-width:56px;height:38px;padding:0 13px;display:flex;align-items:center;justify-content:center;white-space:nowrap;border-radius:14px;font-size:12px;line-height:1}\
#ciao-miniapp-root .cwmt-rounds .round-chip.active{background:linear-gradient(135deg,var(--cwmt-a,#3150ff),var(--cwmt-b,#0b2f88));border-color:rgba(255,255,255,.2)}\
#ciao-miniapp-root .cwmt-match-main{display:grid;grid-template-columns:minmax(0,1fr) 74px minmax(0,1fr);align-items:center;gap:8px}\
#ciao-miniapp-root .cwmt-team{appearance:none;border:0;background:transparent;color:inherit;padding:0;display:flex;align-items:center;gap:8px;min-width:0;text-align:left;font:inherit}\
#ciao-miniapp-root .cwmt-team--away{flex-direction:row-reverse;text-align:right}\
#ciao-miniapp-root .cwmt-team--link{cursor:pointer;border-radius:12px}\
#ciao-miniapp-root .cwmt-team--link:active{transform:scale(.985);background:rgba(49,80,255,.08)}\
#ciao-miniapp-root .cwmt-board-logo{width:34px;height:34px;object-fit:contain;flex:0 0 34px}\
#ciao-miniapp-root .cwmt-board-logo--empty{border-radius:50%;background:rgba(255,255,255,.07)}\
#ciao-miniapp-root .cwmt-match-center{text-align:center;min-width:0}\
#ciao-miniapp-root .cwmt-live{margin-top:3px;color:#ff526d;font-size:10px;font-weight:950;letter-spacing:.04em}\
#ciao-miniapp-root .cwmt-status{margin-top:3px;color:#91a2cc;font-size:10px;font-weight:800}\
#ciao-miniapp-root .cwmt-status--notice{margin:0;color:#f2b45f;font-size:11px}\
#ciao-miniapp-root .cwmt-kickoff{font-size:15px}\
#ciao-miniapp-root .cwmt-state{border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(255,255,255,.045);padding:18px;color:#91a2cc;text-align:center}\
#ciao-miniapp-root .cwmt-state b{display:block;color:#fff;margin-bottom:10px}\
#ciao-miniapp-root .cwmt-state button{border:0;border-radius:11px;background:#3150ff;color:#fff;padding:9px 13px;font:800 11px/1 inherit}\
@media(max-width:340px){#ciao-miniapp-root .cwmt-grid{grid-template-columns:1fr}#ciao-miniapp-root .cwmt-tournament-card--wide{grid-column:auto}}';document.head.appendChild(style)}}catch(_e){}
  /* /${MULTITOURNAMENT_PATCH_MARKER} */
`;
}

export function injectMultitournamentPatch(input) {
  const html = String(input || '');
  if (html.includes(MULTITOURNAMENT_PATCH_MARKER)) return html;
  const index = html.lastIndexOf(FINAL_IIFE_MARKER);
  if (index < 0) throw new Error('production v22.5 final IIFE marker missing');
  return `${html.slice(0, index)}${multitournamentRuntimeSource()}${html.slice(index)}`;
}

export function validateMultitournamentPatchedHtml(input) {
  const html = String(input || '');
  const count = html.split(MULTITOURNAMENT_PATCH_MARKER).length - 1;
  if (count !== 2) throw new Error(`production multitournament patch marker count invalid: ${count}`);
  for (const key of ['serie_a','coppa_italia','ucl','uel','uecl']) {
    if (!html.includes(`data-cwmt-competition="${key}"`)) throw new Error(`missing tournament card: ${key}`);
  }
  if (!html.includes('Прогнозы') || !html.includes('Рейтинг') || !html.includes('Таблицы')) {
    throw new Error('production bottom navigation labels missing');
  }
  return true;
}
