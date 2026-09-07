const DEADLINE_MINUTES = 15;
const RULES = Object.freeze({
  exact_score:5,
  correct_goal_difference:3,
  correct_outcome:2,
  miss:0,
  deadline_minutes:DEADLINE_MINUTES,
  bonus_multiplier:1,
  bonus_per_round:0,
  bonus_enabled:false,
});

function positiveUserId(value) {
  const id=Number(value);
  if(!Number.isInteger(id)||id<=0)throw new Error('user_required');
  return id;
}

function latestUnlocked(rounds = []) {
  return [...rounds].reverse().find(row => row?.unlocked !== false)?.number ?? rounds?.[0]?.number ?? 1;
}

function selectRound(rounds = [], requested) {
  const fallback = latestUnlocked(rounds);
  const value = Number(requested);
  return rounds.some(row => Number(row?.number) === value && row?.unlocked !== false) ? value : fallback;
}

function favoriteTeamFor(user, teams) {
  const id = Number(user?.favoriteTeamId);
  if (!Number.isInteger(id)) return null;
  return teams.find(team => Number(team?.id) === id) ?? null;
}

function normalizedNotifications(value={}){
  return {
    deadline:value?.deadline!==false,
    lineup:value?.lineup===true,
    kickoff:value?.kickoff===true,
    result:value?.result===true,
  };
}

export function createV22CompatCore({loaders,writers={}} = {}) {
  const required = ['user','teams','rounds','round','standings','serieATable','stats','notifications','hasLive'];
  for (const key of required) {
    if (typeof loaders?.[key] !== 'function') throw new Error(`compat_loader_required:${key}`);
  }

  async function state({userId,tgUser,round} = {}) {
    const id = positiveUserId(userId);
    const [user, teams, rounds, standings, serieATable, stats, notifications, hasLive] = await Promise.all([
      loaders.user(id),
      loaders.teams(),
      loaders.rounds(),
      loaders.standings(id),
      loaders.serieATable(),
      loaders.stats(id),
      loaders.notifications(id),
      loaders.hasLive(),
    ]);
    if (Number(user?.telegramId) !== Number(tgUser?.id)) throw new Error('user_identity_mismatch');
    const selected = selectRound(rounds, round);
    const roundData = await loaders.round(selected, id);
    const favorite = favoriteTeamFor(user, teams);
    const notificationState=normalizedNotifications(notifications);

    return {
      ok:true,
      user:{
        id:Number(user.id),
        telegram_id:Number(user.telegramId),
        display_name:String(user.displayName ?? ''),
        username:user.username || null,
        photo_url:tgUser?.photo_url ?? null,
        reminders:notificationState.deadline,
        is_admin:user?.isAdmin === true,
        favorite_team_id:favorite ? Number(favorite.id) : null,
        favorite_team:favorite,
        notifications:notificationState,
      },
      teams,
      subscription:{required:true,channel:'@CiaoCalcio',verified:true},
      rounds,
      selected_round:selected,
      round:roundData,
      standings,
      standings_meta:{scope:'overall',updated_at:new Date().toISOString()},
      serie_a_table:serieATable,
      stats:{
        points:Number(stats?.points) || 0,
        exact:Number(stats?.exact) || 0,
        successful:Number(stats?.successful) || 0,
        calculated:Number(stats?.calculated) || 0,
        rank:Number(stats?.rank) || 0,
        trend:Number(stats?.trend) || 0,
      },
      deadline_minutes:DEADLINE_MINUTES,
      has_live:hasLive === true,
      polling:{live_ms:30000,idle_ms:180000,serie_a_live_ms:30000,serie_a_idle_ms:600000},
      server_time:new Date().toISOString(),
      rules:{...RULES},
      round_bonus:{match_id:null,selected_at:null,updated_at:null,locked:true,can_choose:false,can_move:false,available_match_ids:[],disabled:true,removed:true},
    };
  }

  async function serieATable(){
    return {ok:true,serie_a_table:await loaders.serieATable(),has_live:await loaders.hasLive(),polling:{live_ms:30000,idle_ms:600000},server_time:new Date().toISOString()};
  }

  async function savePredictions({userId,round,predictions}={}){
    const id=positiveUserId(userId);
    if(typeof writers.savePredictions!=='function')throw new Error('compat_writer_required:savePredictions');
    const result=await writers.savePredictions({userId:id,round:Number(round),predictions:Array.isArray(predictions)?predictions:[]});
    return {ok:true,saved:Number(result?.saved)||0,closed:Array.isArray(result?.closed)?result.closed:[],deadline_minutes:DEADLINE_MINUTES};
  }

  async function toggleReminders({userId,enabled}={}){
    const id=positiveUserId(userId);
    if(typeof writers.toggleReminders!=='function')throw new Error('compat_writer_required:toggleReminders');
    const value=await writers.toggleReminders({userId:id,enabled:enabled===true});
    return {ok:true,enabled:value===true};
  }

  async function setFavoriteTeam({userId,team_id}={}){
    const id=positiveUserId(userId);
    if(typeof writers.setFavoriteTeam!=='function')throw new Error('compat_writer_required:setFavoriteTeam');
    const teamId=team_id===null||team_id===undefined?null:Number(team_id);
    const team=await writers.setFavoriteTeam({userId:id,teamId});
    return {ok:true,favorite_team_id:team?Number(team.id):null,favorite_team:team??null};
  }

  async function standingsScope({userId,scope='overall',round,month,current_round}={}){
    const id=positiveUserId(userId);
    if(typeof loaders.standingsScope!=='function'){
      const rows=await loaders.standings(id);
      return {ok:true,standings:rows,standings_meta:{scope:'overall',updated_at:new Date().toISOString()}};
    }
    const result=await loaders.standingsScope({userId:id,scope:String(scope||'overall'),round:Number(round||current_round)||null,month:month||null});
    return {ok:true,standings:Array.isArray(result?.rows)?result.rows:[],standings_meta:result?.meta??{scope:String(scope||'overall')}};
  }

  async function publicPredictor({userId,user_id}={}){
    positiveUserId(userId);
    const predictorId=positiveUserId(user_id);
    if(typeof loaders.publicPredictor!=='function')throw new Error('compat_loader_required:publicPredictor');
    return {ok:true,predictor:await loaders.publicPredictor({predictorId})};
  }

  async function setNotificationPreferences({userId,preferences={}}={}){
    const id=positiveUserId(userId);
    if(typeof writers.setNotificationPreferences!=='function')throw new Error('compat_writer_required:setNotificationPreferences');
    const safe={};
    for(const key of ['deadline','lineup','kickoff','result'])if(Object.hasOwn(preferences,key))safe[key]=preferences[key]===true;
    return {ok:true,notifications:normalizedNotifications(await writers.setNotificationPreferences({userId:id,preferences:safe}))};
  }

  async function predictionRules({userId}={}){
    positiveUserId(userId);
    return {ok:true,rules:{...RULES}};
  }

  async function clientEvent({userId,event_type,screen,build,duration_ms,meta}={}){
    const id=positiveUserId(userId);
    if(typeof writers.clientEvent==='function')await writers.clientEvent({userId:id,eventType:String(event_type??''),screen:String(screen??''),build:String(build??''),durationMs:duration_ms==null?null:Number(duration_ms),meta:meta&&typeof meta==='object'?meta:{}});
    return {ok:true};
  }

  return Object.freeze({state,serieATable,savePredictions,toggleReminders,setFavoriteTeam,standingsScope,publicPredictor,setNotificationPreferences,predictionRules,clientEvent});
}
