export class PredictionAuthError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function text(value) {
  return String(value ?? '').trim();
}

function extractUser(payload = {}) {
  const candidates = [
    payload?.user,
    payload?.me,
    payload?.profile,
    payload?.state?.user,
    payload?.data?.user,
    payload?.data?.me,
    payload?.data?.profile,
    payload?.data?.state?.user,
  ];
  return candidates.find(item => item && typeof item === 'object') || null;
}

function extractStandings(payload = {}) {
  const candidates = [
    payload?.standings,
    payload?.state?.standings,
    payload?.data?.standings,
    payload?.data?.state?.standings,
  ];
  return candidates.find(Array.isArray) || [];
}

function displayName(user = {}) {
  const explicit = text(user.display_name || user.displayName || user.name);
  if (explicit) return explicit;
  const composed = [text(user.first_name), text(user.last_name)].filter(Boolean).join(' ');
  if (composed) return composed;
  const username = text(user.username);
  return username ? `@${username}` : 'Участник';
}

function stableUserId(user = {}) {
  const stableId = text(user.id ?? user.user_id ?? user.telegram_id ?? user.tg_id);
  return stableId ? `telegram:${stableId}` : null;
}

function participantRoster(payload = {}, currentUser = null) {
  const byId = new Map();

  for (const row of extractStandings(payload)) {
    if (!row || typeof row !== 'object') continue;
    const source = row.user && typeof row.user === 'object'
      ? { ...row, ...row.user }
      : row;
    const userId = stableUserId(source);
    if (!userId) continue;
    byId.set(userId, Object.freeze({
      userId,
      displayName: displayName(source),
      username: text(source.username) || null,
    }));
  }

  if (currentUser && typeof currentUser === 'object') {
    const userId = stableUserId(currentUser);
    if (userId) {
      const current = Object.freeze({
        userId,
        displayName: displayName(currentUser),
        username: text(currentUser.username) || null,
      });
      byId.delete(userId);
      return Object.freeze([current, ...byId.values()]);
    }
  }

  return Object.freeze([...byId.values()]);
}

export async function resolveAuthenticatedUser({ request, env } = {}) {
  const initData = text(request?.headers?.get?.('x-telegram-init-data'));
  if (!initData) throw new PredictionAuthError('telegram_auth_required', 401);
  if (!env?.CIAO_WEB_API || typeof env.CIAO_WEB_API.fetch !== 'function') {
    throw new PredictionAuthError('identity_resolution_failed', 502);
  }

  const upstreamRequest = new Request(
    new URL('/api/ciao-core-api-fast-v4', request.url),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-init-data': initData,
      },
      body: JSON.stringify({ action: 'state' }),
    },
  );

  const response = await env.CIAO_WEB_API.fetch(upstreamRequest);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new PredictionAuthError('identity_resolution_failed', 502);
  }

  if (response.status === 401 || response.status === 403) {
    throw new PredictionAuthError(text(payload?.error) || 'telegram_auth_rejected', response.status);
  }
  if (!response.ok || payload?.ok === false) {
    throw new PredictionAuthError('identity_resolution_failed', 502);
  }

  const user = extractUser(payload);
  const userId = stableUserId(user);
  if (!user || !userId) throw new PredictionAuthError('identity_resolution_failed', 502);

  const result = {
    userId,
    displayName: displayName(user),
    username: text(user?.username) || null,
  };
  const participants = participantRoster(payload, user);
  if (participants.length) result.participants = participants;

  return Object.freeze(result);
}
