import { rankingCompetitionIds } from '../domain/competitions.mjs';

const text = value => String(value ?? '').trim();

function displayName(user = {}) {
  const stored = text(user.display_name);
  if (stored) return stored;
  const username = text(user.username).replace(/^@/,'');
  return username ? `@${username}` : 'Участник';
}

function userId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error('user_required');
  return id;
}

export function createRankingService({db, predictionRepository} = {}) {
  if (!db?.from) throw new Error('db_required');
  if (!predictionRepository?.pointsForCompetitions) throw new Error('prediction_repository_required');

  async function load({scope = 'all', currentUserId = null} = {}) {
    const competitions = rankingCompetitionIds(scope);
    const [usersQuery, points] = await Promise.all([
      db.from('cp_users')
        .select('id,display_name,username,is_active,favorite_team:cp_teams!cp_users_favorite_team_fk(id,bsd_team_id)')
        .eq('is_active', true),
      predictionRepository.pointsForCompetitions(competitions),
    ]);
    if (usersQuery?.error) throw usersQuery.error;

    const totals = new Map();
    for (const row of Array.isArray(points) ? points : []) {
      if (!competitions.includes(text(row?.competition))) continue;
      const id = Number(row?.userId);
      if (!Number.isInteger(id)) continue;
      totals.set(id, (totals.get(id) ?? 0) + (Number(row?.points) || 0));
    }

    const current = Number(currentUserId);
    const rows = (Array.isArray(usersQuery?.data) ? usersQuery.data : [])
      .map(user => ({
        userId:Number(user.id),
        displayName:displayName(user),
        username:text(user.username),
        favoriteTeam:user.favorite_team ?? null,
        points:totals.get(Number(user.id)) ?? 0,
        isCurrent:Number.isInteger(current) && Number(user.id) === current,
      }))
      .sort((a,b) => b.points - a.points || a.displayName.localeCompare(b.displayName, 'ru'))
      .map((row,index) => ({...row, rank:index + 1}));

    return {rows};
  }

  async function rankForUser({scope = 'all', userId:requestedUserId} = {}) {
    const id = userId(requestedUserId);
    const result = await load({scope,currentUserId:id});
    return result.rows.find(row => row.userId === id) ?? null;
  }

  return Object.freeze({load, rankForUser});
}
