export const HOME_PREDICTIONS_NAV_FIX_MARKER='ciao-prod-home-predictions-nav-fix-20260907';
const GLOBAL_REFRESH_MARKER='ciao-prod-global-refresh-15000-20260907';
const FINAL_IIFE_MARKER='  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script>';

export function homePredictionsNavFixSource(){
  return `
  /* ${HOME_PREDICTIONS_NAV_FIX_MARKER} */
  function __cwHomePredFixNav(){
    try{
      const home=root.querySelector('button[data-tab="predict"]');
      const predictions=root.querySelector('button[data-tab="mine"]');
      const homeLabel=home?.querySelector('.nav-label');
      const predictionsLabel=predictions?.querySelector('.nav-label');
      if(homeLabel)homeLabel.textContent='Главная';
      if(predictionsLabel)predictionsLabel.textContent='Прогнозы';
      if(predictions)predictions.style.display='';
      if(home)home.classList.toggle('active',tab==='predict');
      if(predictions)predictions.classList.toggle('active',tab==='mine');
    }catch(_e){}
  }

  __cwPredFixNav=__cwHomePredFixNav;
  predict=function(){return __cwPredLegacyPredict()};
  mine=function(){return __cwPredCenterHtml()};

  __cwPredApplyTheme=function(){
    try{
      const theme=tab==='mine'&&__cwPredCompetition?__cwPredTheme(__cwPredCompetition):'';
      if(theme)root.setAttribute('data-cwpred-screen-theme',theme);
      else root.removeAttribute('data-cwpred-screen-theme');
    }catch(_e){}
  };

  __cwPredHubHtml=function(){return '<section class="cwpred-hub"><div class="section-title cwpred-hub-title"><h3>Прогнозы</h3><span>5 турниров</span></div><div class="cwpred-grid">'+Object.values(__CWPRED_COMPETITIONS).map(item=>'<button type="button" class="cwpred-tournament-card '+(item.wide?'cwpred-tournament-card--wide':'')+'" data-cwpred-competition="'+item.key+'" data-cwpred-theme="'+item.theme+'"><span>'+item.title+'</span><i aria-hidden="true">→</i></button>').join('')+'</div><div class="cwpred-rules-note">Система очков: 5 / 3 / 2 / 0 · дедлайн за 15 минут до начала матча</div></section>'};

  function __cwPredUxGroupLocked(group){return __cwPredMode==='edit'&&!!group&&Array.isArray(group.matches)&&group.matches.length>0&&group.matches.every(match=>match?.stage_locked===true)}
  function __cwPredUxCurrentStageLabel(){const key=String(__cwPredExternalPayload?.prediction_stage_key||''),m=key.match(/^league-(\\d+)$/);return m?m[1]+'-го тура':'текущего тура'}
  __cwPredStageBarHtml=function(){const groups=__cwPredExternalGroups();if(!groups.length)return '';return '<div class="rounds cwpred-rounds">'+groups.map(g=>{const locked=__cwPredUxGroupLocked(g);return '<button type="button" class="round-chip '+(g.key===__cwPredStageKey?'active ':'')+(locked?'cwpred-stage-locked':'')+'" data-cwpred-stage="'+__cwPredEsc(g.key)+'" '+(locked?'aria-label="Тур пока закрыт"':'')+'>'+__cwPredEsc(__cwPredStageShort(g))+'</button>'}).join('')+'</div>'};

  const __cwPredUxLegacyDeadlineText=__cwPredDeadlineText;
  __cwPredDeadlineText=function(match){if(match?.stage_locked)return 'Откроется после завершения '+__cwPredUxCurrentStageLabel();return __cwPredUxLegacyDeadlineText(match)};

  function __cwPredUxMineBody(homeHtml,awayHtml,prediction,score,points){
    const result=score?'<div class="cwpred-mine-result-value"><small>СЧЁТ МАТЧА</small><b>'+__cwPredEsc(score)+'</b></div>':'<span class="cwpred-mine-await">Матч ещё не начался</span>';
    return '<div class="cwpred-mine-matchline">'+homeHtml+'<div class="cwpred-mine-primary"><small>ВАШ ПРОГНОЗ</small><b>'+__cwPredEsc(prediction)+'</b></div>'+awayHtml+'</div><div class="cwpred-mine-result-strip">'+result+(points?'<div class="cwpred-points">'+__cwPredEsc(points)+'</div>':'')+'</div>';
  }

  __cwPredExternalMineCard=function(match){const prediction=__cwPredExternalPredictionText(match),score=__cwPredRealScore(match),points=__cwPredPoints(match?.prediction?.points);return '<article class="cwpred-card cwpred-external-card cwpred-mine-card cwpred-mine-card--v2" data-cwpred-match="'+__cwPredEsc(String(match?.matchId||''))+'"><div class="cwpred-card-top"><span class="cwpred-status">'+__cwPredEsc(__cwPredStatus(match))+'</span><span class="cwpred-kickoff">'+__cwPredEsc(__cwPredDateTime(match?.kickoffAt))+'</span></div>'+__cwPredUxMineBody(__cwPredExternalTeamHtml(match?.homeTeam,'home'),__cwPredExternalTeamHtml(match?.awayTeam,'away'),prediction,score,points)+'</article>'};
  __cwPredSerieMineCard=function(match){const p=match?.prediction,pred=p?String(p.home_score)+' : '+String(p.away_score):'Прогноз не сделан',score=__cwPredSerieRealScore(match),points=__cwPredPoints(p?.points);return '<div class="mine-match cwpred-card cwpred-serie-card cwpred-mine-card cwpred-mine-card--v2" data-mid="'+Number(match.id)+'"><div class="cwpred-card-top"><span class="cwpred-status">'+__cwPredEsc(__cwPredSerieStatus(match))+'</span><span class="cwpred-kickoff">'+__cwPredEsc(typeof fmt==='function'?fmt(match.kickoff_at):'')+'</span></div>'+__cwPredUxMineBody(__cwPredSerieTeamHtml(match.home,'home'),__cwPredSerieTeamHtml(match.away,'away'),pred,score,points)+'</div>'};

  __cwPredExternalHtml=function(){const cover=__cwPredCoverHtml(__cwPredCompetition),controls='<div class="cwpred-tournament-controls">'+__cwPredModeHtml()+__cwPredStageBarHtml()+'</div>';if(__cwPredLoading&&!__cwPredExternalPayload)return cover+controls+'<div class="cwpred-state">Загружаем прогнозы…</div>';if(__cwPredError&&!__cwPredExternalPayload)return cover+controls+'<div class="cwpred-state cwpred-state--error"><b>Не удалось загрузить прогнозы</b><button type="button" data-cwpred-action="retry">Повторить</button></div>';const group=__cwPredSelectedGroup();if(!group)return cover+controls+'<div class="cwpred-state">Матчей пока нет</div>';const locked=__cwPredUxGroupLocked(group);const cards=group.matches.map(match=>__cwPredMode==='mine'?__cwPredExternalMineCard(match):__cwPredExternalEditCard(match)).join('');const save=!locked&&__cwPredExternalCanSave(group)?'<div class="cwpred-savebar"><button type="button" class="cwpred-save" data-cwpred-action="save" '+(__cwPredSaving?'disabled':'')+'>'+(__cwPredSaving?'Сохраняем…':'Сохранить прогнозы')+'</button></div>':'';const lockNote=locked?'<div class="cwpred-stage-lock-note">Прогнозы на этот тур откроются после завершения '+__cwPredUxCurrentStageLabel()+'</div>':'';return cover+controls+'<div class="section-title cwpred-stage-title"><h3>'+__cwPredEsc(group.label)+'</h3><span>'+(locked?'тур закрыт':'дедлайн −15 минут')+'</span></div>'+lockNote+'<div class="cwpred-cards">'+cards+'</div>'+save};

  __cwPredSerieHtml=function(){const cover=__cwPredCoverHtml('serie_a'),controls='<div class="cwpred-tournament-controls">'+__cwPredModeHtml()+(typeof roundBar==='function'?roundBar():'')+'</div>';if(!S?.round?.matches)return cover+controls+'<div class="cwpred-state">Загружаем тур…</div>';const cards=S.round.matches.map(match=>__cwPredMode==='mine'?__cwPredSerieMineCard(match):__cwPredSerieEditCard(match)).join('');const save=__cwPredMode==='edit'&&S.round.matches.some(match=>match.open)?'<div class="savebar cwpred-savebar"><button id="saveAll" class="save cwpred-save">Сохранить прогнозы</button></div>':'';return cover+controls+'<div class="section-title cwpred-stage-title"><h3>'+Number(S.selected_round)+'-й тур</h3><span>дедлайн −15 минут</span></div><div class="matches cwpred-cards">'+cards+'</div>'+save};

  const __cwPredUxLegacyOpenHub=__cwPredOpenHub;
  __cwPredOpenHub=function(){__cwPredMode='edit';return __cwPredUxLegacyOpenHub()};

  try{const styleId='cwpred-ux-fix-style';if(!document.getElementById(styleId)){const style=document.createElement('style');style.id=styleId;style.textContent='\
#ciao-miniapp-root .cwpred-tournament-controls{margin:6px 0 10px;padding:5px;border:1px solid rgba(255,255,255,.07);border-radius:17px;background:rgba(4,9,23,.52)}\
#ciao-miniapp-root .cwpred-tournament-controls .cwpred-mode{position:static!important;top:auto!important;z-index:auto!important;margin:0 0 7px!important;box-shadow:none!important;background:rgba(5,10,24,.72)!important}\
#ciao-miniapp-root .cwpred-tournament-controls .cwpred-rounds{margin:0!important;padding:2px 0 1px!important}\
#ciao-miniapp-root .cwpred-stage-locked{opacity:.45!important;position:relative!important;padding-right:22px!important}\
#ciao-miniapp-root .cwpred-stage-locked::after{content:"🔒";position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:9px;filter:grayscale(1)}\
#ciao-miniapp-root .cwpred-stage-lock-note{margin:-2px 0 10px;padding:10px 12px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.04);color:rgba(255,255,255,.58);font-size:10px;font-weight:750;line-height:1.35;text-align:center}\
#ciao-miniapp-root .cwpred-mine-card--v2{padding:13px 13px 12px!important}\
#ciao-miniapp-root .cwpred-mine-card--v2 .cwpred-card-top{margin-bottom:11px!important}\
#ciao-miniapp-root .cwpred-mine-matchline{display:grid;grid-template-columns:minmax(0,1fr) 104px minmax(0,1fr);align-items:center;gap:9px;min-width:0}\
#ciao-miniapp-root .cwpred-mine-primary{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:0;padding:7px 5px;border-radius:13px;background:rgba(255,255,255,.035)}\
#ciao-miniapp-root .cwpred-mine-primary small,#ciao-miniapp-root .cwpred-mine-result-value small{color:rgba(255,255,255,.43);font-size:8px;font-weight:850;letter-spacing:.045em}\
#ciao-miniapp-root .cwpred-mine-primary b{max-width:100%;color:#fff;font-size:20px;font-weight:950;white-space:nowrap}\
#ciao-miniapp-root .cwpred-mine-result-strip{display:flex;align-items:center;justify-content:center;gap:10px;min-height:34px;margin-top:11px;padding-top:9px;border-top:1px solid rgba(255,255,255,.055)}\
#ciao-miniapp-root .cwpred-mine-result-value{display:flex;align-items:baseline;gap:7px;min-width:0}\
#ciao-miniapp-root .cwpred-mine-result-value b{font-size:14px;font-weight:950;white-space:nowrap}\
#ciao-miniapp-root .cwpred-mine-await{color:rgba(255,255,255,.42);font-size:9px;font-weight:750}\
#ciao-miniapp-root .cwpred-mine-card--v2 .cwpred-team-name{font-size:11px!important}\
@media(max-width:370px){#ciao-miniapp-root .cwpred-mine-matchline{grid-template-columns:minmax(0,1fr) 90px minmax(0,1fr);gap:6px}#ciao-miniapp-root .cwpred-mine-card--v2 .cwpred-team-logo,#ciao-miniapp-root .cwpred-mine-card--v2 .cwpred-team .logo{width:40px!important;height:40px!important;max-width:40px!important;flex-basis:40px!important}#ciao-miniapp-root .cwpred-mine-primary b{font-size:18px}}\
';document.head.appendChild(style)}}catch(_e){}

  const __cwHomePredLegacyPredictionRefresh=__cwPredRefreshVisible;
  __cwPredRefreshVisible=async function(options={}){
    if(tab!=='mine')return false;
    return await __cwHomePredLegacyPredictionRefresh(options);
  };

  const __cwHomePredLegacyCoreRefresh=__cwRefreshCurrentCoreScreen;
  __cwRefreshCurrentCoreScreen=async function(seq,screenKey){
    if(tab==='predict'&&S){
      const keptDraft=new Map(draft);
      const scrollTop=Number(main?.scrollTop||0);
      try{
        const next=await api({action:'state',round:S.selected_round});
        if(seq!==__cwRefreshSeq||screenKey!==__cwRefreshScreenKey())return false;
        S=next;
        selectedRound=next?.selected_round;
        draft.clear();for(const [k,v] of keptDraft)draft.set(k,v);
        render();
        if(main&&Number.isFinite(scrollTop)){main.scrollTop=scrollTop;requestAnimationFrame(()=>{if(main)main.scrollTop=scrollTop})}
        return true;
      }catch(_e){
        draft.clear();for(const [k,v] of keptDraft)draft.set(k,v);
        return false;
      }
    }
    return await __cwHomePredLegacyCoreRefresh(seq,screenKey);
  };

  const __cwHomePredLegacyRefreshVisibleNow=__cwRefreshVisibleNow;
  __cwRefreshVisibleNow=async function(){
    if(tab!=='predict')return await __cwHomePredLegacyRefreshVisibleNow();
    if(document.hidden||__cwRefreshBusy)return false;
    __cwRefreshBusy=true;
    const seq=++__cwRefreshSeq;
    const screenKey=__cwRefreshScreenKey();
    try{return await __cwRefreshCurrentCoreScreen(seq,screenKey)}
    finally{__cwRefreshBusy=false}
  };
  try{window.__cwRefreshVisibleNow=__cwRefreshVisibleNow}catch(_e){}
  __cwRefreshStart();

  __cwHomePredFixNav();
  __cwPredApplyTheme();
  if(tab==='predict'||tab==='mine')render();
  /* /${HOME_PREDICTIONS_NAV_FIX_MARKER} */
`;
}

