const text = value => String(value ?? '').trim();

const USER_SELECT = 'id,telegram_id,username,display_name,is_active,favorite_team_id,deadline_reminders_enabled,lineup_notifications_enabled,kickoff_notifications_enabled,result_notifications_enabled,favorite_team:cp_teams!cp_users_favorite_team_fk(id,bsd_team_id)';

function positiveInteger(value, error = 'user_required') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(error);
  return id;
}

function telegramDisplayName(tgUser = {}) {
  const name = [tgUser.first_name, tgUser.last_name].map(text).filter(Boolean).join(' ').trim();
  const username = text(tgUser.username).replace(/^@/, '');
  return name || username || text(tgUser.id);
}

function normalizedTeam(row) {
  if (!row) return null;
  return {
    id:Number(row.id),
    providerTeamId:text(row.bsd_team_id),
  };
}

function normalizedSettings(row = {}) {
  return {
    deadlineReminders:row.deadline_reminders_enabled !== false,
    lineupNotifications:row.lineup_notifications_enabled === true,
    kickoffNotifications:row.kickoff_notifications_enabled === true,
    resultNotifications:row.result_notifications_enabled === true,
  };
}

function normalizedProfile(row) {
  if (!row) return null;
  return {
    id:Number(row.id),
    telegramId:Number(row.telegram_id),
    username:text(row.username),
    displayName:text(row.display_name),
    isActive:row.is_active !== false,
    favoriteTeam:normalizedTeam(row.favorite_team),
    settings:normalizedSettings(row),
  };
}

function queryData(query) {
  if (query?.error) throw query.error;
  return query?.data;
}

export function createUserRepository({db} = {}) {
  if (!db?.from) throw new Error('db_required');

  async function getProfile(userId) {
    const id = positiveInteger(userId);
    const query = await db.from('cp_users').select(USER_SELECT).eq('id', id).maybeSingle();
    if (query?.error) throw query.error;
    if (!query?.data) throw new Error('user_not_found');
    return normalizedProfile(query.data);
  }

  async function syncTelegramProfile(tgUser = {}) {
    const telegramId = positiveInteger(tgUser.id, 'telegram_user_invalid');
    const username = text(tgUser.username).replace(/^@/, '') || null;
    const displayName = telegramDisplayName(tgUser);
    const existing = await db.from('cp_users').select(USER_SELECT).eq('telegram_id', telegramId).maybeSingle();
    if (existing?.error) throw existing.error;

    if (!existing?.data) {
      const inserted = await db.from('cp_users').insert({
        telegram_id:telegramId,
        username,
        display_name:displayName,
        is_active:true,
      }).select(USER_SELECT).single();
      if (inserted?.error) throw inserted.error;
      return normalizedProfile(inserted.data);
    }

    const current = existing.data;
    if ((current.username ?? null) !== username || text(current.display_name) !== displayName) {
      const updated = await db.from('cp_users').update({
        username,
        display_name:displayName,
        updated_at:new Date().toISOString(),
      }).eq('id', Number(current.id)).select(USER_SELECT).single();
      if (updated?.error) throw updated.error;
      return normalizedProfile(updated.data);
    }

    return normalizedProfile(current);
  }

  async function getTeam(teamId) {
    const id = positiveInteger(teamId, 'team_not_found');
    const query = await db.from('cp_teams').select('id,bsd_team_id').eq('id', id).maybeSingle();
    if (query?.error) throw query.error;
    if (!query?.data) throw new Error('team_not_found');
    return normalizedTeam(query.data);
  }

  async function listTeamsByProviderIds(providerTeamIds = []) {
    const values = [...new Set((Array.isArray(providerTeamIds) ? providerTeamIds : [])
      .map(value => Number(value))
      .filter(Number.isInteger))];
    if (!values.length) return [];
    const query = await db.from('cp_teams').select('id,bsd_team_id').in('bsd_team_id', values);
    const rows = queryData(query) ?? [];
    return rows.map(normalizedTeam).filter(Boolean);
  }

  async function setFavoriteTeam(userId, teamId) {
    const id = positiveInteger(userId);
    const favoriteTeamId = teamId === null || teamId === undefined ? null : positiveInteger(teamId, 'team_not_found');
    const query = await db.from('cp_users').update({
      favorite_team_id:favoriteTeamId,
      updated_at:new Date().toISOString(),
    }).eq('id', id).select(USER_SELECT).single();
    if (query?.error) throw query.error;
    if (!query?.data) throw new Error('user_not_found');
    return {favoriteTeamId, profile:normalizedProfile(query.data)};
  }

  async function updateNotificationSettings(userId, patch = {}) {
    const id = positiveInteger(userId);
    const mapping = {
      deadlineReminders:'deadline_reminders_enabled',
      lineupNotifications:'lineup_notifications_enabled',
      kickoffNotifications:'kickoff_notifications_enabled',
      resultNotifications:'result_notifications_enabled',
    };
    const dbPatch = {};
    for (const [key,column] of Object.entries(mapping)) {
      if (Object.prototype.hasOwnProperty.call(patch,key)) dbPatch[column] = patch[key] === true;
    }
    if (!Object.keys(dbPatch).length) return (await getProfile(id)).settings;
    dbPatch.updated_at = new Date().toISOString();
    const query = await db.from('cp_users').update(dbPatch).eq('id', id).select(USER_SELECT).single();
    if (query?.error) throw query.error;
    if (!query?.data) throw new Error('user_not_found');
    return normalizedSettings(query.data);
  }

  return Object.freeze({
    syncTelegramProfile,
    getProfile,
    getTeam,
    listTeamsByProviderIds,
    setFavoriteTeam,
    updateNotificationSettings,
  });
}
