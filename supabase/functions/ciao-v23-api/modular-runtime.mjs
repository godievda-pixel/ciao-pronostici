import {
  MODULAR_COMPETITIONS,
  isExternalPredictionCompetition,
  normalizeCanonicalMatchId,
  predictionDeadlineIso,
  rankingCompetitions,
} from './modular-domain.mjs';

const text = value => String(value ?? '').trim();
const number = value => { const n=Number(value); return Number.isFinite(n)?n:null; };
const score = value => { const n=Number(value); if(!Number.isInteger(n)||n<0||n>20)throw new Error('invalid_score'); return n; };
function errorOf(query){if(query?.error)throw query.error;return query?.data}
function team(value){if(!value)return null;return{id:value.id??null,name:text(value.name||value.short_name),crestUrl:text(value.crestUrl||value.crest_url||value.logo_url||value.logoUrl),aliases:Array.isArray(value.aliases)?value.aliases:[]}}
function dateOnly(value){const d=value instanceof Date?value:new Date(value);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):''}
function defaultRange(nowMs){return{from:dateOnly(nowMs-30*86400000),to:dateOnly(nowMs+330*86400000)}}
function sourceId(value,competition){const raw=text(value);return raw.startsWith(`${competition}:`)?raw.slice(competition.length+1):raw}
function titleForMatch(match){const home=text(match?.home?.name||match?.home_team?.name||match?.homeTeam?.name),away=text(match?.away?.name||match?.away_team?.name||match?.awayTeam?.name);return home&&away?`${home} — ${away}`:'Матч'}
function sectionEnvelope(section,payload,match=null){return{title:titleForMatch(match||payload?.match||payload),note:section==='overview'?text(payload?.status||payload?.detail?.status):'',data:payload}}

export function displayNameForUser(user={}){
  const username=text(user.username).replace(/^@/,'');
  return text(user.display_name)||(username?`@${username}`:'')||'Участник';
}

export function buildRankingRows({users=[],serieAPoints=[],externalPoints=[],scope='all',currentUserId=''}={}){
  const allowed=new Set(rankingCompetitions(scope)),byUser=new Map();
  for(const user of users){const id=text(user.id);if(!id)continue;byUser.set(id,{id:user.id,userId:user.id,displayName:displayNameForUser(user),display_name:displayNameForUser(user),username:text(user.username),favoriteTeam:team(user.favorite_team),favorite_team:team(user.favorite_team),points:0,isCurrent:id===text(currentUserId)});}
  if(allowed.has('serie_a'))for(const row of serieAPoints){const item=byUser.get(text(row.user_id));if(item)item.points+=Number(row.points)||0;}
  for(const row of externalPoints){if(!allowed.has(text(row.competition)))continue;const item=byUser.get(text(row.user_id));if(item)item.points+=Number(row.points)||0;}
  return [...byUser.values()].sort((a,b)=>b.points-a.points||a.displayName.localeCompare(b.displayName,'ru')).map((row,index)=>({...row,rank:index+1}));
}

export function normalizeSerieAMatch(row={}){
  const rawId=text(row.id||row.match_id);
  return{id:`serie_a:${rawId}`,sourceId:rawId,competition:'serie_a',kickoffAt:text(row.kickoff_at),status:text(row.live_status||(row.is_finished?'finished':'scheduled')).toLowerCase(),minute:number(row.live_elapsed),home:team(row.home)||{id:null,name:'',crestUrl:'',aliases:[]},away:team(row.away)||{id:null,name:'',crestUrl:'',aliases:[]},score:{home:number(row.home_score),away:number(row.away_score)},round:text(row?.round?.number??row.round_number),stage:'Serie A',isQualification:false};
}

export function enrichSavedPredictions({items=[],matches=[]}={}){
  const byId=new Map((Array.isArray(matches)?matches:[]).map(match=>[text(match?.id||match?.match_id),match]).filter(([id])=>id));
  return (Array.isArray(items)?items:[]).map(item=>{const match=byId.get(text(item?.match_id||item?.matchId));if(!match)return item;return{...item,title:titleForMatch(match),match,kickoff_at:text(match.kickoffAt||match.kickoff_at),round:text(match.round||match.round_number)}});
}