export function injectHomePredictionsNavFixPatch(input){
  const html=String(input||'');
  if(html.includes(HOME_PREDICTIONS_NAV_FIX_MARKER))return html;
  if(!html.includes(GLOBAL_REFRESH_MARKER))throw new Error('production global refresh layer missing before Home/Predictions nav fix');
  const index=html.lastIndexOf(FINAL_IIFE_MARKER);
  if(index<0)throw new Error('production v22.5 final IIFE marker missing');
  return `${html.slice(0,index)}${homePredictionsNavFixSource()}${html.slice(index)}`;
}

export function validateHomePredictionsNavFixPatchedHtml(input){
  const html=String(input||'');
  const count=html.split(HOME_PREDICTIONS_NAV_FIX_MARKER).length-1;
  if(count!==2)throw new Error(`production Home/Predictions nav fix marker count invalid: ${count}`);
  const refreshAt=html.indexOf(GLOBAL_REFRESH_MARKER);
  const fixAt=html.indexOf(HOME_PREDICTIONS_NAV_FIX_MARKER);
  if(refreshAt<0||fixAt<0||refreshAt>=fixAt)throw new Error('production Home/Predictions nav fix layer order invalid');
  const source=homePredictionsNavFixSource();
  for(const required of ["textContent='Главная'","textContent='Прогнозы'","predict=function(){return __cwPredLegacyPredict()}","mine=function(){return __cwPredCenterHtml()}","if(tab!=='mine')return false","__cwRefreshStart()","cwpred-tournament-controls","cwpred-mine-card--v2","stage_locked"]){
    if(!source.includes(required))throw new Error(`production Home/Predictions nav contract missing: ${required}`);
  }
  return true;
}
