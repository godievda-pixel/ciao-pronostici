from pathlib import Path
import re

SOURCE = Path(__file__).resolve().parents[1] / 'src' / 'v23' / 'index.html'
html = SOURCE.read_text(encoding='utf-8')

if 'ciao-v23-native-home-20260908' in html:
    raise SystemExit('v23 native migration already applied')


def remove_marked_block(text: str, marker: str) -> str:
    pattern = re.compile(
        r'\n?\s*/\*\s*' + re.escape(marker) + r'\s*\*/[\s\S]*?/\*\s*/' + re.escape(marker) + r'\s*\*/\s*\n?',
        re.M,
    )
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise SystemExit(f'expected exactly one {marker} block, found {len(matches)}')
    return pattern.sub('\n', text, count=1)


for obsolete in [
    'ciao-prod-prediction-stage-lock-ui-20260907',
    'ciao-prod-prediction-mine-stage-polish-20260907',
    'ciao-prod-home-calcio-polish-20260908',
    'ciao-prod-home-calcio-safety-20260908',
]:
    html = remove_marked_block(html, obsolete)

needle = """  __cwHomePredFixNav();
  __cwPredApplyTheme();
  if(tab==='predict'||tab==='mine')render();
  /* /ciao-prod-home-predictions-nav-fix-20260907 */"""
if html.count(needle) != 1:
    raise SystemExit(f'expected one Home/Predictions final render needle, found {html.count(needle)}')