export function createModularRuntime({db,provider,now=()=>Date.now()}={}){
  if(!db?.from)throw new Error('db_required');
  if(!provider?.loadMatches||!provider?.loadStandings||!provider?.loadMatchCenter)throw new Error('provider_required');

  async function syncSerieAReferences(events=[]){
    if(!events.length)return[];
    const teamRows=[];const teamSeen=new Set();
    for(const event of events)for(const side of ['home','away']){const value=event?.[side],bsd=Number(value?.id);if(!Number.isFinite(bsd)||teamSeen.has(bsd))continue;teamSeen.add(bsd);teamRows.push({bsd_team_id:bsd,name:text(value?.name)||`Team ${bsd}`,short_name:text(value?.shortName||value?.name)||`Team ${bsd}`});}
    if(teamRows.length)errorOf(await db.from('cp_teams').upsert(teamRows,{onConflict:'bsd_team_id'}));
    const bsdIds=[...teamSeen];const teamsQ=bsdIds.length?await db.from('cp_teams').select('id,name,short_name,custom_emoji_id,bsd_team_id').in('bsd_team_id',bsdIds):{data:[],error:null};errorOf(teamsQ);
    const teams=new Map((teamsQ.data||[]).map(row=>[Number(row.bsd_team_id),row]));

    const roundRows=[];const roundSeen=new Set();
    for(const event of events){const round=Number(event?.round);if(!Number.isInteger(round)||round<=0||roundSeen.has(round))continue;roundSeen.add(round);roundRows.push({number:round,nominal_date:dateOnly(event.kickoffAt)||dateOnly(now())});}
    if(roundRows.length)errorOf(await db.from('cp_rounds').upsert(roundRows,{onConflict:'number'}));
    const roundNums=[...roundSeen];const roundsQ=roundNums.length?await db.from('cp_rounds').select('id,number,nominal_date').in('number',roundNums):{data:[],error:null};errorOf(roundsQ);
    const rounds=new Map((roundsQ.data||[]).map(row=>[Number(row.number),row]));

    const matchRows=[];
    for(const event of events){const bsd=Number(event?.sourceId),round=rounds.get(Number(event?.round)),home=teams.get(Number(event?.home?.id)),away=teams.get(Number(event?.away?.id));if(!Number.isFinite(bsd)||!round||!home||!away)continue;matchRows.push({bsd_event_id:bsd,round_id:round.id,home_team_id:home.id,away_team_id:away.id,kickoff_at:event.kickoffAt||null,schedule_status:'scheduled',home_score:event?.score?.home,away_score:event?.score?.away,is_finished:event.status==='finished',live_status:event.status==='live'?'live':event.status,live_elapsed:event.minute??null,live_updated_at:new Date(now()).toISOString(),result_source:'bsd',result_locked:event.status==='finished'});}
    if(matchRows.length)errorOf(await db.from('cp_matches').upsert(matchRows,{onConflict:'bsd_event_id'}));
    const eventIds=matchRows.map(row=>row.bsd_event_id);if(!eventIds.length)return[];
    const query=await db.from('cp_matches').select('id,kickoff_at,home_score,away_score,is_finished,live_status,live_elapsed,round:cp_rounds!cp_matches_round_fk(number),home:cp_teams!cp_matches_home_team_fk(id,name,short_name,custom_emoji_id),away:cp_teams!cp_matches_away_team_fk(id,name,short_name,custom_emoji_id)').in('bsd_event_id',eventIds).order('kickoff_at',{ascending:true,nullsFirst:false});
    return (errorOf(query)||[]).map(normalizeSerieAMatch);
  }

  async function serieAMatches({from='',to=''}={}){
    const events=await provider.loadMatches({competition:'serie_a',from,to});
    return await syncSerieAReferences(events);
  }

  async function loadMatches(payload={}){
    const range=defaultRange(now()),from=text(payload.from)||range.from,to=text(payload.to)||range.to;
    if(payload.competition==='serie_a')return{matches:await serieAMatches({from,to})};
    return{matches:await provider.loadMatches({competition:payload.competition,from,to})};
  }
  async function loadStandings(payload={}){return await provider.loadStandings({competition:payload.competition})}
  async function loadFavorite(_payload={},context={}){
    const direct=context?.state?.user?.favorite_team||context?.user?.favorite_team;if(direct)return team(direct);
    const userId=Number(context?.userId||context?.state?.user?.id||context?.user?.id);if(!userId)return null;
    const uq=await db.from('cp_users').select('favorite_team:cp_teams!cp_users_favorite_team_fk(id,name,short_name,custom_emoji_id)').eq('id',userId).maybeSingle();if(uq.error)return null;return team(uq.data?.favorite_team);
  }
  async function savedPredictionMaps(userId){
    const [legacyQ,externalQ]=await Promise.all([db.from('cp_predictions').select('match_id,home_score,away_score,points').eq('user_id',userId),db.from('cp_competition_predictions').select('match_id,competition,predicted_home,predicted_away,points,locked_at').eq('user_id',userId)]);if(legacyQ.error)throw legacyQ.error;if(externalQ.error)throw externalQ.error;
    return{legacy:new Map((legacyQ.data||[]).map(row=>[`serie_a:${row.match_id}`,row])),external:new Map((externalQ.data||[]).map(row=>[text(row.match_id),row]))};
  }
  async function allMatchesForPredictions(competition=''){
    const range=defaultRange(now()),ids=competition?[competition]:MODULAR_COMPETITIONS,settled=await Promise.allSettled(ids.map(id=>loadMatches({competition:id,...range}).then(value=>value.matches||[])));
    return settled.flatMap(result=>result.status==='fulfilled'?result.value:[]).sort((a,b)=>Date.parse(a.kickoffAt||0)-Date.parse(b.kickoffAt||0));
  }
  async function loadPredictions(payload={},context={}){
    const userId=Number(context.userId||context?.state?.user?.id||context?.user?.id);if(!userId)throw new Error('user_required');const maps=await savedPredictionMaps(userId);
    if(payload.mode==='mine'){
      const legacy=[...maps.legacy.entries()].map(([matchId,row])=>({competition:'serie_a',match_id:matchId,home_score:row.home_score,away_score:row.away_score,points:row.points}));
      const external=[...maps.external.values()].map(row=>({competition:row.competition,match_id:row.match_id,home_score:row.predicted_home,away_score:row.predicted_away,points:row.points,deadline_at:row.locked_at}));
      return{items:enrichSavedPredictions({items:[...legacy,...external],matches:await allMatchesForPredictions(payload.competition)})};
    }
    const matches=await allMatchesForPredictions(payload.competition),items=matches.filter(match=>!['finished','cancelled'].includes(text(match.status))&&Date.parse(predictionDeadlineIso(match.kickoffAt))>now()).map(match=>{const saved=match.competition==='serie_a'?maps.legacy.get(match.id):maps.external.get(match.id);return{id:match.id,match_id:match.id,competition:match.competition,title:titleForMatch(match),match,kickoff_at:match.kickoffAt,deadline_at:predictionDeadlineIso(match.kickoffAt),prediction:saved?{home_score:saved.home_score??saved.predicted_home,away_score:saved.away_score??saved.predicted_away}:null}});
    return{items,rules:{exact_score:5,correct_goal_difference:3,correct_outcome:2,miss:0,deadline_minutes:15}};
  }
  async function saveSerieAPredictions(payload={},context={}){
    const userId=Number(context.userId||context?.state?.user?.id||context?.user?.id);if(!userId)throw new Error('user_required');const items=Array.isArray(payload.predictions)?payload.predictions:[];if(!items.length)throw new Error('predictions_required');
    const ids=[...new Set(items.map(item=>Number(item.match_id??item.matchId)).filter(Number.isInteger))];const matchesQ=ids.length?await db.from('cp_matches').select('id,kickoff_at,is_finished').in('id',ids):{data:[],error:null};errorOf(matchesQ);const matches=new Map((matchesQ.data||[]).map(row=>[Number(row.id),row])),rows=[],closed=[];
    for(const item of items){const id=Number(item.match_id??item.matchId),match=matches.get(id);if(!match){closed.push(id);continue;}const deadline=match.kickoff_at?Date.parse(match.kickoff_at)-15*60*1000:NaN;if(match.is_finished||!Number.isFinite(deadline)||now()>=deadline){closed.push(id);continue;}rows.push({user_id:userId,match_id:id,home_score:score(item.home_score),away_score:score(item.away_score),points:null,base_points:null,updated_at:new Date(now()).toISOString()});}
    if(rows.length){const query=await db.from('cp_predictions').upsert(rows,{onConflict:'user_id,match_id'});if(query.error)throw query.error;}return{saved:rows.length,closed,deadline_minutes:15};
  }
  async function saveExternalPredictions(payload={},context={}){
    const competition=text(payload.competition).toLowerCase();if(!isExternalPredictionCompetition(competition))throw new Error(`invalid_external_competition:${competition}`);const userId=Number(context.userId||context?.state?.user?.id||context?.user?.id);if(!userId)throw new Error('user_required');const items=Array.isArray(payload.predictions)?payload.predictions:[];if(!items.length)throw new Error('predictions_required');const rows=[],closed=[];
    for(const item of items){const matchId=normalizeCanonicalMatchId(competition,item.match_id??item.matchId),detail=await provider.loadMatchCenter({competition,matchId,section:'overview'}),kickoff=text(detail?.event_date||detail?.kickoff_at||detail?.date||item.kickoff_at);if(!kickoff)throw new Error(`kickoff_missing:${matchId}`);const lockedAt=predictionDeadlineIso(kickoff);if(now()>=Date.parse(lockedAt)){closed.push(matchId);continue;}const season=text(detail?.season?.name||detail?.season?.year||detail?.season||payload.season)||String(new Date(kickoff).getUTCFullYear());rows.push({user_id:userId,match_id:matchId,competition,season,predicted_home:score(item.home_score??item.predicted_home),predicted_away:score(item.away_score??item.predicted_away),updated_at:new Date(now()).toISOString(),locked_at:lockedAt});}
    if(rows.length){const query=await db.from('cp_competition_predictions').upsert(rows,{onConflict:'user_id,match_id'});if(query.error)throw query.error;}return{saved:rows.length,closed,deadline_minutes:15};
  }
  async function loadRanking(payload={},context={}){
    const competitions=rankingCompetitions(payload.scope||'all'),[usersQ,legacyQ,externalQ]=await Promise.all([db.from('cp_users').select('id,display_name,username,favorite_team:cp_teams!cp_users_favorite_team_fk(id,name,short_name,custom_emoji_id)').eq('is_active',true),competitions.includes('serie_a')?db.from('cp_predictions').select('user_id,points').not('points','is',null):Promise.resolve({data:[],error:null}),competitions.some(id=>id!=='serie_a')?db.from('cp_competition_predictions').select('user_id,competition,points').in('competition',competitions.filter(id=>id!=='serie_a')).not('points','is',null):Promise.resolve({data:[],error:null})]);for(const query of [usersQ,legacyQ,externalQ])if(query.error)throw query.error;return{rows:buildRankingRows({users:usersQ.data||[],serieAPoints:legacyQ.data||[],externalPoints:externalQ.data||[],scope:payload.scope||'all',currentUserId:context.userId||context?.state?.user?.id})};
  }
  async function loadMatchCenter(payload={}){
    const competition=payload.competition,section=payload.section||'overview';if(competition!=='serie_a')return sectionEnvelope(section,await provider.loadMatchCenter({competition,matchId:payload.match_id,section}));
    const id=Number(sourceId(payload.match_id,'serie_a'));if(!Number.isInteger(id)||id<=0)throw new Error('invalid_match_id');const query=await db.from('cp_matches').select('id,bsd_event_id,kickoff_at,home_score,away_score,is_finished,live_status,home:cp_teams!cp_matches_home_team_fk(id,name,short_name),away:cp_teams!cp_matches_away_team_fk(id,name,short_name)').eq('id',id).maybeSingle();const match=errorOf(query);if(!match?.bsd_event_id)throw new Error('match_not_found');const data=await provider.loadMatchCenter({competition:'serie_a',matchId:`serie_a:${match.bsd_event_id}`,section});return sectionEnvelope(section,data,match);
  }
  return Object.freeze({loadMatches,loadStandings,loadFavorite,loadPredictions,saveSerieAPredictions,saveExternalPredictions,loadRanking,loadMatchCenter,syncSerieAReferences});
}
