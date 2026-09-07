import {
  isPredictionOpen,
  isValidPredictionScore,
  parseExternalMatchId,
  predictionDeadlineAt,
  resultSignature,
} from './domain.mjs';

const EXTERNAL=['coppa_italia','ucl','uel','uecl'];

export class ExternalPredictionServiceError extends Error{
  constructor(code,status=400){super(code);this.name='ExternalPredictionServiceError';this.code=code;this.status=status}
}

function validCompetition(value){return EXTERNAL.includes(String(value??''))}
function canonicalId(row){return `${row.competition}:${row.provider_event_id}`}
function dbRowToMatch(row){
  const kickoffAt=row.kickoff_at;
  return {
    matchId:canonicalId(row),sourceId:String(row.provider_event_id),competition:row.competition,
    kickoffAt,status:row.status,minute:row.minute??null,stageKey:row.stage_key,stageLabel:row.stage_label,
    stageOrder:Number(row.stage_order??900),round:row.round_number??null,
    homeTeam:{id:row.home_bsd_team_id==null?'':String(row.home_bsd_team_id),name:row.home_name,countryCode:row.home_country_code||'',crestUrl:row.home_crest_url||'',isItalian:String(row.home_country_code||'').toUpperCase()==='ITA'},
    awayTeam:{id:row.away_bsd_team_id==null?'':String(row.away_bsd_team_id),name:row.away_name,countryCode:row.away_country_code||'',crestUrl:row.away_crest_url||'',isItalian:String(row.away_country_code||'').toUpperCase()==='ITA'},
    homeScore:Number.isInteger(row.home_score)?row.home_score:null,
    awayScore:Number.isInteger(row.away_score)?row.away_score:null,
  };
}

export function createExternalPredictionService({repository,fetchMatches,now=()=>Date.now()}){
  if(!repository||typeof fetchMatches!=='function')throw new TypeError('repository and fetchMatches required');

  async function ensureEnabled(){
    if(!(await repository.featureEnabled('external_predictions_v1')))throw new ExternalPredictionServiceError('feature_disabled',503);
  }

  async function settle(rows){
    const finished=rows.filter(row=>row.status==='finished'&&Number.isInteger(row.home_score)&&Number.isInteger(row.away_score));
    if(!finished.length)return;
    const rules=await repository.scoringRules();
    for(const row of finished){
      const sig=resultSignature({status:'finished',homeScore:row.home_score,awayScore:row.away_score});
      if(sig)await repository.settleFinishedMatch(row.id,sig,{homeScore:row.home_score,awayScore:row.away_score},rules);
    }
  }

  async function syncCompetition(competition,{initData='',allowFallback=false}={}){
    let stale=false;
    try{
      const incoming=await fetchMatches({competition,initData});
      const matches=(Array.isArray(incoming)?incoming:[]).filter(m=>m&&m.competition===competition&&parseExternalMatchId(m.matchId||`${m.competition}:${m.sourceId}`));
      await repository.upsertMatches(matches);
    }catch(error){
      if(!allowFallback)throw new ExternalPredictionServiceError('provider_refresh_failed',502);
      stale=true;
    }
    let rows=await repository.listMatches(competition);
    if(stale&&!rows.length)throw new ExternalPredictionServiceError('provider_refresh_failed',502);
    await settle(rows);
    rows=await repository.listMatches(competition);
    return {rows,stale};
  }

  async function state({userId,competition,initData=''}){
    if(!validCompetition(competition))throw new ExternalPredictionServiceError('invalid_competition',400);
    if(!Number.isInteger(Number(userId))||Number(userId)<=0)throw new ExternalPredictionServiceError('invalid_user',400);
    await ensureEnabled();
    const {rows,stale}=await syncCompetition(competition,{initData,allowFallback:true});
    const ids=rows.map(row=>row.id);
    const predictions=ids.length?await repository.listUserPredictions(Number(userId),ids):[];
    const pm=new Map(predictions.map(p=>[Number(p.external_match_id),p]));
    const nowMs=Number(now());
    return {
      competition,stale,server_time:new Date(nowMs).toISOString(),
      matches:rows.map(row=>({
        ...dbRowToMatch(row),
        open:isPredictionOpen(row,nowMs),
        deadline_at:predictionDeadlineAt(row.kickoff_at),
        prediction:pm.get(Number(row.id))??null,
      })),
    };
  }

  async function savePredictions({userId,competition,predictions,initData=''}){
    if(!validCompetition(competition))throw new ExternalPredictionServiceError('invalid_competition',400);
    if(!Number.isInteger(Number(userId))||Number(userId)<=0)throw new ExternalPredictionServiceError('invalid_user',400);
    await ensureEnabled();
    await syncCompetition(competition,{initData,allowFallback:false});
    const items=Array.isArray(predictions)?predictions:[];
    const requestedIds=items.map(x=>String(x?.match_id??'')).filter(Boolean);
    const sameCompetitionIds=requestedIds.filter(id=>parseExternalMatchId(id)?.competition===competition);
    const rows=await repository.findMatchesByCanonicalIds(sameCompetitionIds);
    const byId=new Map(rows.map(row=>[canonicalId(row),row]));
    const closed=[],invalid=[],writes=[],seen=new Set(),nowMs=Number(now());
    for(const item of items){
      const matchId=String(item?.match_id??'');
      if(seen.has(matchId))continue;seen.add(matchId);
      const parsed=parseExternalMatchId(matchId);
      const home=Number(item?.home_score),away=Number(item?.away_score);
      if(!parsed||parsed.competition!==competition||!isValidPredictionScore(home)||!isValidPredictionScore(away)){invalid.push(matchId);continue}
      const row=byId.get(matchId);
      if(!row){invalid.push(matchId);continue}
      if(!isPredictionOpen(row,nowMs)){closed.push(matchId);continue}
      writes.push({user_id:Number(userId),external_match_id:Number(row.id),home_score:home,away_score:away,points:null,base_points:null,calculated_at:null,updated_at:new Date(nowMs).toISOString()});
    }
    if(writes.length)await repository.upsertUserPredictions(writes);
    return {saved:writes.length,closed,invalid,deadline_minutes:15};
  }

  async function syncDue({initData='internal-sync'}={}){
    const result={synced:0,competitions:{}};
    for(const competition of EXTERNAL){
      try{
        const {rows}=await syncCompetition(competition,{initData,allowFallback:false});
        result.competitions[competition]={ok:true,matches:rows.length};result.synced+=rows.length;
      }catch(error){result.competitions[competition]={ok:false,error:error?.code||'sync_failed'}}
    }
    return result;
  }

  return {state,savePredictions,syncDue};
}
