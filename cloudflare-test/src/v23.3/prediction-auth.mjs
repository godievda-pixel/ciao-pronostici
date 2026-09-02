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
  ];
  return candidates.find(item => item && typeof item === 'object') || null;
}

function displayName(user = {}) {
  const explicit = text(user.display_name || user.name);
  if (explicit) return explicit;
  const composed = [text(user.first_name), text(user.last_name)].filter(Boolean).join(' ');
  return composed || 'Участник';
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
  const stableId = text(user?.id);
  if (!stableId) throw new PredictionAuthError('identity_resolution_failed', 502);

  return Object.freeze({
    userId: `telegram:${stableId}`,
    displayName: displayName(user),
    username: text(user?.username) || null,
  });
}
