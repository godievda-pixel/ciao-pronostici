const BSD_BASE = 'https://sports.bzzoiro.com/api/v2';
const EUROPEAN = new Set(['ucl','uel','uecl']);
const LEAGUE_ALIASES = Object.freeze({
  coppa_italia:['coppa italia'],
  ucl:['champions league','uefa champions league'],
  uel:['europa league','uefa europa league'],
  uecl:['conference league','uefa conference league'],
});
const SECTION_PATHS = Object.freeze({
  overview:id=>`/events/${id}/`,
  stats:id=>`/events/${id}/stats/`,
  events:id=>`/events/${id}/incidents/`,
  lineups:id=>`/events/${id}/lineups/`,
  players:id=>`/events/${id}/player-stats/`,
});

function text(value){return String(value??'').trim()}
function number(value){const n=Number(value);return Number.isFinite(n)?n:null}
function lower(value){return text(value).toLowerCase().replace(/^uefa\s+/,'').replace(/\s+/g,' ')}
function rows(payload){if(Array.isArray(payload))return payload;if(Array.isArray(payload?.results))return payload.results;if(Array.isArray(payload?.data))return payload.data;return []}
function logo(id){return id?`${BSD_BASE}/../img/team/${encodeURIComponent(id)}/?bg=transparent`.replace('/api/v2/../','/') : ''}
function auth(apiKey){const key=text(apiKey);if(!key)throw new Error('bsd_api_key_required');return{accept:'application/json',authorization:`Token ${key}`}}

async function getJson(fetchImpl,apiKey,path,params={}){
  const url=new URL(`${BSD_BASE}${path}`);
  for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));
  const response=await fetchImpl(url,{headers:auth(apiKey)});
  if(!response?.ok)throw new Error(`bsd_http_${response?.status??0}`);
  return await response.json();
}

async function all(fetchImpl,apiKey,path,params={}){
  const result=[];let offset=0;const limit=200;
  while(true){
    const payload=await getJson(fetchImpl,apiKey,path,{...params,limit,offset});
    const page=rows(payload);result.push(...page);
    const count=number(payload?.count);
    if(page.length<limit||(count!==null&&result.length>=count)||!page.length)break;
    offset+=page.length;
  }
  return result;
}

async function resolveLeague(fetchImpl,apiKey,competition){
  const aliases=LEAGUE_ALIASES[competition];if(!aliases)throw new Error(`invalid_external_competition:${competition}`);
  const list=await all(fetchImpl,apiKey,'/leagues/');
  const expected=new Set(aliases.map(lower));
  const league=list.find(item=>expected.has(lower(item?.name||item?.league_name)));
  if(!league?.id)throw new Error(`bsd_league_not_found:${competition}`);
  return league;
}

async function resolveSeason(fetchImpl,apiKey,leagueId){
  const direct=await getJson(fetchImpl,apiKey,`/leagues/${encodeURIComponent(leagueId)}/season/`).catch(()=>null);
  const candidate=direct?.id?direct:direct?.season?.id?direct.season:null;
  if(candidate?.id)return candidate;
  const list=await all(fetchImpl,apiKey,`/leagues/${encodeURIComponent(leagueId)}/seasons/`);
  const current=list.find(item=>item?.is_current===true||item?.current===true);
  const chosen=current||[...list].sort((a,b)=>(Number(b?.year)||0)-(Number(a?.year)||0)||Number(b?.id||0)-Number(a?.id||0))[0];
  if(!chosen?.id)throw new Error('bsd_season_not_found');
  return chosen;
}

async function competitionMeta(fetchImpl,apiKey,competition){
  const league=await resolveLeague(fetchImpl,apiKey,competition);
  const season=await resolveSeason(fetchImpl,apiKey,league.id);
  return{league,season};
}

async function italianTeamIds(fetchImpl,apiKey){
  const list=await all(fetchImpl,apiKey,'/teams/',{country_code:'IT'});
  return new Set(list.map(item=>text(item?.id)).filter(Boolean));
}

function team(event,side,italianIds){
  const raw=event?.[`${side}_team`];
  const id=text((raw&&typeof raw==='object'?raw.id:'')||event?.[`${side}_team_id`]);
  const name=text((raw&&typeof raw==='object'?raw.name:raw)||event?.[`${side}_team_name`]);
  const cc=text(raw&&typeof raw==='object'?(raw.country_code||raw?.country?.code||raw.country):'').toUpperCase();
  return{id,name,crestUrl:logo(id),isItalian:italianIds.has(id)||cc==='IT'||cc==='ITA'};
}

