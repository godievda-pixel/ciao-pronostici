export const MULTITOURNAMENT_CARD_THEME_MARKER = 'ciao-prod-multitournament-card-theme-20260907';
const MULTITOURNAMENT_MARKER = 'ciao-prod-multitournament-matches-20260907';
const FINAL_IIFE_MARKER = '  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script>';

export function multitournamentCardThemeSource() {
  return `
  /* ${MULTITOURNAMENT_CARD_THEME_MARKER} */
  function __cwMtPolishState(match){
    if(match?.status==='live')return 'live';
    if(match?.status==='finished')return 'finished';
    if(match?.status==='postponed')return 'postponed';
    if(match?.status==='cancelled')return 'cancelled';
    return 'upcoming'
  }
  function __cwMtPolishStatus(match){
    if(match?.status==='live'){const minute=Number(match?.minute);return 'LIVE'+(Number.isFinite(minute)?' · '+minute+'′':'')}
    if(match?.status==='finished')return 'Матч завершён';
    if(match?.status==='postponed')return 'Матч перенесён';
    if(match?.status==='cancelled')return 'Матч отменён';
    return 'Матч не начался'
  }
  function __cwMtPolishScore(match){
    if((match?.status==='live'||match?.status==='finished')&&match?.homeScore!=null&&match?.awayScore!=null)return String(match.homeScore)+':'+String(match.awayScore);
    return '— : —'
  }
  function __cwMtPolishCaption(match){
    if(match?.status==='live')return 'счёт обновляется автоматически';
    if(match?.status==='finished')return 'финальный счёт';
    if(match?.status==='postponed')return 'матч перенесён';
    if(match?.status==='cancelled')return 'матч отменён';
    return 'ожидаем начало'
  }
  function __cwMtPolishDateTime(value){
    const time=Date.parse(value||'');
    if(!Number.isFinite(time))return 'Дата уточняется';
    try{
      const parts=new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(time));
      const pick=type=>parts.find(part=>part.type===type)?.value||'';
      const day=pick('day'),month=pick('month'),hour=pick('hour'),minute=pick('minute');
      return day&&month&&hour&&minute?day+'.'+month+' · '+hour+':'+minute:__cwMtKickoff(value)
    }catch(_e){return __cwMtKickoff(value)}
  }

  __cwMtCrest=function(team){const url=String(team?.crestUrl||'').trim();return url?'<img class="logo cwmt-board-logo" loading="lazy" decoding="async" src="'+__cwMtEsc(url)+'" alt="">':'<span class="logo cwmt-board-logo cwmt-board-logo--empty" aria-hidden="true"></span>'};
  __cwMtTeamHtml=function(team,side){const local=team?.isItalian?__cwMtLocalClubId(team):0;const body=__cwMtCrest(team)+'<div class="board-team-name">'+__cwMtEsc(team?.name||'—')+'</div>';return local?'<button type="button" class="board-team cwmt-team cwmt-team--'+side+' cwmt-team--link" data-cwmt-local-club="'+local+'">'+body+'</button>':'<div class="board-team cwmt-team cwmt-team--'+side+'">'+body+'</div>'};
  __cwMtCenterHtml=function(match){return '<div class="board-score '+(__cwMtPolishState(match)==='upcoming'?'waiting':'')+'">'+__cwMtEsc(__cwMtPolishScore(match))+'</div><div class="board-caption">'+__cwMtEsc(__cwMtPolishCaption(match))+'</div>'};
  __cwMtMatchCardHtml=function(match){const state=__cwMtPolishState(match);return '<article class="scoreboard-card cwmt-match-card '+state+'" data-cwmt-match="'+__cwMtEsc(match?.matchId||'')+'"><div class="scoreboard-top"><span class="board-status">'+__cwMtEsc(__cwMtPolishStatus(match))+'</span><span class="board-kickoff">'+__cwMtEsc(__cwMtPolishDateTime(match?.kickoffAt))+'</span></div><div class="scoreboard-main cwmt-match-main">'+__cwMtTeamHtml(match?.homeTeam,'home')+'<div class="board-center cwmt-match-center">'+__cwMtCenterHtml(match)+'</div>'+__cwMtTeamHtml(match?.awayTeam,'away')+'</div></article>'};
  __cwMtPatchVisibleMatches=function(payload){if(!main)return false;const rows=Array.isArray(payload?.matches)?payload.matches:[],hosts=[...(main.querySelectorAll?.('[data-cwmt-match]')||[])];for(const match of rows){const wanted=String(match?.matchId||''),host=hosts.find(el=>String(el.getAttribute?.('data-cwmt-match')||'')===wanted);if(!host)continue;host.className='scoreboard-card cwmt-match-card '+__cwMtPolishState(match);const status=host.querySelector?.('.board-status');if(status)status.textContent=__cwMtPolishStatus(match);const kickoff=host.querySelector?.('.board-kickoff');if(kickoff)kickoff.textContent=__cwMtPolishDateTime(match?.kickoffAt);const center=host.querySelector?.('.cwmt-match-center');if(center)center.innerHTML=__cwMtCenterHtml(match)}return true};

  __cwMtStageShortLabel=function(group){const key=String(group?.key||'');const league=key.match(/^league-(\\d+)$/);if(league)return league[1];if(key==='playoff')return 'Стыки';if(key==='r32')return '1/16';if(key==='r16')return '1/8';if(key==='qf')return '1/4';if(key==='sf')return '1/2';if(key==='final')return 'Финал';return String(group?.label||'Матчи')};

  function __cwMtPolishTheme(key){const theme=key?__cwMtTheme(key):'';if(theme)root.setAttribute('data-cwmt-screen-theme',theme);else root.removeAttribute('data-cwmt-screen-theme')}
  const __cwMtPolishOpenCompetition=__cwMtOpenCompetition;
  __cwMtOpenCompetition=async function(key){__cwMtPolishTheme(key);return __cwMtPolishOpenCompetition(key)};
  const __cwMtPolishOpenHub=__cwMtOpenHub;
  __cwMtOpenHub=function(){__cwMtPolishTheme('');return __cwMtPolishOpenHub()};
  const __cwMtPolishResetOnLeave=__cwMtResetOnLeave;
  __cwMtResetOnLeave=function(){__cwMtPolishTheme('');return __cwMtPolishResetOnLeave()};
  __cwMtPolishTheme(__cwMtCompetition);

  try{const styleId='cwmt-card-theme-style';if(!document.getElementById(styleId)){const style=document.createElement('style');style.id=styleId;style.textContent='\
#ciao-miniapp-root .brand small{display:none!important}\
#ciao-miniapp-root[data-cwmt-screen-theme="serie-a"]{--cwmt-a:#3150ff;--cwmt-b:#0b2f88;--cwmt-a-rgb:49,80,255;--cwmt-b-rgb:11,47,136;--cwmt-card-top:#0d173a;--cwmt-card-bottom:#070e26;background:radial-gradient(circle at 50% -10%,rgba(49,80,255,.34),transparent 34%),radial-gradient(circle at 100% 12%,rgba(11,47,136,.18),transparent 30%),linear-gradient(180deg,#040919 0%,#050b1d 46%,#030817 100%)!important}\
#ciao-miniapp-root[data-cwmt-screen-theme="coppa"]{--cwmt-a:#159457;--cwmt-b:#9f2435;--cwmt-a-rgb:21,148,87;--cwmt-b-rgb:159,36,53;--cwmt-card-top:#10231b;--cwmt-card-bottom:#090f0d;background:radial-gradient(circle at 18% -8%,rgba(21,148,87,.30),transparent 34%),radial-gradient(circle at 92% 4%,rgba(159,36,53,.22),transparent 32%),linear-gradient(180deg,#07100d 0%,#090d0d 48%,#050908 100%)!important}\
#ciao-miniapp-root[data-cwmt-screen-theme="champions"]{--cwmt-a:#5367e6;--cwmt-b:#49318f;--cwmt-a-rgb:83,103,230;--cwmt-b-rgb:73,49,143;--cwmt-card-top:#151a4a;--cwmt-card-bottom:#090d25;background:radial-gradient(circle at 50% -8%,rgba(83,103,230,.34),transparent 35%),radial-gradient(circle at 96% 12%,rgba(73,49,143,.24),transparent 30%),linear-gradient(180deg,#070a20 0%,#090c25 48%,#050718 100%)!important}\
#ciao-miniapp-root[data-cwmt-screen-theme="europa"]{--cwmt-a:#e66a13;--cwmt-b:#7a2c05;--cwmt-a-rgb:230,106,19;--cwmt-b-rgb:122,44,5;--cwmt-card-top:#261207;--cwmt-card-bottom:#100a07;background:radial-gradient(circle at 50% -8%,rgba(230,106,19,.30),transparent 35%),radial-gradient(circle at 100% 10%,rgba(122,44,5,.24),transparent 30%),linear-gradient(180deg,#130904 0%,#120a06 48%,#090604 100%)!important}\
#ciao-miniapp-root[data-cwmt-screen-theme="conference"]{--cwmt-a:#28a968;--cwmt-b:#0b3b28;--cwmt-a-rgb:40,169,104;--cwmt-b-rgb:11,59,40;--cwmt-card-top:#0d281b;--cwmt-card-bottom:#07120d;background:radial-gradient(circle at 50% -8%,rgba(40,169,104,.30),transparent 35%),radial-gradient(circle at 100% 12%,rgba(11,59,40,.24),transparent 30%),linear-gradient(180deg,#06120c 0%,#07150f 48%,#040b08 100%)!important}\
#ciao-miniapp-root[data-cwmt-screen-theme] .header{background:linear-gradient(180deg,rgba(var(--cwmt-a-rgb),.14),rgba(3,8,23,.84) 78%,transparent)!important}\
#ciao-miniapp-root[data-cwmt-screen-theme] .cwmt-match-card{background:radial-gradient(circle at 50% -20%,rgba(var(--cwmt-a-rgb),.20),transparent 48%),radial-gradient(circle at 100% 0%,rgba(var(--cwmt-b-rgb),.10),transparent 34%),linear-gradient(180deg,var(--cwmt-card-top),var(--cwmt-card-bottom))!important;border-color:rgba(var(--cwmt-a-rgb),.23)!important}\
#ciao-miniapp-root[data-cwmt-screen-theme] .cwmt-match-card::after{background:linear-gradient(90deg,transparent,rgba(var(--cwmt-a-rgb),.62),transparent)!important}\
#ciao-miniapp-root[data-cwmt-screen-theme] .cwmt-match-card.finished .board-status{color:rgba(255,255,255,.86);background:rgba(var(--cwmt-a-rgb),.12);border-color:rgba(var(--cwmt-a-rgb),.24)}\
#ciao-miniapp-root .cwmt-match-card .cwmt-team,#ciao-miniapp-root .cwmt-match-card .cwmt-team--away{flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;gap:8px!important}\
#ciao-miniapp-root .cwmt-match-card .cwmt-board-logo.logo{width:45px!important;height:45px!important;flex-basis:45px!important;object-fit:contain}\
#ciao-miniapp-root .cwmt-match-main{grid-template-columns:minmax(0,1fr) minmax(92px,auto) minmax(0,1fr)!important;gap:8px!important}\
#ciao-miniapp-root .cwmt-match-center{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0}\
#ciao-miniapp-root .cwmt-rounds .round-chip{flex:0 0 auto!important;min-width:42px!important;height:40px!important;padding:0 12px!important;white-space:nowrap!important;border-radius:14px!important}\
#ciao-miniapp-root[data-cwmt-screen-theme] .cwmt-rounds .round-chip.active{background:linear-gradient(135deg,var(--cwmt-a),var(--cwmt-b))!important;border-color:rgba(255,255,255,.22)!important;box-shadow:0 8px 22px rgba(var(--cwmt-a-rgb),.20)}\
@media(max-width:390px){#ciao-miniapp-root .cwmt-match-card .cwmt-board-logo.logo{width:40px!important;height:40px!important;flex-basis:40px!important}#ciao-miniapp-root .cwmt-match-main{grid-template-columns:minmax(0,1fr) 82px minmax(0,1fr)!important;gap:5px!important}}';document.head.appendChild(style)}}catch(_e){}
  /* /${MULTITOURNAMENT_CARD_THEME_MARKER} */
`;
}

export function injectMultitournamentCardThemePatch(input) {
  const html = String(input || '');
  if (html.includes(MULTITOURNAMENT_CARD_THEME_MARKER)) return html;
  if (!html.includes(MULTITOURNAMENT_MARKER)) throw new Error('production multitournament runtime missing before card-theme patch');
  const index = html.lastIndexOf(FINAL_IIFE_MARKER);
  if (index < 0) throw new Error('production v22.5 final IIFE marker missing');
  return `${html.slice(0, index)}${multitournamentCardThemeSource()}${html.slice(index)}`;
}

export function validateMultitournamentCardThemePatchedHtml(input) {
  const html = String(input || '');
  const count = html.split(MULTITOURNAMENT_CARD_THEME_MARKER).length - 1;
  if (count !== 2) throw new Error(`production card-theme patch marker count invalid: ${count}`);
  if (!html.includes('scoreboard-top') || !html.includes('board-status') || !html.includes('board-kickoff')) throw new Error('Serie A scoreboard anatomy missing from external cards');
  if (!html.includes('data-cwmt-screen-theme')) throw new Error('tournament screen theme hook missing');
  return true;
}
