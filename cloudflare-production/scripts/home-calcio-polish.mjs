export const HOME_CALCIO_POLISH_MARKER='ciao-prod-home-calcio-polish-20260908';
const MINE_STAGE_MARKER='ciao-prod-prediction-mine-stage-polish-20260907';
const FINAL_IIFE_MARKER='  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script>';

export function homeCalcioPolishRuntimeSource(){
  return `
  /* ${HOME_CALCIO_POLISH_MARKER} */
  const __CW_HOME_EXT_COMPETITIONS=['coppa_italia','ucl','uel','uecl'];
  const __CW_HOME_CORE_API='https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-core-api-fast-v6';
  let __cwHomeExternalByCompetition=new Map();
  let __cwHomeExternalLoading=false;
  let __cwHomeExternalLoadedAt=0;
  let __cwHomeExternalCenter=null;
  let __cwHomeExternalCenterOverview=null;
  let __cwHomeExternalCenterLoading=false;

  function __cwHomeEsc(value){
    try{return typeof esc==='function'?esc(value):String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}catch(_e){return String(value??'')}
  }
  function __cwHomeCompetitionLabel(key){const map={serie_a:'Серия А',coppa_italia:'Кубок Италии',ucl:'Лига Чемпионов',uel:'Лига Европы',uecl:'Лига Конференций'};return map[String(key||'')]||'Матч'}
  function __cwHomeIsoDate(y,m,d){return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
  function __cwHomeSeasonRange(now=new Date()){try{if(typeof __cwMtSeasonRange==='function')return __cwMtSeasonRange(now)}catch(_e){}const d=now instanceof Date?now:new Date(now),y=d.getFullYear(),m=d.getMonth()+1,start=m>=7?y:y-1;return {from:__cwHomeIsoDate(start,7,1),to:__cwHomeIsoDate(start+1,6,30)}}
  function __cwHomeDateKey(value){const d=value instanceof Date?value:new Date(value);if(!Number.isFinite(d.getTime()))return '';return __cwHomeIsoDate(d.getFullYear(),d.getMonth()+1,d.getDate())}
  function __cwHomeExternalRows(){const rows=[];for(const [competition,list] of __cwHomeExternalByCompetition){for(const match of Array.isArray(list)?list:[])rows.push({...match,competition:String(match?.competition||competition),__cwHomeExternal:true})}return rows}
  function __cwHomeLocalClubId(team){try{if(typeof __cwMtLocalClubId==='function')return Number(__cwMtLocalClubId(team)||0);const id=String(team?.id??'');return Number(__CWMT_LOCAL_BY_BSD?.[id]||0)}catch(_e){return 0}}
  function __cwHomeExternalInvolvesClub(match,localId){return __cwHomeLocalClubId(match?.homeTeam)===Number(localId)||__cwHomeLocalClubId(match?.awayTeam)===Number(localId)}
  function __cwHomeExternalIsItalian(match){return !!(match?.homeTeam?.isItalian||match?.awayTeam?.isItalian)}
  function __cwHomeExternalTime(match){const n=Date.parse(match?.kickoffAt||'');return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
  function __cwHomeLegacyTime(match){const n=Date.parse(match?.kickoff_at||'');return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
  function __cwHomeStatus(match){if(match?.__legacy){try{if(typeof isLive==='function'&&isLive(match.raw||match))return 'live'}catch(_e){}return match?.raw?.is_finished?'finished':'scheduled'}return String(match?.status||'scheduled')}

  async function __cwHomeLoadExternal(){
    if(__cwHomeExternalLoading)return false;
    const now=Date.now();
    if(__cwHomeExternalByCompetition.size&&now-__cwHomeExternalLoadedAt<15000)return true;
    __cwHomeExternalLoading=true;
    const range=__cwHomeSeasonRange(new Date());
    const results=await Promise.allSettled(__CW_HOME_EXT_COMPETITIONS.map(async key=>{
      const url=new URL('/api/cw22/matches',location.origin);
      url.searchParams.set('competition',key);url.searchParams.set('from',range.from);url.searchParams.set('to',range.to);
      const response=await fetch(url,{headers:{accept:'application/json','x-telegram-init-data':String(initData||'')},cache:'no-store'});
      if(!response?.ok)throw new Error('HTTP '+Number(response?.status||0));
      const body=await response.json();
      return {key,matches:Array.isArray(body?.data?.matches)?body.data.matches:[]};
    }));
    for(const result of results)if(result.status==='fulfilled')__cwHomeExternalByCompetition.set(result.value.key,result.value.matches);
    __cwHomeExternalLoading=false;
    __cwHomeExternalLoadedAt=Date.now();
    if(tab==='predict'&&!__cwHomeExternalCenter)try{render()}catch(_e){}
    return __cwHomeExternalByCompetition.size>0;
  }
  function __cwHomeEnsureExternal(){if(!__cwHomeExternalLoading&&(!__cwHomeExternalByCompetition.size||Date.now()-__cwHomeExternalLoadedAt>=15000)){Promise.resolve().then(()=>__cwHomeLoadExternal()).catch(()=>{})}}

  function __cwHomeLegacyFavoriteCandidate(){
    try{
      const t=S?.user?.favorite_team;if(!t)return null;
      const d=__cw18ClubQuick?.get?.(Number(t.id));
      const m=typeof __cw211FavoriteMatch==='function'?__cw211FavoriteMatch(t,d):null;
      if(!m)return null;
      return {competition:'serie_a',matchId:String(Number(m.id||m.match_id)||0),kickoffAt:m.kickoff_at,status:(typeof isLive==='function'&&isLive(m))?'live':(m.is_finished?'finished':'scheduled'),homeTeam:m.home,awayTeam:m.away,raw:m,__legacy:true};
    }catch(_e){return null}
  }
  function __cwHomeNearestFavorite(){
    const t=S?.user?.favorite_team;if(!t)return null;
    const now=Date.now(),rows=[];
    const legacy=__cwHomeLegacyFavoriteCandidate();if(legacy)rows.push(legacy);
    rows.push(...__cwHomeExternalRows().filter(match=>__cwHomeExternalInvolvesClub(match,t.id)));
    const eligible=rows.filter(match=>{const status=__cwHomeStatus(match);const time=match?.__legacy?__cwHomeLegacyTime(match.raw):__cwHomeExternalTime(match);return status==='live'||status==='halftime'||status==='extra_time'||status==='penalties'||time>=now});
    eligible.sort((a,b)=>{const al=['live','halftime','extra_time','penalties'].includes(__cwHomeStatus(a)),bl=['live','halftime','extra_time','penalties'].includes(__cwHomeStatus(b));if(al!==bl)return al?-1:1;const at=a?.__legacy?__cwHomeLegacyTime(a.raw):__cwHomeExternalTime(a),bt=b?.__legacy?__cwHomeLegacyTime(b.raw):__cwHomeExternalTime(b);return at-bt||String(a?.matchId||'').localeCompare(String(b?.matchId||''))});
    return eligible[0]||legacy||null;
  }
  function __cwHomeOpponent(match){const t=S?.user?.favorite_team;if(!match||!t)return null;if(match.__legacy){const h=match.homeTeam,a=match.awayTeam;return Number(h?.id)===Number(t.id)?a:h}const h=match.homeTeam,a=match.awayTeam;return __cwHomeLocalClubId(h)===Number(t.id)?a:h}
  function __cwHomeOpponentCrest(match){const opponent=__cwHomeOpponent(match);if(!opponent)return '<span class="cw-home-opponent-logo cw-home-opponent-logo--empty"></span>';if(match?.__legacy){try{const html=typeof __cw18Logo==='function'?__cw18Logo(opponent,'cw-home-opponent-logo'):'';if(html)return html}catch(_e){}}const url=String(opponent?.crestUrl||opponent?.crest_url||'').trim();return url?'<img class="cw-home-opponent-logo" loading="lazy" decoding="async" src="'+__cwHomeEsc(url)+'" alt="">':'<span class="cw-home-opponent-logo cw-home-opponent-logo--empty"></span>'}
  function __cwHomeMatchLabel(match){if(!match)return 'Матч не найден';if(match.__legacy){const raw=match.raw;try{if(typeof isLive==='function'&&isLive(raw))return typeof __cw2014LiveLabel==='function'?__cw2014LiveLabel(raw):'LIVE';if(raw?.is_finished)return 'ИТОГ · '+(typeof liveScore==='function'?liveScore(raw):'');if(typeof fmt==='function')return fmt(raw.kickoff_at)}catch(_e){}return ''}const status=String(match.status||'scheduled');if(status==='live')return 'LIVE'+(Number.isFinite(Number(match.minute))?' · '+Number(match.minute)+'′':'');if(status==='finished')return 'ИТОГ · '+String(match.homeScore??'—')+':'+String(match.awayScore??'—');try{return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(match.kickoffAt))}catch(_e){return ''}}
  function __cwHomeMatchScore(match){const status=__cwHomeStatus(match);if(match?.__legacy){try{return ['live','finished'].includes(status)&&typeof liveScore==='function'?liveScore(match.raw):'→'}catch(_e){return '→'}}if(['live','halftime','extra_time','penalties','finished'].includes(status)&&match?.homeScore!=null&&match?.awayScore!=null)return String(match.homeScore)+':'+String(match.awayScore);return '→'}
  function __cwHomeTeamCrest(team,legacy=false){if(legacy){try{const html=typeof __cw18Logo==='function'?__cw18Logo(team,'cw-home-today-crest'):'';if(html)return html}catch(_e){}}const url=String(team?.crestUrl||team?.crest_url||'').trim();return url?'<img class="cw-home-today-crest" loading="lazy" decoding="async" src="'+__cwHomeEsc(url)+'" alt="">':'<span class="cw-home-today-crest cw-home-today-crest--empty"></span>'}
  function __cwHomeTodayStatus(match){if(match?.__legacy)return __cwHomeMatchLabel(match);const status=String(match?.status||'scheduled');if(status==='live')return 'LIVE'+(Number.isFinite(Number(match?.minute))?' · '+Number(match.minute)+'′':'');if(status==='finished')return 'ИТОГ · '+String(match?.homeScore??'—')+':'+String(match?.awayScore??'—');if(status==='postponed')return 'ПЕРЕНЕСЁН';if(status==='cancelled')return 'ОТМЕНЁН';try{return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(new Date(match?.kickoffAt))}catch(_e){return 'Время уточняется'}}

  function __cwHomeCalcioTodayMatches(){
    const today=__cwHomeDateKey(new Date()),rows=[];
    try{const legacy=typeof __cw211TodayMatches==='function'?__cw211TodayMatches():[];for(const m of Array.isArray(legacy)?legacy:[])rows.push({competition:'serie_a',matchId:String(Number(m.id||m.match_id)||0),kickoffAt:m.kickoff_at,status:(typeof isLive==='function'&&isLive(m))?'live':(m.is_finished?'finished':'scheduled'),homeTeam:m.home,awayTeam:m.away,raw:m,__legacy:true})}catch(_e){}
    for(const match of __cwHomeExternalRows())if(__cwHomeDateKey(match?.kickoffAt)===today&&__cwHomeExternalIsItalian(match))rows.push(match);
    rows.sort((a,b)=>{const at=a?.__legacy?__cwHomeLegacyTime(a.raw):__cwHomeExternalTime(a),bt=b?.__legacy?__cwHomeLegacyTime(b.raw):__cwHomeExternalTime(b);return at-bt||String(a?.matchId||'').localeCompare(String(b?.matchId||''))});
    return rows;
  }
  function __cwHomeTodayCard(match){
    const legacy=!!match?.__legacy,home=match?.homeTeam||{},away=match?.awayTeam||{},status=__cwHomeStatus(match),live=['live','halftime','extra_time','penalties'].includes(status),attrs=legacy?' data-cw211-match="'+__cwHomeEsc(match.matchId)+'"':' data-cw-home-match="'+__cwHomeEsc(match.matchId)+'" data-cw-home-competition="'+__cwHomeEsc(match.competition)+'"';
    return '<button type="button" class="cw211-today-match cw-home-today-card '+(live?'live':'')+'"'+attrs+'><span class="cw-home-today-team">'+__cwHomeTeamCrest(home,legacy)+'<b>'+__cwHomeEsc(home?.name||'—')+'</b></span><span class="cw-home-today-center"><small>'+__cwHomeEsc(__cwHomeCompetitionLabel(match.competition))+'</small><strong>'+__cwHomeEsc(__cwHomeTodayStatus(match))+'</strong></span><span class="cw-home-today-team cw-home-today-team--away">'+__cwHomeTeamCrest(away,legacy)+'<b>'+__cwHomeEsc(away?.name||'—')+'</b></span></button>';
  }

  function __cwHomePolishToday(){
    const section=root.querySelector?.('.cw211-today');if(!section)return;
    const games=__cwHomeCalcioTodayMatches();section.classList.add('cw-home-calcio');
    section.innerHTML='<div class="cw211-today-head cw-home-today-head"><div><small>Матчи итальянских клубов</small><b>Кальчо сегодня</b></div><span>'+(games.length?String(games.length)+' '+(games.length===1?'матч':games.length<5?'матча':'матчей'):'матчей нет')+'</span></div>'+(games.length?'<div class="cw211-today-list cw-home-today-list">'+games.slice(0,10).map(__cwHomeTodayCard).join('')+'</div>':'<div class="cw-home-today-empty">Сегодня матчей итальянских клубов нет</div>');
  }

  function __cwHomePolishFavorite(){
    const shell=root.querySelector?.('.cw211-home-shell');if(!shell)return;
    const profile=shell.querySelector?.('.cw211-profile-btn');if(profile){profile.classList.add('cw-home-profile-premium');profile.textContent='Профиль клуба'}
    const cards=shell.querySelectorAll?.('.cw211-favorite-body .cw211-info-card')||[];const host=cards[1];if(!host)return;
    const match=__cwHomeNearestFavorite();if(!match)return;
    const opponent=__cwHomeOpponent(match),external=!match.__legacy;
    host.classList.add('cw-home-favorite-match');host.setAttribute('data-cw-home-match',String(match.matchId||''));host.setAttribute('data-cw-home-competition',String(match.competition||'serie_a'));host.setAttribute('tabindex','0');host.setAttribute('role','button');
    if(match.__legacy)host.setAttribute('data-cw211-match',String(match.matchId||''));else host.removeAttribute('data-cw211-match');
    host.innerHTML='<small>'+(['live','halftime','extra_time','penalties'].includes(__cwHomeStatus(match))?'Матч идёт':'Ближайший матч')+'</small><div class="cw-home-favorite-matchline">'+__cwHomeOpponentCrest(match)+'<div class="cw-home-favorite-opponent"><b>'+__cwHomeEsc(opponent?.name||'Соперник')+'</b><span>'+__cwHomeEsc(__cwHomeCompetitionLabel(match.competition))+' · '+__cwHomeEsc(__cwHomeMatchLabel(match))+'</span></div><strong class="cw-home-favorite-score">'+__cwHomeEsc(__cwHomeMatchScore(match))+'</strong></div><span class="cw-home-favorite-hint">Открыть матч-центр <i>→</i></span>';
    if(external)host.classList.add('cw-home-favorite-match--external');else host.classList.remove('cw-home-favorite-match--external');
  }

  function __cwHomePolishOrder(){
    const favorite=root.querySelector?.('.cw211-home-shell');if(!favorite?.parentElement)return false;const parent=favorite.parentElement;
    const nodes=[...(root.querySelectorAll?.('b,strong,span,div')||[])];
    const rank=nodes.find(node=>/^#\\d+$/.test(String(node.textContent||'').trim())&&/место/i.test(String(node.parentElement?.textContent||'')));if(!rank)return false;
    let card=rank;while(card?.parentElement&&card.parentElement!==parent)card=card.parentElement;if(!card||card===favorite||card.parentElement!==parent)return false;
    card.classList?.add('cw-home-user-card');if(card.nextElementSibling!==favorite)parent.insertBefore(card,favorite);return true;
  }

  function __cwHomePolishPredictionStages(){
    try{root.querySelectorAll?.('.round-chip.locked,.round-chip.cwpred-stage-locked,[data-cwpred-stage][aria-disabled="true"]').forEach(btn=>{btn.innerHTML=String(btn.innerHTML||'').replace(/[\\u{1F512}\\u{1F510}]/gu,'');btn.querySelectorAll?.('.lock,.round-lock,.cw-lock').forEach(node=>node.remove());btn.disabled=true;btn.setAttribute('aria-disabled','true');btn.setAttribute('tabindex','-1')})}catch(_e){}
  }

  function __cwHomePolishDom(){
    __cwHomePolishPredictionStages();
    if(tab!=='predict'||__cwHomeExternalCenter)return;
    __cwHomeEnsureExternal();__cwHomePolishToday();__cwHomePolishFavorite();__cwHomePolishOrder();
  }

  function __cwHomeExternalCenterHtml(){
    const state=__cwHomeExternalCenter;if(!state)return '';
    const home=state.homeTeam||{},away=state.awayTeam||{},status=__cwHomeStatus(state),score=['live','halftime','extra_time','penalties','finished'].includes(status)&&state.homeScore!=null&&state.awayScore!=null?String(state.homeScore)+' : '+String(state.awayScore):__cwHomeTodayStatus(state),overview=__cwHomeExternalCenterOverview;
    const note=overview?String(overview?.note||overview?.summary||overview?.status_text||overview?.match?.status_text||''):'';
    return '<section class="cw-home-match-center"><header class="cw-home-mc-head"><button type="button" data-cw-home-back aria-label="Назад">←</button><div><small>'+__cwHomeEsc(__cwHomeCompetitionLabel(state.competition))+'</small><h2>Матч-центр</h2></div></header><div class="cw-home-mc-score"><div>'+__cwHomeTeamCrest(home,false)+'<b>'+__cwHomeEsc(home.name||'—')+'</b></div><strong>'+__cwHomeEsc(score)+'</strong><div>'+__cwHomeTeamCrest(away,false)+'<b>'+__cwHomeEsc(away.name||'—')+'</b></div></div><div class="cw-home-mc-tabs"><span class="active">Обзор</span><span>Статистика</span><span>События</span><span>Составы</span></div><div class="cw-home-mc-overview">'+(__cwHomeExternalCenterLoading?'<span>Загружаем данные матча…</span>':note?'<p>'+__cwHomeEsc(note)+'</p>':'<p>Матч выбран. Подробности обновляются из общего матч-центра.</p>')+'</div></section>';
  }
  async function __cwHomeLoadExternalCenterOverview(){
    const state=__cwHomeExternalCenter;if(!state||state.__legacy)return false;__cwHomeExternalCenterLoading=true;__cwHomeExternalCenterOverview=null;try{render()}catch(_e){}
    try{const response=await fetch(__CW_HOME_CORE_API,{method:'POST',headers:{accept:'application/json','content-type':'application/json','x-telegram-init-data':String(initData||'')},body:JSON.stringify({action:'modular_match_center',competition:String(state.competition||''),match_id:String(state.matchId||''),section:'overview'})});const body=await response.json().catch(()=>({}));if(!response.ok||body?.ok===false)throw new Error('match_center_failed');if(__cwHomeExternalCenter&&String(__cwHomeExternalCenter.matchId)===String(state.matchId))__cwHomeExternalCenterOverview=body?.data??body}catch(_e){}finally{__cwHomeExternalCenterLoading=false;if(__cwHomeExternalCenter)try{render()}catch(_e){}}return true;
  }
  function __cwHomeOpenExternalCenter(matchId,competition){const match=__cwHomeExternalRows().find(row=>String(row?.matchId||'')===String(matchId||'')&&String(row?.competition||'')===String(competition||''));if(!match)return false;__cwHomeExternalCenter=match;__cwHomeExternalCenterOverview=null;__cwHomeExternalCenterLoading=false;render();Promise.resolve().then(()=>__cwHomeLoadExternalCenterOverview()).catch(()=>{});return true}

  const __cwHomePolishPredictBase=predict;
  predict=function(){return __cwHomeExternalCenter?__cwHomeExternalCenterHtml():__cwHomePolishPredictBase()};

  function __cwHomeBindPolish(){
    root.querySelectorAll?.('[data-cw-home-match][data-cw-home-competition]').forEach(el=>{if(String(el.getAttribute('data-cw-home-competition')||'')==='serie_a')return;const open=ev=>{ev?.preventDefault?.();ev?.stopPropagation?.();__cwHomeOpenExternalCenter(el.getAttribute('data-cw-home-match'),el.getAttribute('data-cw-home-competition'))};el.addEventListener('click',open);if(el.getAttribute('role')==='button')el.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();open(ev)}})});
    root.querySelector?.('[data-cw-home-back]')?.addEventListener('click',()=>{__cwHomeExternalCenter=null;__cwHomeExternalCenterOverview=null;__cwHomeExternalCenterLoading=false;render()});
  }

  const __cwHomePolishBindBase=bind;
  bind=function(){__cwHomePolishDom();__cwHomePolishBindBase();__cwHomeBindPolish()};

  __cwPredMineStagePredictionBlock=function(hasPrediction,prediction){return '<div class="cwpred-mine-primary"><small>ВАШ ПРОГНОЗ</small><b>'+__cwPredEsc(hasPrediction?prediction:'— : —')+'</b>'+(hasPrediction?'':'<span class="cwpred-mine-missing">Прогноз не сделан</span>')+'</div>'};
  __cwPredStageBarHtml=function(){const groups=__cwPredExternalGroups();if(!groups.length)return '';return '<div class="rounds cwpred-rounds">'+groups.map(g=>{const locked=__cwPredUxGroupLocked(g);return '<button type="button" class="round-chip '+(g.key===__cwPredStageKey?'active ':'')+(locked?'cwpred-stage-locked':'')+'" data-cwpred-stage="'+__cwPredEsc(g.key)+'" '+(locked?'disabled aria-disabled="true" tabindex="-1"':'aria-disabled="false"')+'>'+__cwPredEsc(__cwPredStageShort(g))+'</button>'}).join('')+'</div>'};

  try{const styleId='cw-home-calcio-polish-style';if(!document.getElementById(styleId)){const style=document.createElement('style');style.id=styleId;style.textContent='\
#ciao-miniapp-root .cwpred-stage-locked::before,#ciao-miniapp-root .cwpred-stage-locked::after,#ciao-miniapp-root .round-chip.locked::before,#ciao-miniapp-root .round-chip.locked::after{display:none!important;content:none!important}\
#ciao-miniapp-root .round-chip.locked,#ciao-miniapp-root .cwpred-stage-locked{opacity:.40!important;cursor:default!important;pointer-events:none!important}\
#ciao-miniapp-root .cwpred-mine-card .cwpred-mine-primary b{white-space:nowrap!important;font-size:18px!important;line-height:1!important}\
#ciao-miniapp-root .cwpred-mine-card .cwpred-mine-missing{display:block!important;margin-top:5px!important;font-size:7px!important;line-height:1.15!important;color:rgba(255,255,255,.42)!important;font-weight:750!important;white-space:nowrap!important}\
#ciao-miniapp-root .cw-home-user-card{margin-top:0!important;margin-bottom:12px!important}\
#ciao-miniapp-root .cw211-profile-btn.cw-home-profile-premium{min-height:38px!important;padding:0 14px!important;border:1px solid rgba(255,255,255,.16)!important;border-radius:13px!important;background:linear-gradient(135deg,var(--club-accent-soft,rgba(49,80,255,.62)),rgba(49,80,255,.72))!important;color:#fff!important;font-weight:900!important;box-shadow:0 9px 22px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.14)!important}\
#ciao-miniapp-root .cw-home-favorite-match{position:relative!important;cursor:pointer!important;border-color:rgba(132,153,255,.14)!important;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.022))!important;transition:transform .15s ease,border-color .15s ease!important}\
#ciao-miniapp-root .cw-home-favorite-match:active{transform:scale(.985)}\
#ciao-miniapp-root .cw-home-favorite-matchline{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:9px;align-items:center;margin-top:7px}\
#ciao-miniapp-root .cw-home-opponent-logo{width:34px!important;height:34px!important;object-fit:contain!important}\
#ciao-miniapp-root .cw-home-opponent-logo--empty{border-radius:50%;background:rgba(255,255,255,.05)}\
#ciao-miniapp-root .cw-home-favorite-opponent{min-width:0}.cw-home-favorite-opponent b{display:block!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:10px}.cw-home-favorite-opponent span{display:block;margin-top:3px;color:#8294bf;font-size:7.3px;white-space:normal;line-height:1.25}\
#ciao-miniapp-root .cw-home-favorite-score{font-family:\'Unbounded\',\'Manrope\',sans-serif;font-size:12px;color:#fff}.cw-home-favorite-hint{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,.055);color:#91a3cf;font-size:7px}.cw-home-favorite-hint i{font-style:normal;color:#fff;font-size:12px}\
#ciao-miniapp-root .cw211-today.cw-home-calcio{position:relative;overflow:hidden;margin-top:12px!important;padding:14px!important;border:1px solid rgba(93,119,255,.18)!important;border-radius:21px!important;background:radial-gradient(circle at 95% -12%,rgba(64,92,255,.22),transparent 38%),linear-gradient(180deg,rgba(11,23,55,.97),rgba(5,12,31,.99))!important;box-shadow:0 18px 42px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.035)!important}\
#ciao-miniapp-root .cw-home-today-head>div small{display:block;margin-bottom:3px;color:#7f91bd;font-size:6.8px;text-transform:uppercase;letter-spacing:.08em}.cw-home-today-head>div b{font-size:13px!important}.cw-home-today-head>span{padding:5px 8px;border-radius:999px;background:rgba(49,80,255,.13);border:1px solid rgba(94,120,255,.14);color:#9eb0df!important;font-size:7px!important}\
#ciao-miniapp-root .cw-home-today-list{display:grid!important;gap:8px!important;margin-top:11px!important}\
#ciao-miniapp-root .cw-home-today-card{min-height:66px!important;padding:9px 10px!important;border:1px solid rgba(132,153,255,.10)!important;border-radius:15px!important;background:linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.018))!important;display:grid!important;grid-template-columns:minmax(0,1fr) 70px minmax(0,1fr)!important;align-items:center!important;gap:7px!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important}\
#ciao-miniapp-root .cw-home-today-card:active{transform:scale(.99)}\
#ciao-miniapp-root .cw-home-today-team{display:flex;align-items:center;gap:7px;min-width:0;text-align:left}.cw-home-today-team--away{flex-direction:row-reverse;text-align:right}.cw-home-today-team b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px!important}.cw-home-today-crest{width:27px!important;height:27px!important;flex:0 0 27px!important;object-fit:contain!important}.cw-home-today-crest--empty{border-radius:50%;background:rgba(255,255,255,.05)}\
#ciao-miniapp-root .cw-home-today-center{text-align:center;min-width:0}.cw-home-today-center small{display:block;color:#7185b5;font-size:5.8px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw-home-today-center strong{display:block;margin-top:4px;color:#fff;font-size:7.4px;white-space:nowrap}.cw-home-today-card.live .cw-home-today-center strong{color:#ff7189}.cw-home-today-empty{margin-top:10px;padding:14px;border-radius:14px;background:rgba(255,255,255,.025);color:#7285b2;font-size:8px;text-align:center}\
#ciao-miniapp-root .cw-home-match-center{padding:2px 0 20px}.cw-home-mc-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}.cw-home-mc-head button{width:40px;height:40px;border:1px solid rgba(255,255,255,.10);border-radius:13px;background:rgba(255,255,255,.05);color:#fff;font-size:19px}.cw-home-mc-head small{display:block;color:#8799c4;font-size:7px;text-transform:uppercase;letter-spacing:.08em}.cw-home-mc-head h2{margin:2px 0 0;color:#fff;font-size:18px}.cw-home-mc-score{display:grid;grid-template-columns:1fr 80px 1fr;align-items:center;gap:8px;padding:18px 12px;border:1px solid rgba(132,153,255,.14);border-radius:20px;background:radial-gradient(circle at 50% -20%,rgba(49,80,255,.18),transparent 48%),rgba(8,17,42,.96)}.cw-home-mc-score>div{text-align:center;min-width:0}.cw-home-mc-score img,.cw-home-mc-score .cw-home-today-crest{width:44px!important;height:44px!important;margin:0 auto 7px}.cw-home-mc-score b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:10px}.cw-home-mc-score>strong{text-align:center;color:#fff;font-family:\'Unbounded\',\'Manrope\',sans-serif;font-size:18px}.cw-home-mc-tabs{display:flex;gap:6px;overflow:hidden;margin-top:10px}.cw-home-mc-tabs span{flex:1;padding:9px 3px;border-radius:10px;background:rgba(255,255,255,.025);color:#6579aa;font-size:7px;text-align:center}.cw-home-mc-tabs span.active{background:rgba(49,80,255,.16);color:#fff}.cw-home-mc-overview{margin-top:9px;min-height:80px;padding:14px;border:1px solid rgba(132,153,255,.08);border-radius:16px;background:rgba(255,255,255,.025);color:#899bc5;font-size:9px;line-height:1.45}.cw-home-mc-overview p{margin:0}\
@media(max-width:370px){#ciao-miniapp-root .cw-home-today-card{grid-template-columns:minmax(0,1fr) 62px minmax(0,1fr)!important;padding:8px!important}.cw-home-today-crest{width:24px!important;height:24px!important;flex-basis:24px!important}.cw-home-today-team{gap:5px}.cw-home-today-team b{font-size:7.4px!important}}\
';document.head.appendChild(style)}}catch(_e){}
  /* /${HOME_CALCIO_POLISH_MARKER} */
`;
}

