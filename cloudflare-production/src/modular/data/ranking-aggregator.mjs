export const RANKING_SCOPES = Object.freeze({
  all:Object.freeze(['serie_a','coppa_italia','ucl','uel','uecl']),
  italy:Object.freeze(['serie_a','coppa_italia']),
  europe:Object.freeze(['ucl','uel','uecl']),
});

function text(value){return String(value??'').trim()}

export function aggregateRankingEntries(entries=[],scope='all'){
  const competitions=RANKING_SCOPES[scope];
  if(!competitions)throw new Error(`invalid_ranking_scope:${scope}`);
  const allowed=new Set(competitions);
  const users=new Map();
  for(const entry of Array.isArray(entries)?entries:[]){
    if(!allowed.has(text(entry?.competition)))continue;
    const userId=text(entry?.userId||entry?.user_id||entry?.id);
    if(!userId)continue;
    const current=users.get(userId)||{
      userId,
      displayName:text(entry?.displayName||entry?.display_name||entry?.name)||'Участник',
      username:text(entry?.username),
      favoriteTeam:entry?.favoriteTeam||entry?.favorite_team||null,
      points:0,
      isCurrent:entry?.isCurrent===true||entry?.is_current===true,
    };
    current.points += Number(entry?.points)||0;
    current.isCurrent = current.isCurrent || entry?.isCurrent===true || entry?.is_current===true;
    users.set(userId,current);
  }
  return [...users.values()]
    .sort((a,b)=>b.points-a.points||a.displayName.localeCompare(b.displayName,'ru'))
    .map((row,index)=>Object.freeze({...row,rank:index+1}));
}
