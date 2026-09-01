import { getCompetitionConfig } from './competition-config.mjs';

function createClientError(code, status = 0, payload = null) {
  const error = new Error(code || 'v23_2_request_failed');
  error.code = code || 'v23_2_request_failed';
  error.status = status;
  error.payload = payload;
  return error;
}

export function resolveTelegramInitData(root = globalThis) {
  return String(root?.Telegram?.WebApp?.initData || '');
}

export async function loadCompetitionMatches(
  competition,
  {
    from = '',
    to = '',
    initData = resolveTelegramInitData(),
    fetchImpl = globalThis.fetch,
  } = {},
) {
  getCompetitionConfig(competition);

  if (!initData) {
    throw createClientError('telegram_auth_required');
  }
  if (typeof fetchImpl !== 'function') {
    throw createClientError('fetch_unavailable');
  }

  const query = new URLSearchParams({ competition });
  if (from) query.set('from', String(from));
  if (to) query.set('to', String(to));

  const response = await fetchImpl(
    `/api/v23.2/matches?${query.toString()}`,
    {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-telegram-init-data': initData,
      },
    },
  );

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw createClientError('invalid_api_json', response.status);
  }

  if (!response.ok || !payload?.ok) {
    throw createClientError(
      payload?.error || 'v23_2_request_failed',
      response.status,
      payload,
    );
  }

  return payload.data;
}
