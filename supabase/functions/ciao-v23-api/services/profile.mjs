const text = value => String(value ?? '').trim();

function positiveInteger(value, error = 'user_required') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(error);
  return id;
}

function localizedChoices(providerTeams, localTeams) {
  const localByProvider = new Map(
    (Array.isArray(localTeams) ? localTeams : [])
      .map(team => [text(team?.providerTeamId), team])
      .filter(([id]) => id),
  );
  return (Array.isArray(providerTeams) ? providerTeams : []).flatMap(providerTeam => {
    const providerTeamId = text(providerTeam?.id);
    const local = localByProvider.get(providerTeamId);
    if (!local) return [];
    return [{
      id:Number(local.id),
      providerTeamId,
      nameRu:text(providerTeam?.nameRu),
      crestUrl:text(providerTeam?.crestUrl),
      countryCode:text(providerTeam?.countryCode) || 'IT',
    }];
  });
}

export function createProfileService({userRepository, matchService, predictionRepository, rankingService} = {}) {
  if (!userRepository) throw new Error('user_repository_required');
  if (!matchService) throw new Error('match_service_required');
  if (!predictionRepository) throw new Error('prediction_repository_required');
  if (!rankingService) throw new Error('ranking_service_required');

  async function syncTelegramProfile(tgUser) {
    if (!userRepository.syncTelegramProfile) throw new Error('profile_sync_unavailable');
    return await userRepository.syncTelegramProfile(tgUser);
  }

  async function getProfile(userId) {
    if (!userRepository.getProfile) throw new Error('profile_read_unavailable');
    return await userRepository.getProfile(positiveInteger(userId));
  }

  async function favoriteChoices() {
    if (!matchService.listFavoriteItalianTeams || !userRepository.listTeams) {
      throw new Error('favorite_choices_unavailable');
    }
    const localTeams = await userRepository.listTeams();
    const providerTeamIds = localTeams.map(team => text(team?.providerTeamId)).filter(Boolean);
    const providerTeams = await matchService.listFavoriteItalianTeams({providerTeamIds});
    return localizedChoices(providerTeams, localTeams);
  }

  async function getBootstrap({userId, tgUser} = {}) {
    const id = positiveInteger(userId);
    await syncTelegramProfile(tgUser);
    const [profile, stats, rank, choices] = await Promise.all([
      getProfile(id),
      predictionRepository.statsForUser ? predictionRepository.statsForUser(id) : {},
      rankingService.rankForUser ? rankingService.rankForUser({scope:'all',userId:id}) : null,
      favoriteChoices(),
    ]);
    if (Number(profile.telegramId) !== Number(tgUser?.id)) throw new Error('user_identity_mismatch');

    const favorite = profile.favoriteTeam
      ? choices.find(team => Number(team.id) === Number(profile.favoriteTeam.id)) ?? null
      : null;

    return {
      user:{
        id:profile.id,
        telegramId:profile.telegramId,
        displayName:profile.displayName,
        username:profile.username,
        photoUrl:text(tgUser?.photo_url),
      },
      stats:{
        points:Number(stats?.points) || 0,
        rank:Number(rank?.rank) || 0,
        exact:Number(stats?.exact) || 0,
        successful:Number(stats?.successful) || 0,
        calculated:Number(stats?.calculated) || 0,
      },
      favoriteTeam:favorite,
      favoriteChoices:choices,
      settings:profile.settings,
    };
  }

  async function setFavoriteTeam(userId, teamId) {
    const id = positiveInteger(userId);
    if (teamId === null || teamId === undefined) {
      if (!userRepository.setFavoriteTeam) throw new Error('favorite_update_unavailable');
      return await userRepository.setFavoriteTeam(id, null);
    }
    if (!userRepository.getTeam || !userRepository.setFavoriteTeam || !matchService.listFavoriteItalianTeams) {
      throw new Error('favorite_update_unavailable');
    }
    const localTeam = await userRepository.getTeam(teamId);
    const providerTeamId = text(localTeam?.providerTeamId);
    const eligible = await matchService.listFavoriteItalianTeams({providerTeamIds:[providerTeamId]});
    if (!eligible.some(team => text(team?.id) === providerTeamId)) throw new Error('favorite_team_not_eligible');
    return await userRepository.setFavoriteTeam(id, Number(localTeam.id));
  }

  async function updateNotificationSettings(userId, patch = {}) {
    const id = positiveInteger(userId);
    if (!userRepository.updateNotificationSettings) throw new Error('settings_update_unavailable');
    const allowed = ['deadlineReminders','lineupNotifications','kickoffNotifications','resultNotifications'];
    const safePatch = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(patch,key)) safePatch[key] = patch[key] === true;
    }
    return await userRepository.updateNotificationSettings(id, safePatch);
  }

  return Object.freeze({
    syncTelegramProfile,
    getProfile,
    getBootstrap,
    setFavoriteTeam,
    updateNotificationSettings,
  });
}
