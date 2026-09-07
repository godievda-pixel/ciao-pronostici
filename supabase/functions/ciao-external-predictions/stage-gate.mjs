const UEFA_LEAGUE=new Set(['ucl','uel','uecl']);
const leagueStage=key=>/^league-\d+$/.test(String(key??''));

export function predictionStageGate(competition,rows=[]){
  if(!UEFA_LEAGUE.has(String(competition??'')))return{currentStageKey:null,currentStageOrder:null};
  const groups=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    if(!leagueStage(row?.stage_key))continue;
    const key=String(row.stage_key),order=Number(row?.stage_order??900);
    const group=groups.get(key)??{key,order,rows:[]};
    group.order=Math.min(group.order,order);
    group.rows.push(row);
    groups.set(key,group);
  }
  const ordered=[...groups.values()].sort((a,b)=>a.order-b.order||a.key.localeCompare(b.key));
  const current=ordered.find(group=>!group.rows.every(row=>String(row?.status??'')==='finished'))||null;
  return{currentStageKey:current?.key??null,currentStageOrder:current?Number(current.order):null};
}

export function isFuturePredictionStageLocked(competition,row,gate){
  if(!UEFA_LEAGUE.has(String(competition??''))||!leagueStage(row?.stage_key))return false;
  const currentOrder=Number(gate?.currentStageOrder);
  const order=Number(row?.stage_order);
  if(!Number.isFinite(currentOrder)||!Number.isFinite(order))return false;
  return order>currentOrder;
}
