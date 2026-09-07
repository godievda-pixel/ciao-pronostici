const DEADLINE_MS=15*60*1000;

function rows(query){
  if(query?.error)throw query.error;
  return Array.isArray(query?.data)?query.data:[];
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

export function createV22CompatSpecialized({db,now=()=>Date.now()}={}){
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

  async function dispatch(route,payload={},context={}){
    void payload;void context;
    if(route?.kind==='schedule')return await loadSchedule();
    if(route?.kind==='live_updates')return await loadLive({snapshot:false});
    if(route?.kind==='live_snapshot')return await loadLive({snapshot:true});
    throw new Error(`specialized_not_implemented:${String(route?.kind??'missing')}`);
  }

  return Object.freeze({dispatch});
}
