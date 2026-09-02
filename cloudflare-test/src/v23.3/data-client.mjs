import { getCompetitionConfig } from '../v23.2/competition-config.mjs';
import { resolveTelegramInitData } from '../v23.2/data-client.mjs';

function createClientError(code, status = 0, payload = null) {
  const error = new Error(code || 'v23_3_request_failed');
  error.code = code || 'v23_3_request_failed';
  error.status = status;
  error.payload = payload;
  return error;
}

async function loadJson(path, { initData, fetchImpl }) {
  if (!initData) {
    throw createClientError('telegram_auth_required');
  }
  if (typeof fetchImpl !== 'function') {
    throw createClientError('fetch_unavailable');
  }

  const response = await fetchImpl(path, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-telegram-init-data': initData,
    },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw createClientError('invalid_api_json', response.status);
  }

  if (!response.ok || !payload?.ok) {
    throw createClientError(
      payload?.error || 'v23_3_request_failed',
      response.status,
      payload,
    );
  }

  return payload.data;
}

export async function loadCompetitionStandings(
  competition,
  {
    initData = resolveTelegramInitData(),
    fetchImpl = globalThis.fetch,
  } = {},
) {
  getCompetitionConfig(competition);
  const query = new URLSearchParams({ competition });
  return loadJson(`/api/v23.3/standings?${query.toString()}`, { initData, fetchImpl });
}

export async function loadMatchCenterSnapshot(
  competition,
  matchId,
  {
    initData = resolveTelegramInitData(),
    fetchImpl = globalThis.fetch,
  } = {},
) {
  getCompetitionConfig(competition);
  const query = new URLSearchParams({
    competition,
    match_id: String(matchId || ''),
  });
  return loadJson(`/api/v23.3/match-center?${query.toString()}`, { initData, fetchImpl });
}