native = r'''
  /* ciao-v23-native-home-20260908 */
  const __CW23_EXT_COMPETITIONS=['coppa_italia','ucl','uel','uecl'];
  const __CW23_CORE_API='https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-core-api-fast-v6';
  let __cw23ExternalByCompetition=new Map();
  let __cw23ExternalLoading=false;
  let __cw23ExternalLoadedAt=0;
  let __cw23ExternalCenter=null;
  let __cw23ExternalCenterOverview=null;
  let __cw23ExternalCenterLoading=false;

  function __cw23Esc(value){try{return typeof esc==='function'?esc(value):String(value??'')}catch(_e){return String(value??'')}}
  function __cw23CompetitionLabel(key){const map={serie_a:'Серия А',coppa_italia:'Кубок Италии',ucl:'Лига Чемпионов',uel:'Лига Европы',uecl:'Лига Конференций'};return map[String(key||'')]||'Матч'}
  function __cw23IsoDate(y,m,d){return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
  function __cw23DateKey(value){const d=value instanceof Date?value:new Date(value);if(!Number.isFinite(d.getTime()))return '';return __cw23IsoDate(d.getFullYear(),d.getMonth()+1,d.getDate())}
  function __cw23SeasonRange(now=new Date()){try{if(typeof __cwMtSeasonRange==='function')return __cwMtSeasonRange(now)}catch(_e){}const d=now instanceof Date?now:new Date(now),y=d.getFullYear(),m=d.getMonth()+1,start=m>=7?y:y-1;return {from:__cw23IsoDate(start,7,1),to:__cw23IsoDate(start+1,6,30)}}
  function __cw23ExternalRows(){const rows=[];for(const [competition,list] of __cw23ExternalByCompetition){for(const match of Array.isArray(list)?list:[])rows.push({...match,competition:String(match?.competition||competition),__cw23External:true})}return rows}
  function __cw23LocalClubId(team){try{if(typeof __cwMtLocalClubId==='function')return Number(__cwMtLocalClubId(team)||0);const id=String(team?.id??'');return Number(__CWMT_LOCAL_BY_BSD?.[id]||0)}catch(_e){return 0}}
  function __cw23ExternalInvolvesClub(match,localId){return __cw23LocalClubId(match?.homeTeam)===Number(localId)||__cw23LocalClubId(match?.awayTeam)===Number(localId)}
  function __cw23ExternalIsItalian(match){return !!(match?.homeTeam?.isItalian||match?.awayTeam?.isItalian)}
  function __cw23ExternalTime(match){const n=Date.parse(match?.kickoffAt||'');return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
  function __cw23LegacyTime(match){const n=Date.parse(match?.kickoff_at||'');return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
  function __cw23Status(match){if(match?.__legacy){try{if(typeof isLive==='function'&&isLive(match.raw||match))return 'live'}catch(_e){}return match?.raw?.is_finished?'finished':'scheduled'}return String(match?.status||'scheduled')}

  async function __cw23LoadExternal(){
    if(__cw23ExternalLoading)return false;
    const now=Date.now();if(__cw23ExternalByCompetition.size&&now-__cw23ExternalLoadedAt<15000)return true;
    __cw23ExternalLoading=true;const range=__cw23SeasonRange(new Date());
    try{
      const results=await Promise.allSettled(__CW23_EXT_COMPETITIONS.map(async key=>{
        const url=new URL('/api/cw22/matches',location.origin);url.searchParams.set('competition',key);url.searchParams.set('from',range.from);url.searchParams.set('to',range.to);
        const response=await fetch(url,{headers:{accept:'application/json','x-telegram-init-data':String(initData||'')},cache:'no-store'});
        if(!response?.ok)throw new Error('HTTP '+Number(response?.status||0));const body=await response.json();return {key,matches:Array.isArray(body?.data?.matches)?body.data.matches:[]};
      }));
      for(const result of results)if(result.status==='fulfilled')__cw23ExternalByCompetition.set(result.value.key,result.value.matches);
      __cw23ExternalLoadedAt=Date.now();
    }finally{__cw23ExternalLoading=false}
    if(tab==='predict'&&!__cw23ExternalCenter)try{render()}catch(_e){}
    return __cw23ExternalByCompetition.size>0;
  }
  function __cw23EnsureExternal(){if(__cw23ExternalLoading)return;const age=Date.now()-Number(__cw23ExternalLoadedAt||0);if(__cw23ExternalLoadedAt&&age<15000)return;Promise.resolve().then(()=>__cw23LoadExternal()).catch(()=>{})}

  function __cw23LegacyFavoriteCandidate(){
    try{const t=S?.user?.favorite_team;if(!t)return null;const d=__cw18ClubQuick?.get?.(Number(t.id));const m=typeof __cw211FavoriteMatch==='function'?__cw211FavoriteMatch(t,d):null;if(!m)return null;return {competition:'serie_a',matchId:String(Number(m.id||m.match_id)||0),kickoffAt:m.kickoff_at,status:(typeof isLive==='function'&&isLive(m))?'live':(m.is_finished?'finished':'scheduled'),homeTeam:m.home,awayTeam:m.away,raw:m,__legacy:true}}catch(_e){return null}
  }
  function __cw23NearestFavoriteMatch(){
    const t=S?.user?.favorite_team;if(!t)return null;const now=Date.now(),rows=[];const legacy=__cw23LegacyFavoriteCandidate();if(legacy)rows.push(legacy);rows.push(...__cw23ExternalRows().filter(match=>__cw23ExternalInvolvesClub(match,t.id)));
    const eligible=rows.filter(match=>{const status=__cw23Status(match),time=match?.__legacy?__cw23LegacyTime(match.raw):__cw23ExternalTime(match);return ['live','halftime','extra_time','penalties'].includes(status)||time>=now});
    eligible.sort((a,b)=>{const al=['live','halftime','extra_time','penalties'].includes(__cw23Status(a)),bl=['live','halftime','extra_time','penalties'].includes(__cw23Status(b));if(al!==bl)return al?-1:1;const at=a?.__legacy?__cw23LegacyTime(a.raw):__cw23ExternalTime(a),bt=b?.__legacy?__cw23LegacyTime(b.raw):__cw23ExternalTime(b);return at-bt||String(a?.matchId||'').localeCompare(String(b?.matchId||''))});
    return eligible[0]||legacy||null;
  }
  function __cw23Opponent(match){const t=S?.user?.favorite_team;if(!match||!t)return null;const h=match.homeTeam,a=match.awayTeam;if(match.__legacy)return Number(h?.id)===Number(t.id)?a:h;return __cw23LocalClubId(h)===Number(t.id)?a:h}
  function __cw23OpponentCrest(match){const opponent=__cw23Opponent(match);if(!opponent)return '<span class="cw23-opponent-crest empty"></span>';if(match?.__legacy){try{const h=typeof __cw18Logo==='function'?__cw18Logo(opponent,'cw23-opponent-crest'):'';if(h)return h}catch(_e){}}const url=String(opponent?.crestUrl||opponent?.crest_url||'').trim();return url?'<img class="cw23-opponent-crest" loading="lazy" decoding="async" src="'+__cw23Esc(url)+'" alt="">':'<span class="cw23-opponent-crest empty"></span>'}
  function __cw23TeamCrest(team,legacy=false){if(legacy){try{const h=typeof __cw18Logo==='function'?__cw18Logo(team,'cw23-team-crest'):'';if(h)return h}catch(_e){}}const url=String(team?.crestUrl||team?.crest_url||'').trim();return url?'<img class="cw23-team-crest" loading="lazy" decoding="async" src="'+__cw23Esc(url)+'" alt="">':'<span class="cw23-team-crest empty"></span>'}
  function __cw23MatchLabel(match){if(!match)return 'Матч не найден';if(match.__legacy){const raw=match.raw;try{if(typeof isLive==='function'&&isLive(raw))return typeof __cw2014LiveLabel==='function'?__cw2014LiveLabel(raw):'LIVE';if(raw?.is_finished)return 'ИТОГ · '+(typeof liveScore==='function'?liveScore(raw):'');if(typeof fmt==='function')return fmt(raw.kickoff_at)}catch(_e){}return ''}const status=String(match.status||'scheduled');if(status==='live')return 'LIVE'+(Number.isFinite(Number(match.minute))?' · '+Number(match.minute)+'′':'');if(status==='halftime')return 'ПЕРЕРЫВ';if(status==='extra_time')return 'ДОП. ВРЕМЯ';if(status==='penalties')return 'ПЕНАЛЬТИ';if(status==='finished')return 'ИТОГ · '+String(match.homeScore??'—')+':'+String(match.awayScore??'—');try{return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(match.kickoffAt))}catch(_e){return ''}}
  function __cw23MatchScore(match){const status=__cw23Status(match);if(match?.__legacy){try{return ['live','finished'].includes(status)&&typeof liveScore==='function'?liveScore(match.raw):'→'}catch(_e){return '→'}}if(['live','halftime','extra_time','penalties','finished'].includes(status)&&match?.homeScore!=null&&match?.awayScore!=null)return String(match.homeScore)+':'+String(match.awayScore);return '→'}
  function __cw23TodayStatus(match){if(match?.__legacy)return __cw23MatchLabel(match);const status=String(match?.status||'scheduled');if(status==='live')return 'LIVE'+(Number.isFinite(Number(match?.minute))?' · '+Number(match.minute)+'′':'');if(status==='halftime')return 'ПЕРЕРЫВ';if(status==='extra_time')return 'ДОП. ВРЕМЯ';if(status==='penalties')return 'ПЕНАЛЬТИ';if(status==='finished')return 'ИТОГ · '+String(match?.homeScore??'—')+':'+String(match?.awayScore??'—');if(status==='postponed')return 'ПЕРЕНЕСЁН';if(status==='cancelled')return 'ОТМЕНЁН';try{return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(new Date(match?.kickoffAt))}catch(_e){return 'Время уточняется'}}

  function __cw23ProfileHtml(){const value=typeof hero==='function'?String(hero()):'';return value.replace('class="hero"','class="hero cw23-profile-card"')}
  function __cw23FavoriteHome(){
    const t=S?.user?.favorite_team;if(!t)return '';const id=Number(t.id),row=(S?.serie_a_table?.rows||[]).find(r=>Number(r.team_id)===id),seed=S?.favorite_club_profile,quick=__cw18ClubQuick?.get?.(id)||(Number(seed?.team?.id)===id?seed:null),overview=quick?.overview||{},streak=Number(S?.stats?.streak)||0,match=__cw23NearestFavoriteMatch(),opponent=__cw23Opponent(match),active=match&&['live','halftime','extra_time','penalties'].includes(__cw23Status(match)),accent=typeof __cw17AccentStyle==='function'?__cw17AccentStyle(t):'',clubLogo=typeof __cw18Logo==='function'?__cw18Logo(t,'cw23-favorite-logo'):'',form=typeof __cw211FormHtml==='function'?__cw211FormHtml(overview?.form||[]):'';
    const matchHtml=match?'<div class="cw211-info-card cw23-favorite-match" data-cw23-match="'+__cw23Esc(match.matchId)+'" data-cw23-competition="'+__cw23Esc(match.competition||'serie_a')+'" role="button" tabindex="0"><small>'+(active?'Матч идёт':'Ближайший матч')+'</small><div class="cw23-favorite-matchline">'+__cw23OpponentCrest(match)+'<div><b>'+__cw23Esc(opponent?.name||'Соперник')+'</b><span>'+__cw23Esc(__cw23CompetitionLabel(match.competition))+' · '+__cw23Esc(__cw23MatchLabel(match))+'</span></div><strong>'+__cw23Esc(__cw23MatchScore(match))+'</strong></div><div class="cw23-open-hint">Открыть матч-центр <i>→</i></div></div>':'<div class="cw211-info-card"><small>Ближайший матч</small><div class="cw23-match-empty">Матч пока не найден</div></div>';
    return '<section class="cw23-favorite-card cw2016-club-theme" style="'+__cw23Esc(accent)+'"><div class="cw211-favorite-panel"><div class="cw211-favorite-head"><div class="cw211-favorite-logo">'+clubLogo+'</div><div class="cw211-favorite-title"><small>Любимый клуб</small><b>'+__cw23Esc(t.name)+'</b><span>'+(row?.position?String(row.position)+'-е место · '+String(Number(row.points)||0)+' очков':'Серия А')+'</span></div><button type="button" class="cw211-profile-btn cw23-profile-club-premium" data-club-id="'+id+'">Профиль клуба</button></div><div class="cw211-favorite-body"><div class="cw211-info-card"><small>Форма</small>'+form+'<div class="cw211-streak">Серия прогнозов: <b>'+streak+'</b></div></div>'+matchHtml+'</div></div></section>';
  }
  function __cw23CalcioTodayMatches(){
    const today=__cw23DateKey(new Date()),rows=[];try{const legacy=typeof __cw211TodayMatches==='function'?__cw211TodayMatches():[];for(const m of Array.isArray(legacy)?legacy:[])rows.push({competition:'serie_a',matchId:String(Number(m.id||m.match_id)||0),kickoffAt:m.kickoff_at,status:(typeof isLive==='function'&&isLive(m))?'live':(m.is_finished?'finished':'scheduled'),homeTeam:m.home,awayTeam:m.away,raw:m,__legacy:true})}catch(_e){}
    for(const match of __cw23ExternalRows())if(__cw23DateKey(match?.kickoffAt)===today&&__cw23ExternalIsItalian(match))rows.push(match);rows.sort((a,b)=>{const at=a?.__legacy?__cw23LegacyTime(a.raw):__cw23ExternalTime(a),bt=b?.__legacy?__cw23LegacyTime(b.raw):__cw23ExternalTime(b);return at-bt||String(a?.matchId||'').localeCompare(String(b?.matchId||''))});return rows;
  }
  function __cw23TodayCard(match){const legacy=!!match?.__legacy,home=match?.homeTeam||{},away=match?.awayTeam||{},live=['live','halftime','extra_time','penalties'].includes(__cw23Status(match));return '<button type="button" class="cw211-today-match cw23-today-card '+(live?'live':'')+'" data-cw23-match="'+__cw23Esc(match.matchId)+'" data-cw23-competition="'+__cw23Esc(match.competition||'serie_a')+'"><span class="cw23-today-team">'+__cw23TeamCrest(home,legacy)+'<b>'+__cw23Esc(home?.name||'—')+'</b></span><span class="cw23-today-center"><small>'+__cw23Esc(__cw23CompetitionLabel(match.competition))+'</small><strong>'+__cw23Esc(__cw23TodayStatus(match))+'</strong></span><span class="cw23-today-team away">'+__cw23TeamCrest(away,legacy)+'<b>'+__cw23Esc(away?.name||'—')+'</b></span></button>'}
  function __cw23CalcioTodayHtml(){const games=__cw23CalcioTodayMatches();return '<section class="cw211-today cw23-calcio"><div class="cw211-today-head cw23-calcio-head"><div><small>Матчи итальянских клубов</small><b>Кальчо сегодня</b></div><span>'+(games.length?String(games.length)+' '+(games.length===1?'матч':games.length<5?'матча':'матчей'):'матчей нет')+'</span></div>'+(games.length?'<div class="cw211-today-list cw23-today-list">'+games.slice(0,10).map(__cw23TodayCard).join('')+'</div>':'<div class="cw23-today-empty">Сегодня матчей итальянских клубов нет</div>')+'</section>'}
  function __cw23LegacyHomeBody(){const box=document.createElement('div');box.innerHTML=String(typeof __cwPredLegacyPredict==='function'?__cwPredLegacyPredict():'');box.querySelectorAll('.hero,.cw18-favorite-home,.cw23-favorite-card,.cw211-today').forEach(node=>node.remove());return box.innerHTML}
  function __cw23HomeHtml(){if(__cw23ExternalCenter)return __cw23ExternalCenterHtml();__cw23EnsureExternal();return __cw23ProfileHtml()+__cw23FavoriteHome()+__cw23CalcioTodayHtml()+__cw23LegacyHomeBody()}

  function __cw23ExternalCenterHtml(){const state=__cw23ExternalCenter;if(!state)return '';const home=state.homeTeam||{},away=state.awayTeam||{},status=__cw23Status(state),score=['live','halftime','extra_time','penalties','finished'].includes(status)&&state.homeScore!=null&&state.awayScore!=null?String(state.homeScore)+' : '+String(state.awayScore):__cw23TodayStatus(state),overview=__cw23ExternalCenterOverview,note=overview?String(overview?.note||overview?.summary||overview?.status_text||overview?.match?.status_text||''):'';return '<section class="cw23-match-center"><header><button type="button" data-cw23-home-back aria-label="Назад">←</button><div><small>'+__cw23Esc(__cw23CompetitionLabel(state.competition))+'</small><h2>Матч-центр</h2></div></header><div class="cw23-match-center-score"><div>'+__cw23TeamCrest(home,false)+'<b>'+__cw23Esc(home.name||'—')+'</b></div><strong>'+__cw23Esc(score)+'</strong><div>'+__cw23TeamCrest(away,false)+'<b>'+__cw23Esc(away.name||'—')+'</b></div></div><div class="cw23-match-center-tabs"><span class="active">Обзор</span><span>Статистика</span><span>События</span><span>Составы</span></div><div class="cw23-match-center-overview">'+(__cw23ExternalCenterLoading?'<span>Загружаем данные матча…</span>':note?'<p>'+__cw23Esc(note)+'</p>':'<p>Матч выбран. Подробности обновляются из общего матч-центра.</p>')+'</div></section>'}
  async function __cw23LoadExternalCenterOverview(){const state=__cw23ExternalCenter;if(!state||state.__legacy)return false;__cw23ExternalCenterLoading=true;__cw23ExternalCenterOverview=null;try{render()}catch(_e){}try{const response=await fetch(__CW23_CORE_API,{method:'POST',headers:{accept:'application/json','content-type':'application/json','x-telegram-init-data':String(initData||'')},body:JSON.stringify({action:'modular_match_center',competition:String(state.competition||''),match_id:String(state.matchId||''),section:'overview'})}),body=await response.json().catch(()=>({}));if(!response.ok||body?.ok===false)throw new Error('match_center_failed');if(__cw23ExternalCenter&&String(__cw23ExternalCenter.matchId)===String(state.matchId))__cw23ExternalCenterOverview=body?.data??body}catch(_e){}finally{__cw23ExternalCenterLoading=false;if(__cw23ExternalCenter)try{render()}catch(_e){}}return true}
  function __cw23OpenExternalCenter(matchId,competition){const match=__cw23ExternalRows().find(row=>String(row?.matchId||'')===String(matchId||'')&&String(row?.competition||'')===String(competition||''));if(!match)return false;__cw23ExternalCenter=match;__cw23ExternalCenterOverview=null;__cw23ExternalCenterLoading=false;render();Promise.resolve().then(()=>__cw23LoadExternalCenterOverview()).catch(()=>{});return true}
  function __cw23BindHome(){
    for(const el of root.querySelectorAll?.('[data-cw23-match][data-cw23-competition]')||[]){el.onclick=ev=>{ev?.preventDefault?.();ev?.stopPropagation?.();const id=el.getAttribute('data-cw23-match'),competition=String(el.getAttribute('data-cw23-competition')||'serie_a');if(competition==='serie_a'){const n=Number(id);if(n&&typeof openMatchCenter==='function')openMatchCenter(n)}else __cw23OpenExternalCenter(id,competition)};el.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();el.click()}}}
    const back=root.querySelector?.('[data-cw23-home-back]');if(back)back.onclick=()=>{__cw23ExternalCenter=null;__cw23ExternalCenterOverview=null;__cw23ExternalCenterLoading=false;render()};
  }

  const __cw23FavoriteLoaderBase=__cw18LoadFavorite;
  __cw18LoadFavorite=async function(){const id=Number(S?.user?.favorite_team?.id),had=!!(id&&__cw18ClubQuick?.has?.(id)),result=await __cw23FavoriteLoaderBase(),has=!!(id&&__cw18ClubQuick?.has?.(id));if(!had&&has&&tab==='predict'&&!matchViewId&&!clubViewId)try{render()}catch(_e){}return result};
  __cw18FavoriteHome=__cw23FavoriteHome;
  predict=function(){return __cw23HomeHtml()};
  const __cw23BindBase=bind;
  bind=function(){const result=__cw23BindBase();if(tab==='predict')__cw23BindHome();return result};

  try{const styleId='cw23-native-home-style';if(!document.getElementById(styleId)){const style=document.createElement('style');style.id=styleId;style.textContent='#ciao-miniapp-root .cw23-profile-card{margin:0 0 12px!important}#ciao-miniapp-root .cw23-favorite-card{margin:0 0 12px}#ciao-miniapp-root .cw23-profile-club-premium{min-height:40px!important;padding:0 15px!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:13px!important;background:linear-gradient(135deg,var(--club-accent-soft,rgba(49,80,255,.55)),rgba(61,71,255,.78))!important;box-shadow:0 10px 26px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.16)!important;color:#fff!important;font-weight:900!important}#ciao-miniapp-root .cw23-favorite-match{cursor:pointer!important;border-color:rgba(132,153,255,.16)!important;background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.02))!important}#ciao-miniapp-root .cw23-favorite-matchline{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:9px;align-items:center;margin-top:7px}#ciao-miniapp-root .cw23-opponent-crest{width:34px!important;height:34px!important;object-fit:contain}.cw23-favorite-matchline b{display:block;color:#fff;font-size:10px}.cw23-favorite-matchline span{display:block;margin-top:3px;color:#8999bf;font-size:7.5px}.cw23-favorite-matchline strong{font-size:11px;color:#fff}.cw23-open-hint{margin-top:7px;color:#91a2c8;font-size:7px;font-weight:800}.cw23-open-hint i{font-style:normal;color:#fff}.cw23-match-empty{margin-top:8px;color:#8192bb;font-size:8px}#ciao-miniapp-root .cw23-calcio{margin:0 0 12px!important;padding:14px!important;border-color:rgba(110,132,255,.15)!important;background:linear-gradient(160deg,rgba(13,29,68,.96),rgba(5,14,36,.98))!important;box-shadow:0 14px 32px rgba(0,0,0,.18)}.cw23-calcio-head>div small{display:block;color:#7486b2;font-size:7px;text-transform:uppercase;letter-spacing:.07em}.cw23-calcio-head>div b{display:block;margin-top:2px;font-size:11px}.cw23-today-list{display:grid;gap:7px;margin-top:10px}.cw23-today-card{display:grid!important;grid-template-columns:minmax(0,1fr) 72px minmax(0,1fr)!important;align-items:center!important;gap:7px!important;padding:9px!important;border-radius:13px!important;background:rgba(255,255,255,.035)!important}.cw23-today-team{min-width:0;display:flex;align-items:center;gap:6px}.cw23-today-team.away{flex-direction:row-reverse;text-align:right}.cw23-team-crest{width:28px!important;height:28px!important;object-fit:contain;flex:0 0 28px}.cw23-today-team b{min-width:0;font-size:8px!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cw23-today-center{text-align:center}.cw23-today-center small{display:block;color:#7f91bd;font-size:6.5px;font-weight:800}.cw23-today-center strong{display:block;margin-top:3px;color:#fff;font-size:7.5px}.cw23-today-empty{margin-top:10px;color:#7c8db7;font-size:8px}.cw23-match-center header{display:flex;align-items:center;gap:10px}.cw23-match-center header button{width:38px;height:38px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.04);color:#fff}.cw23-match-center header small{color:#7f91bd;font-size:8px}.cw23-match-center header h2{margin:2px 0 0;color:#fff;font-size:18px}.cw23-match-center-score{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;margin-top:15px;padding:18px;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:rgba(255,255,255,.03)}.cw23-match-center-score>div{display:grid;justify-items:center;gap:7px;text-align:center}.cw23-match-center-score .cw23-team-crest{width:48px!important;height:48px!important}.cw23-match-center-score b{font-size:10px;color:#fff}.cw23-match-center-score>strong{font-size:18px;color:#fff}.cw23-match-center-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:10px}.cw23-match-center-tabs span{padding:8px 4px;border-radius:9px;text-align:center;color:#7487b3;font-size:7px}.cw23-match-center-tabs span.active{background:rgba(49,80,255,.16);color:#fff}.cw23-match-center-overview{margin-top:9px;min-height:80px;padding:14px;border:1px solid rgba(132,153,255,.08);border-radius:16px;background:rgba(255,255,255,.025);color:#899bc5;font-size:9px;line-height:1.45}.cw23-match-center-overview p{margin:0}';document.head.appendChild(style)}}catch(_e){}
  /* /ciao-v23-native-home-20260908 */

  /* ciao-v23-native-predictions-20260908 */
  function __cw23GroupLocked(group){return !!group&&Array.isArray(group.matches)&&group.matches.length>0&&group.matches.every(match=>match?.stage_locked===true)}
  __cwPredUxGroupLocked=__cw23GroupLocked;
  function __cw23SerieRoundBar(){return '<div class="rounds">'+(S?.rounds||[]).map(r=>{const locked=!r.unlocked,attrs=locked?'disabled aria-disabled="true" tabindex="-1"':'aria-disabled="false"';return '<button type="button" class="round-chip '+(r.number===S.selected_round?'active ':'')+(locked?'locked':'')+'" data-round="'+Number(r.number)+'" '+attrs+'>'+Number(r.number)+'</button>'}).join('')+'</div>'}
  function __cw23ExternalStageBarHtml(){const groups=__cwPredExternalGroups();if(!groups.length)return '';return '<div class="rounds cwpred-rounds">'+groups.map(g=>{const locked=__cw23GroupLocked(g),attrs=locked?'disabled aria-disabled="true" tabindex="-1"':'aria-disabled="false"';return '<button type="button" class="round-chip '+(g.key===__cwPredStageKey?'active ':'')+(locked?'cwpred-stage-locked':'')+'" data-cwpred-stage="'+__cwPredEsc(g.key)+'" '+attrs+'>'+__cwPredEsc(__cwPredStageShort(g))+'</button>'}).join('')+'</div>'}
  roundBar=__cw23SerieRoundBar;
  __cwPredStageBarHtml=__cw23ExternalStageBarHtml;

  function __cw23MinePredictionBlock(hasPrediction,prediction){return '<div class="cw23-mine-primary"><small>ВАШ ПРОГНОЗ</small><b>'+__cwPredEsc(hasPrediction?prediction:'— : —')+'</b>'+(hasPrediction?'':'<span class="cw23-mine-missing">Прогноз не сделан</span>')+'</div>'}
  function __cw23MineBody(homeHtml,awayHtml,hasPrediction,prediction,score,points){const result=score?'<div class="cw23-mine-result"><small>СЧЁТ МАТЧА</small><b>'+__cwPredEsc(score)+'</b></div>':'<span class="cw23-mine-await">Матч ещё не начался</span>';return '<div class="cw23-mine-matchline">'+homeHtml+__cw23MinePredictionBlock(hasPrediction,prediction)+awayHtml+'</div><div class="cw23-mine-result-strip">'+result+(points?'<div class="cwpred-points">'+__cwPredEsc(points)+'</div>':'')+'</div>'}
  function __cw23ExternalMineCard(match){const p=match?.prediction,has=!!p,prediction=has?String(p.home_score)+' : '+String(p.away_score):'— : —',score=__cwPredRealScore(match),points=__cwPredPoints(p?.points);return '<article class="cwpred-card cwpred-external-card cwpred-mine-card cw23-mine-card" data-cwpred-match="'+__cwPredEsc(String(match?.matchId||''))+'"><div class="cwpred-card-top"><span class="cwpred-status">'+__cwPredEsc(__cwPredStatus(match))+'</span><span class="cwpred-kickoff">'+__cwPredEsc(__cwPredDateTime(match?.kickoffAt))+'</span></div>'+__cw23MineBody(__cwPredExternalTeamHtml(match?.homeTeam,'home'),__cwPredExternalTeamHtml(match?.awayTeam,'away'),has,prediction,score,points)+'</article>'}
  function __cw23SerieMineCard(match){const p=match?.prediction,has=!!p,prediction=has?String(p.home_score)+' : '+String(p.away_score):'— : —',score=__cwPredSerieRealScore(match),points=__cwPredPoints(p?.points);return '<div class="mine-match cwpred-card cwpred-serie-card cwpred-mine-card cw23-mine-card" data-mid="'+Number(match.id)+'"><div class="cwpred-card-top"><span class="cwpred-status">'+__cwPredEsc(__cwPredSerieStatus(match))+'</span><span class="cwpred-kickoff">'+__cwPredEsc(typeof fmt==='function'?fmt(match.kickoff_at):'')+'</span></div>'+__cw23MineBody(__cwPredSerieTeamHtml(match.home,'home'),__cwPredSerieTeamHtml(match.away,'away'),has,prediction,score,points)+'</div>'}
  __cwPredExternalMineCard=__cw23ExternalMineCard;
  __cwPredSerieMineCard=__cw23SerieMineCard;

  try{const styleId='cw23-native-predictions-style';if(!document.getElementById(styleId)){const style=document.createElement('style');style.id=styleId;style.textContent='#ciao-miniapp-root .cwpred-stage-locked::before,#ciao-miniapp-root .cwpred-stage-locked::after,#ciao-miniapp-root .round-chip.locked::before,#ciao-miniapp-root .round-chip.locked::after{display:none!important;content:none!important}#ciao-miniapp-root .round-chip.locked,#ciao-miniapp-root .cwpred-stage-locked{opacity:.40!important;cursor:default!important;pointer-events:none!important}#ciao-miniapp-root .cw23-mine-card{overflow:hidden!important}.cw23-mine-matchline{display:grid;grid-template-columns:minmax(0,1fr) 94px minmax(0,1fr);align-items:center;gap:8px;min-width:0}.cw23-mine-primary{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;max-width:94px;padding:7px 4px;border-radius:13px;background:rgba(255,255,255,.035);overflow:hidden}.cw23-mine-primary small,.cw23-mine-result small{color:rgba(255,255,255,.43);font-size:7px;font-weight:850;letter-spacing:.04em}.cw23-mine-primary b{max-width:100%;color:#fff;font-size:18px;font-weight:950;line-height:1;white-space:nowrap}.cw23-mine-missing{display:block;max-width:100%;margin-top:5px;color:rgba(255,255,255,.42);font-size:7px;font-weight:750;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw23-mine-result-strip{display:flex;align-items:center;justify-content:center;gap:10px;min-height:32px;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.055)}.cw23-mine-result{display:flex;align-items:baseline;gap:7px}.cw23-mine-result b{font-size:14px;color:#fff}.cw23-mine-await{color:rgba(255,255,255,.42);font-size:9px;font-weight:750}@media(max-width:370px){.cw23-mine-matchline{grid-template-columns:minmax(0,1fr) 84px minmax(0,1fr);gap:5px}.cw23-mine-primary{max-width:84px}.cw23-mine-primary b{font-size:16px}}';document.head.appendChild(style)}}catch(_e){}
  /* /ciao-v23-native-predictions-20260908 */
'''

replacement = """  __cwHomePredFixNav();
  __cwPredApplyTheme();
""" + native + """
  try{if(tab==='predict'||tab==='mine')render()}catch(_e){}
  /* /ciao-prod-home-predictions-nav-fix-20260907 */"""

html = html.replace(needle, replacement, 1)
SOURCE.write_text(html, encoding='utf-8')
print(f'v23 native migration complete: bytes={len(html.encode("utf-8"))}')