export function injectHomeCalcioPolishPatch(input){
  const html=String(input||'');
  if(html.includes(HOME_CALCIO_POLISH_MARKER))return html;
  if(!html.includes(MINE_STAGE_MARKER))throw new Error('production mine/stage polish missing before home/calcio polish');
  const index=html.lastIndexOf(FINAL_IIFE_MARKER);
  if(index<0)throw new Error('production v22.5 final IIFE marker missing');
  return `${html.slice(0,index)}${homeCalcioPolishRuntimeSource()}${html.slice(index)}`;
}

export function validateHomeCalcioPolishPatchedHtml(input){
  const html=String(input||'');
  const count=html.split(HOME_CALCIO_POLISH_MARKER).length-1;
  if(count!==2)throw new Error(`production home/calcio polish marker count invalid: ${count}`);
  const mineAt=html.indexOf(MINE_STAGE_MARKER),polishAt=html.indexOf(HOME_CALCIO_POLISH_MARKER);
  if(mineAt<0||polishAt<0||mineAt>=polishAt)throw new Error('production home/calcio polish order invalid');
  for(const required of ['Кальчо сегодня','cw-home-profile-premium','__cwHomeNearestFavorite','__cwHomeCalcioTodayMatches','disabled aria-disabled="true" tabindex="-1"'])if(!html.includes(required))throw new Error(`production home/calcio polish contract missing: ${required}`);
  return true;
}
