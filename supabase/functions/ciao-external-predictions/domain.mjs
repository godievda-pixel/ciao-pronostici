const EXTERNAL_COMPETITIONS=new Set(['coppa_italia','ucl','uel','uecl']);
const LOCK_MS=15*60*1000;

export function parseExternalMatchId(matchId){
  const m=String(matchId??'').trim().match(/^(coppa_italia|ucl|uel|uecl):(\d+)$/);
  if(!m)return null;
  const providerEventId=Number(m[2]);
  return Number.isSafeInteger(providerEventId)&&providerEventId>0?{competition:m[1],providerEventId}:null;
}

export function predictionDeadlineAt(kickoffAt){
  const t=Date.parse(String(kickoffAt??''));
  return Number.isFinite(t)?new Date(t-LOCK_MS).toISOString():null;
}

export function isPredictionOpen(match,nowMs=Date.now()){
  if(!match||String(match.status??'')!=='scheduled')return false;
  const kickoff=Date.parse(match?.kickoffAt||match?.kickoff_at||'');
  return Number.isFinite(kickoff)&&Number.isFinite(Number(nowMs))&&Number(nowMs)<kickoff-LOCK_MS;
}

export function isValidPredictionScore(value){
  return Number.isInteger(value)&&value>=0&&value<=20;
}

function isValidResultScore(value){
  return Number.isInteger(value)&&value>=0;
}

function outcomeSign(h,a){return Math.sign(h-a)}

export function scorePrediction(prediction,result,rules){
  const ph=prediction?.homeScore,pa=prediction?.awayScore,rh=result?.homeScore,ra=result?.awayScore;
  if(!isValidPredictionScore(ph)||!isValidPredictionScore(pa)||!isValidResultScore(rh)||!isValidResultScore(ra))return null;
  if(ph===rh&&pa===ra)return Number(rules?.exact_score??5);
  if(ph-pa===rh-ra)return Number(rules?.correct_goal_difference??3);
  if(outcomeSign(ph,pa)===outcomeSign(rh,ra))return Number(rules?.correct_outcome??2);
  return Number(rules?.miss??0);
}

export function resultSignature(match){
  const h=match?.homeScore,a=match?.awayScore;
  return String(match?.status??'')==='finished'&&Number.isInteger(h)&&Number.isInteger(a)?`finished:${h}:${a}`:'';
}

function numericId(value){const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null}

export function toExternalMatchRow(match,syncedAt=new Date().toISOString()){
  if(!match||!EXTERNAL_COMPETITIONS.has(String(match.competition??'')))throw new Error('invalid external competition');
  const parsed=parseExternalMatchId(`${match.competition}:${match.sourceId}`);
  if(!parsed)throw new Error('invalid external match identity');
  const kickoff=Date.parse(String(match.kickoffAt??''));
  if(!Number.isFinite(kickoff))throw new Error('invalid kickoff');
  return {
    competition:parsed.competition,
    provider:'bsd',
    provider_event_id:parsed.providerEventId,
    stage_key:String(match.stageKey||'matches'),
    stage_label:String(match.stageLabel||'Матчи'),
    stage_order:Number.isFinite(Number(match.stageOrder))?Number(match.stageOrder):900,
    round_number:Number.isInteger(Number(match.round))?Number(match.round):null,
    kickoff_at:new Date(kickoff).toISOString(),
    status:String(match.status||'scheduled'),
    minute:Number.isFinite(Number(match.minute))?Number(match.minute):null,
    home_bsd_team_id:numericId(match?.homeTeam?.id),
    home_name:String(match?.homeTeam?.name||'—'),
    home_country_code:String(match?.homeTeam?.countryCode||''),
    home_crest_url:String(match?.homeTeam?.crestUrl||''),
    away_bsd_team_id:numericId(match?.awayTeam?.id),
    away_name:String(match?.awayTeam?.name||'—'),
    away_country_code:String(match?.awayTeam?.countryCode||''),
    away_crest_url:String(match?.awayTeam?.crestUrl||''),
    home_score:Number.isInteger(match?.homeScore)?match.homeScore:null,
    away_score:Number.isInteger(match?.awayScore)?match.awayScore:null,
    provider_updated_at:match?.providerUpdatedAt?new Date(match.providerUpdatedAt).toISOString():null,
    synced_at:syncedAt,
  };
}
