const LOCK_MS = 15 * 60 * 1000;

function data(query) {
  if (query?.error) throw query.error;
  return query?.data ?? [];
}

function compactTeam(row) {
  if (!row) return null;
  return {
    id:Number(row.id),
    name:String(row.name ?? ''),
    short_name:row.short_name ?? null,
    custom_emoji_id:row.custom_emoji_id ?? null,
    bsd_team_id:row.bsd_team_id == null ? null : Number(row.bsd_team_id),
  };
}

function deadlineAt(kickoffAt) {
  if (!kickoffAt) return null;
  const ms = Date.parse(kickoffAt);
  return Number.isFinite(ms) ? new Date(ms - LOCK_MS).toISOString() : null;
}

function isOpen(match, nowMs = Date.now()) {
  if (match?.is_finished) return false;
  const deadline = deadlineAt(match?.kickoff_at);
  return !deadline || nowMs < Date.parse(deadline);
}

export function createV22CompatLoaders({db,matchService,now = () => Date.now()} = {}) {
  if (!db?.from) throw new Error('db_required');
  if (!matchService?.getStandings) throw new Error('match_service_required');

  async function user(userId) {
    const q = await db.from('cp_users')
      .select('id,telegram_id,display_name,username,is_admin,favorite_team_id,deadline_reminders_enabled,lineup_notifications_enabled,kickoff_notifications_enabled,result_notifications_enabled')
      .eq('id', Number(userId)).maybeSingle();
    if (q.error) throw q.error;
    if (!q.data) throw new Error('user_not_found');
    return {
      id:Number(q.data.id), telegramId:Number(q.data.telegram_id), displayName:String(q.data.display_name ?? ''),
      username:q.data.username ?? null, isAdmin:q.data.is_admin === true,
      favoriteTeamId:q.data.favorite_team_id == null ? null : Number(q.data.favorite_team_id),
      settings:{deadlineReminders:q.data.deadline_reminders_enabled !== false},
    };
  }

  async function teams() {
    const q = await db.from('cp_teams').select('id,name,short_name,custom_emoji_id,bsd_team_id').order('name');
    return data(q).map(compactTeam);
  }

  async function rounds() {
    const [rq,mq] = await Promise.all([
      db.from('cp_rounds').select('id,number,nominal_date').order('number'),
      db.from('cp_matches').select('round_id,is_finished'),
    ]);
    const rows = data(rq), matches = data(mq), counts = new Map();
    for (const match of matches) {
      const id = Number(match.round_id), current = counts.get(id) ?? {total:0,finished:0};
      current.total += 1;
      if (match.is_finished) current.finished += 1;
      counts.set(id,current);
    }
    let canOpen = true;
    return rows.map(row => {
      const count = counts.get(Number(row.id)) ?? {total:0,finished:0};
      const result = {
        id:Number(row.id), number:Number(row.number), nominal_date:row.nominal_date,
        unlocked:canOpen, complete:count.total > 0 && count.finished === count.total,
        total:count.total, finished:count.finished,
      };
      canOpen = canOpen && result.complete;
      return result;
    });
  }

  async function round(roundNumber,userId) {
    const rq = await db.from('cp_rounds').select('id,number,nominal_date').eq('number',Number(roundNumber)).maybeSingle();
    if (rq.error) throw rq.error;
    if (!rq.data) throw new Error('round_not_found');
    const mq = await db.from('cp_matches')
      .select('id,round_id,kickoff_at,schedule_status,home_score,away_score,is_finished,live_status,live_elapsed,live_phase,live_updated_at,result_source,home:cp_teams!cp_matches_home_team_fk(id,name,short_name,custom_emoji_id,bsd_team_id),away:cp_teams!cp_matches_away_team_fk(id,name,short_name,custom_emoji_id,bsd_team_id)')
      .eq('round_id',Number(rq.data.id)).order('kickoff_at',{ascending:true,nullsFirst:false}).order('id');
    const matches = data(mq);
    const ids = matches.map(row => Number(row.id));
    let predictions = [];
    if (ids.length) {
      const pq = await db.from('cp_predictions').select('match_id,home_score,away_score,points').eq('user_id',Number(userId)).in('match_id',ids);
      predictions = data(pq);
    }
    const byMatch = new Map(predictions.map(row => [Number(row.match_id),row]));
    const nowMs = Number(now());
    return {
      round:{id:Number(rq.data.id),number:Number(rq.data.number),nominal_date:rq.data.nominal_date},
      matches:matches.map(match => ({
        ...match,
        id:Number(match.id),
        home:compactTeam(match.home), away:compactTeam(match.away),
        open:isOpen(match,nowMs), deadline_at:deadlineAt(match.kickoff_at),
        prediction:byMatch.get(Number(match.id)) ?? null,
      })),
    };
  }

  async function standings() {
    const [uq,pq,tq] = await Promise.all([
      db.from('cp_users').select('id,display_name,username,favorite_team_id').eq('is_active',true),
      db.from('cp_predictions').select('user_id,points,base_points').not('points','is',null),
      db.from('cp_teams').select('id,name,short_name,custom_emoji_id,bsd_team_id'),
    ]);
    const users=data(uq), predictions=data(pq), teamMap=new Map(data(tq).map(row=>[Number(row.id),compactTeam(row)]));
    const points=new Map(), exact=new Map();
    for (const p of predictions) {
      const id=Number(p.user_id); points.set(id,(points.get(id)??0)+Number(p.points??0));
      if (Number(p.base_points)===5 || Number(p.points)===5) exact.set(id,(exact.get(id)??0)+1);
    }
    const rows=users.map(u=>({
      id:Number(u.id), display_name:String(u.display_name || u.username || 'Участник'),
      favorite_team_id:u.favorite_team_id==null?null:Number(u.favorite_team_id),
      favorite_team:teamMap.get(Number(u.favorite_team_id)) ?? null,
      points:points.get(Number(u.id))??0, exact:exact.get(Number(u.id))??0,
    })).sort((a,b)=>b.points-a.points||b.exact-a.exact||a.display_name.localeCompare(b.display_name,'ru'));
    rows.forEach((row,index)=>{row.rank=index+1;});
    return rows;
  }

  async function stats(userId) {
    const [pq,rulesQ,rankRows] = await Promise.all([
      db.from('cp_predictions').select('points,base_points').eq('user_id',Number(userId)).not('points','is',null),
      db.from('cp_scoring_rules').select('exact_score').eq('id',1).maybeSingle(),
      standings(userId),
    ]);
    const rows=data(pq), exactScore=Number(rulesQ?.data?.exact_score ?? 5), rank=rankRows.find(row=>row.id===Number(userId))?.rank ?? rankRows.length+1;
    return {
      points:rows.reduce((sum,row)=>sum+Number(row.points??0),0),
      exact:rows.filter(row=>Number(row.base_points ?? row.points)===exactScore).length,
      successful:rows.filter(row=>Number(row.points)>0).length,
      calculated:rows.length, rank,
    };
  }

  async function notifications(userId) {
    const q=await db.from('cp_users').select('deadline_reminders_enabled,lineup_notifications_enabled,kickoff_notifications_enabled,result_notifications_enabled').eq('id',Number(userId)).maybeSingle();
    if(q.error)throw q.error;
    const row=q.data ?? {};
    return {deadline:row.deadline_reminders_enabled!==false,lineup:row.lineup_notifications_enabled===true,kickoff:row.kickoff_notifications_enabled===true,result:row.result_notifications_enabled===true};
  }

  async function hasLive() {
    const q=await db.from('cp_matches').select('id').eq('is_finished',false).eq('live_status','live').limit(1);
    return data(q).length>0;
  }

  async function serieATable() {
    const [provider,localTeams] = await Promise.all([matchService.getStandings({competition:'serie_a'}),teams()]);
    const localByProvider=new Map(localTeams.filter(team=>team.bsd_team_id!=null).map(team=>[String(team.bsd_team_id),team]));
    return {
      rows:(provider?.rows ?? []).map(row=>{
        const local=localByProvider.get(String(row?.team?.id));
        return {
          position:row.position, id:local?.id??null, team_id:local?.id??null, bsd_team_id:row?.team?.id??null,
          team_name:row?.team?.nameRu??row?.team?.name??'', short_name:local?.short_name??null, custom_emoji_id:local?.custom_emoji_id??null,
          played:row.played, won:row.wins, drawn:row.draws, lost:row.losses,
          goals_for:row.goalsFor, goals_against:row.goalsAgainst, goal_difference:row.goalDifference, points:row.points,
        };
      }),
      zones:[],updated_at:new Date().toISOString(),stale:false,refresh_ms:600000,
    };
  }

  return Object.freeze({user,teams,rounds,round,standings,serieATable,stats,notifications,hasLive});
}
