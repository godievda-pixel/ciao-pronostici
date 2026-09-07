function byKickoffDesc(a,b){
  const ka=String(a?.kickoff_at??''),kb=String(b?.kickoff_at??'');
  if(ka!==kb)return kb.localeCompare(ka);
  return String(b?.prediction_key??'').localeCompare(String(a?.prediction_key??''));
}

function filterResults(results,{scope='overall',round=null,month=null}={}){
  if(scope==='round'){
    return results.filter(r=>r?.competition==='serie_a'&&Number(r?.serie_a_round_number)===Number(round));
  }
  if(scope==='month'){
    return results.filter(r=>String(r?.kickoff_at??'').slice(0,7)===String(month??''));
  }
  return results;
}

function statsFor(results,exactScore){
  const ordered=[...results].sort(byKickoffDesc);
  let streak=0;
  for(const row of ordered){
    if(Number(row?.points)>0)streak++;
    else break;
  }
  return {
    points:ordered.reduce((sum,row)=>sum+Number(row?.points??0),0),
    exact:ordered.filter(row=>Number(row?.base_points)===Number(exactScore)).length,
    successful:ordered.filter(row=>Number(row?.points)>0).length,
    calculated:ordered.length,
    streak,
  };
}

export function buildUnifiedStandings({
  users=[],
  teams=[],
  results=[],
  exactScore=5,
  scope='overall',
  round=null,
  month=null,
  currentRound=null,
  currentRoundKickoffAt=null,
}={}){
  const teamMap=new Map((teams??[]).map(team=>[Number(team.id),team]));
  const filtered=filterResults(results??[],{scope,round,month});
  const byUser=new Map();
  for(const row of filtered){
    const userId=Number(row?.user_id);
    if(!Number.isInteger(userId)||userId<=0)continue;
    const bucket=byUser.get(userId)??[];
    bucket.push(row);
    byUser.set(userId,bucket);
  }

  const rows=(users??[]).map(user=>{
    const id=Number(user.id);
    const stats=statsFor(byUser.get(id)??[],exactScore);
    const favorite=teamMap.get(Number(user.favorite_team_id));
    return {
      id,
      display_name:String(user.display_name??''),
      favorite_team_id:user.favorite_team_id??null,
      favorite_team:favorite?{
        id:Number(favorite.id),
        name:favorite.name,
        short_name:favorite.short_name,
        custom_emoji_id:favorite.custom_emoji_id,
      }:null,
      ...stats,
      trend:0,
    };
  }).sort((a,b)=>b.points-a.points||b.exact-a.exact||a.display_name.localeCompare(b.display_name));

  rows.forEach((row,index)=>{row.rank=index+1});

  if(scope==='overall'&&Number(currentRound)>1){
    const cutoffMs=currentRoundKickoffAt?Date.parse(String(currentRoundKickoffAt)):NaN;
    const previousResults=(results??[]).filter(row=>{
      if(Number.isFinite(cutoffMs)){
        const t=Date.parse(String(row?.kickoff_at??''));
        return Number.isFinite(t)&&t<cutoffMs;
      }
      return row?.competition==='serie_a'&&Number(row?.serie_a_round_number)<Number(currentRound);
    });
    const previousByUser=new Map();
    for(const row of previousResults){
      const userId=Number(row?.user_id);
      const bucket=previousByUser.get(userId)??[];
      bucket.push(row);
      previousByUser.set(userId,bucket);
    }
    const previous=(users??[]).map(user=>{
      const id=Number(user.id),stats=statsFor(previousByUser.get(id)??[],exactScore);
      return {id,display_name:String(user.display_name??''),points:stats.points,exact:stats.exact};
    }).sort((a,b)=>b.points-a.points||b.exact-a.exact||a.display_name.localeCompare(b.display_name));
    const rankMap=new Map(previous.map((row,index)=>[row.id,index+1]));
    for(const row of rows)row.trend=Number(rankMap.get(row.id)??row.rank)-row.rank;
  }

  return {
    scope,
    round:scope==='round'?Number(round):null,
    month:scope==='month'?String(month):null,
    rows,
    updated_at:new Date().toISOString(),
  };
}
