const DEADLINE_MS=15*60*1000;

function rows(query){
  if(query?.error)throw query.error;
  return Array.isArray(query?.data)?query.data:[];
}

function single(query,error='not_found'){
  if(query?.error)throw query.error;
  if(!query?.data)throw new Error(error);
  return query.data;
}

function compactTeam(team){
  if(!team)return null;
  return {
    id:Number(team.id),
    name:String(team.name??''),
    short_name:team.short_name??null,
    custom_emoji_id:team.custom_emoji_id??null,
  };
}

function matchTeam(team){
  const base=compactTeam(team);
  if(!base)return null;
  return {...base,bsd_team_id:team?.bsd_team_id==null?null:Number(team.bsd_team_id)};
}

function scheduleMatch(match,roundNumber){
  return {
    id:Number(match.id),
    round_number:Number(roundNumber)||null,
    kickoff_at:match.kickoff_at??null,
    home_score:match.home_score??null,
    away_score:match.away_score??null,
    is_finished:match.is_finished===true,
    live_status:match.live_status??null,
    live_elapsed:match.live_elapsed??null,
    home:compactTeam(match.home),
    away:compactTeam(match.away),
  };
}

function liveStatus(match){return String(match?.live_status??'').toLowerCase()==='live'}

function statusOf(match){
  if(liveStatus(match))return 'live';
  if(match?.is_finished===true||String(match?.live_status??'').toLowerCase()==='finished')return 'finished';
  return 'upcoming';
}

function pctSplit(counts){
  const total=counts.home+counts.draw+counts.away;
  if(!total)return {total:0,home:{count:0,pct:0},draw:{count:0,pct:0},away:{count:0,pct:0}};
  const keys=['home','draw','away'];
  const raw=keys.map(key=>counts[key]*100/total),base=raw.map(Math.floor);
  let remainder=100-base.reduce((sum,value)=>sum+value,0);
  const order=[0,1,2].sort((a,b)=>(raw[b]-base[b])-(raw[a]-base[a]));
  for(let i=0;i<remainder;i++)base[order[i%order.length]]++;
  return {total,...Object.fromEntries(keys.map((key,index)=>[key,{count:counts[key],pct:base[index]}]))};
}

function predictionSplit(predictions){
  const counts={home:0,draw:0,away:0};
  for(const prediction of predictions){
    const home=Number(prediction?.home_score),away=Number(prediction?.away_score);
    if(home>away)counts.home++;
    else if(home<away)counts.away++;
    else counts.draw++;
  }
  return pctSplit(counts);
}

function legacyPrediction(row){
  if(!row)return null;
  return {
    home_score:Number(row.home_score),away_score:Number(row.away_score),
    points:row.points==null?null:Number(row.points),updated_at:row.updated_at??null,
  };
}

function legacyMatch(row,prediction=null){
  return {
    id:Number(row.id),bsd_event_id:row.bsd_event_id==null?null:Number(row.bsd_event_id),kickoff_at:row.kickoff_at??null,
    schedule_status:row.schedule_status??null,home_score:row.home_score??null,away_score:row.away_score??null,
    is_finished:row.is_finished===true,live_status:row.live_status??null,live_elapsed:row.live_elapsed??null,
    live_updated_at:row.live_updated_at??null,result_source:row.result_source??null,round:row.round??null,
    home:matchTeam(row.home),away:matchTeam(row.away),prediction,
  };
}

const MATCH_SECTION_MAP=Object.freeze({detail:'overview',stats:'stats',incidents:'events',lineups:'lineups',player_stats:'players'});

