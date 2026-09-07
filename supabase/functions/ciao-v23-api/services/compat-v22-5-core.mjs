const DEADLINE_MINUTES = 15;

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

export function createV22CompatCore({loaders} = {}) {
  const required = ['user','teams','rounds','round','standings','serieATable','stats','notifications','hasLive'];
  for (const key of required) {
    if (typeof loaders?.[key] !== 'function') throw new Error(`compat_loader_required:${key}`);
  }

  async function state({userId,tgUser,round} = {}) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) throw new Error('user_required');
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

    return {
      ok:true,
      user:{
        id:Number(user.id),
        telegram_id:Number(user.telegramId),
        display_name:String(user.displayName ?? ''),
        username:user.username || null,
        photo_url:tgUser?.photo_url ?? null,
        reminders:notifications?.deadline !== false,
        is_admin:user?.isAdmin === true,
        favorite_team_id:favorite ? Number(favorite.id) : null,
        favorite_team:favorite,
        notifications:{
          deadline:notifications?.deadline !== false,
          lineup:notifications?.lineup === true,
          kickoff:notifications?.kickoff === true,
          result:notifications?.result === true,
        },
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
      rules:{exact_score:5,correct_goal_difference:3,correct_outcome:2,miss:0,deadline_minutes:DEADLINE_MINUTES,bonus_multiplier:1,bonus_per_round:0,bonus_enabled:false},
      round_bonus:{match_id:null,selected_at:null,updated_at:null,locked:true,can_choose:false,can_move:false,available_match_ids:[],disabled:true,removed:true},
    };
  }

  return Object.freeze({state});
}
