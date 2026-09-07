export const PREDICTION_MINE_STAGE_POLISH_MARKER='ciao-prod-prediction-mine-stage-polish-20260907';
const LIVE_SCROLL_MARKER='ciao-prod-prediction-live-scroll-polish-20260907';
const FINAL_IIFE_MARKER='  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script>';

export function previousSelectedLeagueStageLabel(stageKey){
  const m=String(stageKey??'').match(/^league-(\d+)$/);
  const n=m?Number(m[1]):NaN;
  return Number.isFinite(n)&&n>1?`${n-1}-го тура`:'предыдущего тура';
}

export function predictionMineStagePolishSource(){
  return `
  /* ${PREDICTION_MINE_STAGE_POLISH_MARKER} */
  function __cwPredMineStagePreviousLabel(stageKey){
    const m=String(stageKey||'').match(/^league-(\\d+)$/);
    const n=m?Number(m[1]):NaN;
    return Number.isFinite(n)&&n>1?(n-1)+'-го тура':'предыдущего тура';
  }

  function __cwPredMineStagePredictionBlock(hasPrediction,prediction){
    return '<div class="cwpred-mine-primary"><small>ВАШ ПРОГНОЗ</small><b>'+__cwPredEsc(hasPrediction?prediction:'— : —')+'</b>'+(hasPrediction?'':'<span class="cwpred-mine-missing">Прогноз не сделан</span>')+'</div>';
  }

  function __cwPredMineStageBody(homeHtml,awayHtml,hasPrediction,prediction,score,points){
    const result=score?'<div class="cwpred-mine-result-value"><small>СЧЁТ МАТЧА</small><b>'+__cwPredEsc(score)+'</b></div>':'<span class="cwpred-mine-await">Матч ещё не начался</span>';
    return '<div class="cwpred-mine-matchline">'+homeHtml+__cwPredMineStagePredictionBlock(hasPrediction,prediction)+awayHtml+'</div><div class="cwpred-mine-result-strip">'+result+(points?'<div class="cwpred-points">'+__cwPredEsc(points)+'</div>':'')+'</div>';
  }

  __cwPredExternalMineCard=function(match){
    const p=match?.prediction;
    const has=!!p;
    const prediction=has?String(p.home_score)+' : '+String(p.away_score):'— : —';
    const score=__cwPredRealScore(match),points=__cwPredPoints(p?.points);
    return '<article class="cwpred-card cwpred-external-card cwpred-mine-card cwpred-mine-card--v3" data-cwpred-match="'+__cwPredEsc(String(match?.matchId||''))+'"><div class="cwpred-card-top"><span class="cwpred-status">'+__cwPredEsc(__cwPredStatus(match))+'</span><span class="cwpred-kickoff">'+__cwPredEsc(__cwPredDateTime(match?.kickoffAt))+'</span></div>'+__cwPredMineStageBody(__cwPredExternalTeamHtml(match?.homeTeam,'home'),__cwPredExternalTeamHtml(match?.awayTeam,'away'),has,prediction,score,points)+'</article>';
  };

  __cwPredSerieMineCard=function(match){
    const p=match?.prediction;
    const has=!!p;
    const prediction=has?String(p.home_score)+' : '+String(p.away_score):'— : —';
    const score=__cwPredSerieRealScore(match),points=__cwPredPoints(p?.points);
    return '<div class="mine-match cwpred-card cwpred-serie-card cwpred-mine-card cwpred-mine-card--v3" data-mid="'+Number(match.id)+'"><div class="cwpred-card-top"><span class="cwpred-status">'+__cwPredEsc(__cwPredSerieStatus(match))+'</span><span class="cwpred-kickoff">'+__cwPredEsc(typeof fmt==='function'?fmt(match.kickoff_at):'')+'</span></div>'+__cwPredMineStageBody(__cwPredSerieTeamHtml(match.home,'home'),__cwPredSerieTeamHtml(match.away,'away'),has,prediction,score,points)+'</div>';
  };

  const __cwPredMineStageLegacyDeadlineText=__cwPredDeadlineText;
  __cwPredDeadlineText=function(match){
    if(match?.stage_locked)return 'Откроется после завершения '+__cwPredMineStagePreviousLabel(match?.stageKey||'');
    return __cwPredMineStageLegacyDeadlineText(match);
  };

  __cwPredStageBarHtml=function(){
    const groups=__cwPredExternalGroups();
    if(!groups.length)return '';
    return '<div class="rounds cwpred-rounds">'+groups.map(g=>{
      const locked=__cwPredUxGroupLocked(g);
      return '<button type="button" class="round-chip '+(g.key===__cwPredStageKey?'active ':'')+(locked?'cwpred-stage-locked':'')+'" data-cwpred-stage="'+__cwPredEsc(g.key)+'" aria-disabled="'+(locked?'true':'false')+'">'+__cwPredEsc(__cwPredStageShort(g))+'</button>';
    }).join('')+'</div>';
  };

  __cwPredExternalHtml=function(){
    const cover=__cwPredCoverHtml(__cwPredCompetition),controls='<div class="cwpred-tournament-controls">'+__cwPredModeHtml()+__cwPredStageBarHtml()+'</div>';
    if(__cwPredLoading&&!__cwPredExternalPayload)return cover+controls+'<div class="cwpred-state">Загружаем прогнозы…</div>';
    if(__cwPredError&&!__cwPredExternalPayload)return cover+controls+'<div class="cwpred-state cwpred-state--error"><b>Не удалось загрузить прогнозы</b><button type="button" data-cwpred-action="retry">Повторить</button></div>';
    const group=__cwPredSelectedGroup();
    if(!group)return cover+controls+'<div class="cwpred-state">Матчей пока нет</div>';
    const locked=__cwPredUxGroupLocked(group);
    const previous=__cwPredMineStagePreviousLabel(group.key);
    const cards=group.matches.map(match=>__cwPredMode==='mine'?__cwPredExternalMineCard(match):__cwPredExternalEditCard(match)).join('');
    const save=!locked&&__cwPredExternalCanSave(group)?'<div class="cwpred-savebar"><button type="button" class="cwpred-save" data-cwpred-action="save" '+(__cwPredSaving?'disabled':'')+'>'+(__cwPredSaving?'Сохраняем…':'Сохранить прогнозы')+'</button></div>':'';
    const lockNote=locked?'<div class="cwpred-stage-lock-note">Прогнозы на этот тур откроются после завершения '+__cwPredEsc(previous)+'</div>':'';
    return cover+controls+'<div class="section-title cwpred-stage-title"><h3>'+__cwPredEsc(group.label)+'</h3><span>'+(locked?'тур закрыт':'дедлайн −15 минут')+'</span></div>'+lockNote+'<div class="cwpred-cards">'+cards+'</div>'+save;
  };

  __cwPredSerieHtml=function(){
    const cover=__cwPredCoverHtml('serie_a');
    const rawRounds=typeof roundBar==='function'?String(roundBar()):'';
    const cleanRounds=rawRounds.replace(/[🔒🔐]\\s*/g,'');
    const controls='<div class="cwpred-tournament-controls">'+__cwPredModeHtml()+cleanRounds+'</div>';
    if(!S?.round?.matches)return cover+controls+'<div class="cwpred-state">Загружаем тур…</div>';
    const cards=S.round.matches.map(match=>__cwPredMode==='mine'?__cwPredSerieMineCard(match):__cwPredSerieEditCard(match)).join('');
    const save=__cwPredMode==='edit'&&S.round.matches.some(match=>match.open)?'<div class="savebar cwpred-savebar"><button id="saveAll" class="save cwpred-save">Сохранить прогнозы</button></div>':'';
    return cover+controls+'<div class="section-title cwpred-stage-title"><h3>'+Number(S.selected_round)+'-й тур</h3><span>дедлайн −15 минут</span></div><div class="matches cwpred-cards">'+cards+'</div>'+save;
  };

  try{const styleId='cwpred-mine-stage-polish-style';if(!document.getElementById(styleId)){const style=document.createElement('style');style.id=styleId;style.textContent='\
#ciao-miniapp-root .cwpred-stage-locked{opacity:.42!important;padding-right:12px!important;color:rgba(255,255,255,.48)!important;background:rgba(255,255,255,.025)!important;box-shadow:none!important;filter:saturate(.55)!important}\
#ciao-miniapp-root .cwpred-stage-locked.active{opacity:.55!important;color:rgba(255,255,255,.66)!important;background:rgba(255,255,255,.055)!important;border-color:rgba(255,255,255,.09)!important;box-shadow:none!important}\
#ciao-miniapp-root .cwpred-stage-locked::before{display:none!important}\
#ciao-miniapp-root .cwpred-stage-locked::after{display:none!important}\
#ciao-miniapp-root .cwpred-mine-card--v3{overflow:hidden!important}\
#ciao-miniapp-root .cwpred-mine-card--v3 .cwpred-mine-matchline{grid-template-columns:minmax(0,1fr) 94px minmax(0,1fr)!important;gap:8px!important}\
#ciao-miniapp-root .cwpred-mine-card--v3 .cwpred-team{min-width:0!important;width:100%!important;overflow:hidden!important}\
#ciao-miniapp-root .cwpred-mine-card--v3 .cwpred-team-name{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}\
#ciao-miniapp-root .cwpred-mine-card--v3 .cwpred-mine-primary{min-width:0!important;max-width:94px!important;padding:7px 4px!important;overflow:hidden!important}\
#ciao-miniapp-root .cwpred-mine-card--v3 .cwpred-mine-primary b{font-size:18px!important;line-height:1!important;white-space:nowrap!important}\
#ciao-miniapp-root .cwpred-mine-missing{display:block;max-width:100%;margin-top:4px;color:rgba(255,255,255,.42);font-size:7px;font-weight:750;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
#ciao-miniapp-root .cwpred-mine-card--v3 .cwpred-mine-result-strip{margin-top:10px!important;min-height:30px!important;padding-top:8px!important}\
@media(max-width:370px){#ciao-miniapp-root .cwpred-mine-card--v3 .cwpred-mine-matchline{grid-template-columns:minmax(0,1fr) 84px minmax(0,1fr)!important;gap:5px!important}#ciao-miniapp-root .cwpred-mine-card--v3 .cwpred-mine-primary{max-width:84px!important}#ciao-miniapp-root .cwpred-mine-card--v3 .cwpred-mine-primary b{font-size:16px!important}}\
';document.head.appendChild(style)}}catch(_e){}
  /* /${PREDICTION_MINE_STAGE_POLISH_MARKER} */
`;
}

export function injectPredictionMineStagePolishPatch(input){
  const html=String(input||'');
  if(html.includes(PREDICTION_MINE_STAGE_POLISH_MARKER))return html;
  if(!html.includes(LIVE_SCROLL_MARKER))throw new Error('production live/scroll polish missing before mine/stage polish');
  const index=html.lastIndexOf(FINAL_IIFE_MARKER);
  if(index<0)throw new Error('production v22.5 final IIFE marker missing');
  return `${html.slice(0,index)}${predictionMineStagePolishSource()}${html.slice(index)}`;
}

export function validatePredictionMineStagePolishPatchedHtml(input){
  const html=String(input||'');
  const count=html.split(PREDICTION_MINE_STAGE_POLISH_MARKER).length-1;
  if(count!==2)throw new Error(`production mine/stage polish marker count invalid: ${count}`);
  const liveAt=html.indexOf(LIVE_SCROLL_MARKER),fixAt=html.indexOf(PREDICTION_MINE_STAGE_POLISH_MARKER);
  if(liveAt<0||fixAt<0||liveAt>=fixAt)throw new Error('production mine/stage polish order invalid');
  return true;
}