export function createV22CompatSpecialized({db,matchService=null,now=()=>Date.now()}={}){
  if(!db?.from)throw new Error('db_required');

  async function loadSchedule(){
    const [roundQuery,matchQuery]=await Promise.all([
      db.from('cp_rounds').select('id,number,nominal_date').order('number',{ascending:true}),
      db.from('cp_matches')
        .select('id,round_id,kickoff_at,home_score,away_score,is_finished,live_status,live_elapsed,home:cp_teams!cp_matches_home_team_fk(id,name,short_name,custom_emoji_id),away:cp_teams!cp_matches_away_team_fk(id,name,short_name,custom_emoji_id)')
        .order('kickoff_at',{ascending:true,nullsFirst:false})
        .order('id',{ascending:true}),
    ]);
    const roundRows=rows(roundQuery),matchRows=rows(matchQuery);
    const numberById=new Map(roundRows.map(item=>[Number(item.id),Number(item.number)]));
    const byRound=new Map();
    for(const match of matchRows){
      const roundNumber=numberById.get(Number(match.round_id));
      if(!roundNumber)continue;
      const list=byRound.get(roundNumber)??[];
      list.push(scheduleMatch(match,roundNumber));
      byRound.set(roundNumber,list);
    }
    const rounds=roundRows.map(round=>{
      const number=Number(round.number),matches=byRound.get(number)??[];
      const finished=matches.filter(match=>match.is_finished).length;
      return {
        number,
        nominal_date:round.nominal_date??null,
        total:matches.length,
        finished,
        is_complete:matches.length>0&&finished>=matches.length,
        matches,
      };
    }).filter(round=>round.number>0);
    const current_round=rounds.find(round=>round.total>0&&!round.is_complete)?.number??rounds.at(-1)?.number??1;
    return {ok:true,rounds,current_round,updated_at:new Date(Number(now())).toISOString()};
  }

  async function loadLive({snapshot=false}={}){
    const timestamp=Number(now()),from=new Date(timestamp-8*3600000).toISOString(),to=new Date(timestamp+8*3600000).toISOString();
    const select=snapshot
      ? 'id,kickoff_at,home_score,away_score,is_finished,live_status,live_phase,live_elapsed,live_updated_at'
      : 'id,kickoff_at,home_score,away_score,is_finished,live_status,live_elapsed,live_updated_at';
    const query=await db.from('cp_matches').select(select).gte('kickoff_at',from).lte('kickoff_at',to).order?.('kickoff_at')??null;
    const base=rows(query);
    const hasLive=base.some(liveStatus);
    if(snapshot){
      return {
        ok:true,
        matches:base.map(match=>({
          id:Number(match.id),kickoff_at:match.kickoff_at??null,home_score:match.home_score??null,away_score:match.away_score??null,
          is_finished:match.is_finished===true,live_status:match.live_status??null,live_phase:match.live_phase??null,
          live_elapsed:match.live_elapsed??null,live_updated_at:match.live_updated_at??null,
        })),
        has_live:hasLive,
        recommended_poll_ms:hasLive?10000:60000,
        server_time:new Date(timestamp).toISOString(),
      };
    }
    const matches=base.map(match=>{
      const kickoff=Date.parse(String(match.kickoff_at??''));
      const open=match.is_finished!==true&&(!Number.isFinite(kickoff)||timestamp<kickoff-DEADLINE_MS);
      return {
        id:Number(match.id),kickoff_at:match.kickoff_at??null,home_score:match.home_score??null,away_score:match.away_score??null,
        is_finished:match.is_finished===true,live_status:match.live_status??null,live_elapsed:match.live_elapsed??null,
        live_updated_at:match.live_updated_at??null,open,
      };
    });
    return {
      ok:true,matches,has_live:hasLive,
      recommended_poll_ms:hasLive?30000:180000,
      cache_ttl_ms:hasLive?5000:30000,
      server_time:new Date(timestamp).toISOString(),
    };
  }

  async function localMatch(matchId){
    const id=Number(matchId);
    if(!Number.isInteger(id)||id<=0)throw Object.assign(new Error('Некорректный матч'),{status:400});
    const query=await db.from('cp_matches')
      .select('id,bsd_event_id,kickoff_at,schedule_status,home_score,away_score,is_finished,live_status,live_elapsed,live_updated_at,result_source,round:cp_rounds!cp_matches_round_fk(number),home:cp_teams!cp_matches_home_team_fk(id,name,short_name,custom_emoji_id,bsd_team_id),away:cp_teams!cp_matches_away_team_fk(id,name,short_name,custom_emoji_id,bsd_team_id)')
      .eq('id',id).maybeSingle();
    return single(query,'Матч не найден');
  }

  async function userPrediction(matchId,userId){
    const query=await db.from('cp_predictions').select('home_score,away_score,points,updated_at').eq('user_id',Number(userId)).eq('match_id',Number(matchId)).maybeSingle();
    if(query?.error)throw query.error;
    return legacyPrediction(query?.data??null);
  }

  async function splitForMatch(matchId){
    const query=await db.from('cp_predictions').select('home_score,away_score').eq('match_id',Number(matchId));
    return predictionSplit(rows(query));
  }

  async function loadMatchSummary(payload,context){
    const row=await localMatch(payload?.match_id);
    const [prediction,split]=await Promise.all([userPrediction(row.id,context?.userId),splitForMatch(row.id)]);
    const status=statusOf(row);
    return {
      ok:true,match:legacyMatch(row,prediction),prediction_split:split,status,summary_only:true,
      recommended_poll_ms:status==='live'?30000:180000,
    };
  }

  async function loadMatchCenter(payload,context){
    if(!matchService?.getMatchCenter)throw new Error('match_service_required');
    const row=await localMatch(payload?.match_id);
    const providerId=String(row.bsd_event_id??'');
    if(!providerId)throw new Error('match_provider_id_missing');
    const requested=[...new Set((Array.isArray(payload?.sections)&&payload.sections.length?payload.sections:['detail','stats','incidents','lineups','player_stats','overview_meta']).map(String))];
    const providerSections=requested.filter(key=>MATCH_SECTION_MAP[key]).map(key=>[key,MATCH_SECTION_MAP[key]]);
    const results=await Promise.all(providerSections.map(async([legacyKey,section])=>{
      const result=await matchService.getMatchCenter({competition:'serie_a',matchId:providerId,section});
      return [legacyKey,result?.data??null];
    }));
    const sectionData=Object.fromEntries(results);
    const prediction=await userPrediction(row.id,context?.userId);
    const split=payload?.include_split===true?await splitForMatch(row.id):null;
    const status=statusOf(row),overviewMeta=requested.includes('overview_meta')?{venue:null,referee:null,form:{home:[],away:[]}}:null;
    const coverage={};
    for(const key of ['detail','stats','incidents','lineups','player_stats'])coverage[key]=sectionData[key]!=null;
    coverage.overview_meta=overviewMeta!=null;
    return {
      ok:true,match:legacyMatch(row,prediction),prediction_split:split,status,cached:false,refresh_in_progress:false,
      refreshed_sections:requested,fetched_at:new Date(Number(now())).toISOString(),coverage,
      detail:sectionData.detail??null,stats:sectionData.stats??null,incidents:sectionData.incidents??null,lineups:sectionData.lineups??null,
      player_stats:sectionData.player_stats??null,overview_meta:overviewMeta,errors:{},recommended_poll_ms:status==='live'?30000:180000,
    };
  }

  async function dispatch(route,payload={},context={}){
    if(route?.kind==='schedule')return await loadSchedule();
    if(route?.kind==='live_updates')return await loadLive({snapshot:false});
    if(route?.kind==='live_snapshot')return await loadLive({snapshot:true});
    if(route?.kind==='match_summary')return await loadMatchSummary(payload,context);
    if(route?.kind==='match_center')return await loadMatchCenter(payload,context);
    throw new Error(`specialized_not_implemented:${String(route?.kind??'missing')}`);
  }

  return Object.freeze({dispatch});
}
