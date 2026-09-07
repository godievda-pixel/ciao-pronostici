const LOCK_MS=15*60*1000;

function positiveId(value,error='invalid_id'){
  const id=Number(value);
  if(!Number.isInteger(id)||id<=0)throw new Error(error);
  return id;
}

function score(value){
  const n=Number(value);
  if(!Number.isInteger(n)||n<0||n>20)throw new Error('invalid_score');
  return n;
}

function queryData(query){
  if(query?.error)throw query.error;
  return query?.data??[];
}

function openAt(match,nowMs){
  if(match?.is_finished===true)return false;
  const kickoff=Date.parse(String(match?.kickoff_at??''));
  return !Number.isFinite(kickoff)||Number(nowMs)<kickoff-LOCK_MS;
}

function teamOut(row){
  if(!row)return null;
  return {id:Number(row.id),name:String(row.name??''),short_name:row.short_name??null,custom_emoji_id:row.custom_emoji_id??null,bsd_team_id:row.bsd_team_id==null?null:Number(row.bsd_team_id)};
}

function notificationOut(row={}){
  return {
    deadline:row.deadline_reminders_enabled!==false,
    lineup:row.lineup_notifications_enabled===true,
    kickoff:row.kickoff_notifications_enabled===true,
    result:row.result_notifications_enabled===true,
  };
}

export function createV22CompatWriters({db,now=()=>Date.now()}={}){
  if(!db?.from)throw new Error('db_required');

  async function savePredictions({userId,round,predictions}={}){
    const uid=positiveId(userId,'user_required');
    const roundNumber=positiveId(round,'round_required');
    const rq=await db.from('cp_rounds').select('id,number').eq('number',roundNumber).maybeSingle();
    if(rq?.error)throw rq.error;
    if(!rq?.data)throw new Error('round_not_found');
    const mq=await db.from('cp_matches').select('id,kickoff_at,is_finished').eq('round_id',Number(rq.data.id));
    const matches=queryData(mq);
    const allowed=new Map(matches.map(row=>[Number(row.id),row]));
    const timestamp=Number(now());
    const rows=[];
    const closed=[];
    for(const item of Array.isArray(predictions)?predictions:[]){
      const matchId=positiveId(item?.match_id,'match_required');
      const match=allowed.get(matchId);
      if(!match)throw new Error(`match_not_in_round:${matchId}`);
      const home=score(item?.home_score),away=score(item?.away_score);
      if(!openAt(match,timestamp)){closed.push(matchId);continue;}
      rows.push({user_id:uid,match_id:matchId,home_score:home,away_score:away,points:null,base_points:null,updated_at:new Date(timestamp).toISOString()});
    }
    if(rows.length){
      const saved=await db.from('cp_predictions').upsert(rows,{onConflict:'user_id,match_id'});
      queryData(saved);
    }
    return {saved:rows.length,closed};
  }

  async function toggleReminders({userId,enabled}={}){
    const uid=positiveId(userId,'user_required');
    const value=enabled===true;
    const q=await db.from('cp_users').update({deadline_reminders_enabled:value,updated_at:new Date(Number(now())).toISOString()}).eq('id',uid).select('id').single();
    if(q?.error)throw q.error;
    if(!q?.data)throw new Error('user_not_found');
    return value;
  }

  async function setFavoriteTeam({userId,teamId}={}){
    const uid=positiveId(userId,'user_required');
    let team=null;
    if(teamId!==null&&teamId!==undefined){
      const tid=positiveId(teamId,'team_not_found');
      const tq=await db.from('cp_teams').select('id,name,short_name,custom_emoji_id,bsd_team_id').eq('id',tid).maybeSingle();
      if(tq?.error)throw tq.error;
      if(!tq?.data)throw new Error('team_not_found');
      team=teamOut(tq.data);
      if(team.bsd_team_id==null)throw new Error('favorite_team_not_eligible');
    }
    const q=await db.from('cp_users').update({favorite_team_id:team?team.id:null,updated_at:new Date(Number(now())).toISOString()}).eq('id',uid).select('id').single();
    if(q?.error)throw q.error;
    if(!q?.data)throw new Error('user_not_found');
    return team;
  }

  async function setNotificationPreferences({userId,preferences={}}={}){
    const uid=positiveId(userId,'user_required');
    const mapping={deadline:'deadline_reminders_enabled',lineup:'lineup_notifications_enabled',kickoff:'kickoff_notifications_enabled',result:'result_notifications_enabled'};
    const patch={};
    for(const [key,column] of Object.entries(mapping))if(Object.hasOwn(preferences,key))patch[column]=preferences[key]===true;
    const select='id,deadline_reminders_enabled,lineup_notifications_enabled,kickoff_notifications_enabled,result_notifications_enabled';
    if(Object.keys(patch).length){
      patch.updated_at=new Date(Number(now())).toISOString();
      const q=await db.from('cp_users').update(patch).eq('id',uid).select(select).single();
      if(q?.error)throw q.error;
      if(!q?.data)throw new Error('user_not_found');
      return notificationOut(q.data);
    }
    const q=await db.from('cp_users').select(select).eq('id',uid).maybeSingle();
    if(q?.error)throw q.error;
    if(!q?.data)throw new Error('user_not_found');
    return notificationOut(q.data);
  }

  async function clientEvent(){return true;}

  return Object.freeze({savePredictions,toggleReminders,setFavoriteTeam,setNotificationPreferences,clientEvent});
}