function status(event){const value=lower(event?.status);if(['live','inprogress','in_progress'].includes(value))return'live';if(['finished','ended','fulltime','full_time'].includes(value))return'finished';if(value==='postponed')return'postponed';if(['cancelled','canceled'].includes(value))return'cancelled';return'scheduled'}
function score(event,side,current){if(!['live','finished'].includes(current))return null;return number(event?.[`${side}_score`]??event?.score?.[side])}
function qualification(value){return /qualif|qualification|qualifying|preliminary/i.test(text(value))}

function normalizeEvent(event,competition,italianIds){
  const sourceId=text(event?.id??event?.event_id);if(!sourceId)return null;
  const current=status(event),stage=text(event?.round_name||event?.stage||event?.phase||event?.group_name),home=team(event,'home',italianIds),away=team(event,'away',italianIds);
  if(EUROPEAN.has(competition)&&!home.isItalian&&!away.isItalian)return null;
  return{
    id:`${competition}:${sourceId}`,sourceId,competition,
    season:text(event?.season?.name||event?.season?.year||event?.season),
    kickoffAt:text(event?.event_date||event?.kickoff_at||event?.date),
    status:current,minute:current==='live'?number(event?.current_minute??event?.minute):null,
    home:{id:home.id,name:home.name,crestUrl:home.crestUrl},away:{id:away.id,name:away.name,crestUrl:away.crestUrl},
    score:{home:score(event,'home',current),away:score(event,'away',current)},
    round:text(event?.round_number??event?.round),stage,isQualification:qualification(stage),
  };
}

function standingRows(payload){
  const source=Array.isArray(payload?.standings)?payload.standings:Array.isArray(payload?.groups)?payload.groups.flatMap(group=>group?.standings||group?.rows||[]):rows(payload);
  return source.map((row,index)=>{
    const rawTeam=row?.team||{};const id=rawTeam?.id??row?.team_id??row?.teamId??'';const gf=number(row?.goals_for??row?.goalsFor??row?.gf)??0,ga=number(row?.goals_against??row?.goalsAgainst??row?.ga)??0;
    return{
      position:number(row?.position??row?.rank)??index+1,
      team:{id,name:text(rawTeam?.name||row?.team_name||row?.teamName),crestUrl:text(rawTeam?.logo||rawTeam?.crest_url)||logo(id)},
      played:number(row?.played??row?.matches_played??row?.mp),wins:number(row?.wins??row?.won??row?.w),draws:number(row?.draws??row?.drawn??row?.d),losses:number(row?.losses??row?.lost??row?.l),
      goalsFor:gf,goalsAgainst:ga,goalDifference:number(row?.goal_difference??row?.goalDifference??row?.gd)??gf-ga,points:number(row?.points??row?.pts),
    };
  }).sort((a,b)=>(a.position??999)-(b.position??999));
}

export function createBsdModularProvider({apiKey,fetchImpl=globalThis.fetch}={}){
  if(typeof fetchImpl!=='function')throw new Error('fetch_unavailable');
  return Object.freeze({
    async loadMatches({competition,from,to}){
      const {league,season}=await competitionMeta(fetchImpl,apiKey,competition);
      const italianIds=EUROPEAN.has(competition)?await italianTeamIds(fetchImpl,apiKey):new Set();
      const events=await all(fetchImpl,apiKey,'/events/',{league_id:league.id,season_id:season.id,date_from:from,date_to:to});
      return events.map(event=>normalizeEvent(event,competition,italianIds)).filter(Boolean).sort((a,b)=>Date.parse(a.kickoffAt||0)-Date.parse(b.kickoffAt||0));
    },
    async loadStandings({competition}){
      const {league,season}=await competitionMeta(fetchImpl,apiKey,competition);
      const payload=await getJson(fetchImpl,apiKey,`/leagues/${encodeURIComponent(league.id)}/standings/`,{season_id:season.id});
      return{rows:standingRows(payload),leagueId:league.id,seasonId:season.id};
    },
    async loadMatchCenter({competition,matchId,section='overview'}){
      if(!LEAGUE_ALIASES[competition])throw new Error(`invalid_external_competition:${competition}`);
      const source=text(matchId).replace(new RegExp(`^${competition}:`),'');if(!source)throw new Error('match_id_required');
      const path=SECTION_PATHS[section]?.(encodeURIComponent(source));if(!path)throw new Error(`invalid_match_center_section:${section}`);
      return await getJson(fetchImpl,apiKey,path);
    },
  });
}

export { BSD_BASE };
