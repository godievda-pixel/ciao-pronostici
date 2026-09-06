function text(value){return String(value??'').trim();}
function numberOrNull(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function team(raw={}){
  return {
    id:numberOrNull(raw?.id ?? raw?.team_id),
    name:text(raw?.name ?? raw?.team_name),
    crestUrl:text(raw?.crestUrl ?? raw?.crest_url ?? raw?.logo_url ?? raw?.logo),
  };
}
function qualification(stage,value){
  if(value===true)return true;
  return /qualif|prelim|квалиф|предвар/i.test(text(stage));
}
export function normalizeMatch(raw={},competitionHint=''){
  const competition=text(raw?.competition||competitionHint).toLowerCase();
  const stage=text(raw?.stage ?? raw?.phase ?? raw?.round_name);
  return {
    id:text(raw?.id ?? raw?.match_id),
    competition,
    kickoffAt:text(raw?.kickoffAt ?? raw?.kickoff_at),
    status:text(raw?.status ?? raw?.live_status ?? (raw?.is_finished?'finished':'scheduled')).toLowerCase() || 'scheduled',
    minute:numberOrNull(raw?.minute ?? raw?.live_elapsed),
    home:team(raw?.home ?? raw?.home_team),
    away:team(raw?.away ?? raw?.away_team),
    score:{
      home:numberOrNull(raw?.score?.home ?? raw?.home_score),
      away:numberOrNull(raw?.score?.away ?? raw?.away_score),
    },
    round:numberOrNull(raw?.round ?? raw?.round_number),
    stage,
    isQualification:qualification(stage,raw?.isQualification ?? raw?.is_qualification),
  };
}
