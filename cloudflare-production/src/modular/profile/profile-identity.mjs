function text(value) {
  return String(value ?? '').trim();
}

function telegramNumericId(user = {}) {
  const id = Number(user?.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error('telegram_user_id_required');
  return id;
}

export function stableTelegramIdentity(user = {}) {
  return `telegram:${telegramNumericId(user)}`;
}

export function resolveTelegramDisplayName(user = {}, serverProfile = {}) {
  const firstName = text(user?.first_name);
  const lastName = text(user?.last_name);
  const username = text(user?.username).replace(/^@+/, '');
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  if (fullName) return fullName;
  if (username) return `@${username}`;
  const serverName = text(serverProfile?.display_name || serverProfile?.displayName);
  return serverName || 'Пользователь';
}

export function createProfileSnapshot(user = {}, serverProfile = {}) {
  const telegramId = telegramNumericId(user);
  return Object.freeze({
    userId: `telegram:${telegramId}`,
    telegramId,
    displayName: resolveTelegramDisplayName(user, serverProfile),
    firstName: text(user?.first_name),
    lastName: text(user?.last_name),
    username: text(user?.username).replace(/^@+/, ''),
  });
}

export function createServerProfilePatch(snapshot = {}) {
  const telegramId = Number(snapshot?.telegramId);
  if (!Number.isInteger(telegramId) || telegramId <= 0) throw new Error('telegram_user_id_required');
  return {
    telegram_id: telegramId,
    username: text(snapshot?.username) || null,
    display_name: text(snapshot?.displayName) || 'Пользователь',
  };
}

export async function reconcileProfileMetadata(snapshot, apiClient = {}) {
  if (typeof apiClient?.updateProfileMetadata !== 'function') return { ok:true, skipped:true };
  try {
    await apiClient.updateProfileMetadata(createServerProfilePatch(snapshot));
    return { ok:true };
  } catch (error) {
    return { ok:false, error:String(error?.message || error || 'profile_sync_failed') };
  }
}
