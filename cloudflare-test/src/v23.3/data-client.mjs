import { getCompetitionConfig } from '../v23.2/competition-config.mjs';
import { resolveTelegramInitData } from '../v23.2/data-client.mjs';
import { createMatchCenterSectionCache } from './match-center-section-cache.mjs';

const STANDINGS_CACHE_TTL = 45_000;
const STANDINGS_CACHE = new Map();
const STANDINGS_INFLIGHT = new Map();
const MATCH_CENTER_CACHE = createMatchCenterSectionCache({ maxEntries:120 });
const MATCH_CENTER_SECTIONS = new Set(['overview', 'stats', 'events', 'lineups', 'players']);
const FETCH_IDS = new WeakMap();
let nextFetchId = 1;

function createClientError(code, status = 0, payload = null) {
  const error = new Error(code || 'v23_3_request_failed');
  error.code = code || 'v23_3_request_failed';
  error.status = status;
  error.payload = payload;
  return error;
}

function fetchIdentity(fetchImpl) {
  if (typeof fetchImpl !== 'function') return 'none';
  if (!FETCH_IDS.has(fetchImpl)) FETCH_IDS.set(fetchImpl, nextFetchId++);
  return FETCH_IDS.get(fetchImpl);
}

function requestCacheKey(path, initData, fetchImpl) {
  return `${fetchIdentity(fetchImpl)}\n${String(initData || '')}\n${path}`;
}

function matchCenterCacheKey(competition, matchId, section, initData, fetchImpl) {
  return `${fetchIdentity(fetchImpl)}\n${String(initData || '')}\n${competition}\n${matchId}\n${section}`;
}

function freshStanding(key, now = Date.now()) {
  const cached = STANDINGS_CACHE.get(key);
  if (!cached) return null;
  if (now - cached.at > STANDINGS_CACHE_TTL) {
    STANDINGS_CACHE.delete(key);
    return null;
  }
  return cached.value;
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
    force = false,
  } = {},
) {
  getCompetitionConfig(competition);
  const query = new URLSearchParams({ competition });
  const path = `/api/v23.3/standings?${query.toString()}`;
  if (!initData) throw createClientError('telegram_auth_required');
  const key = requestCacheKey(path, initData, fetchImpl);
  if (!force) {
    const cached = freshStanding(key);
    if (cached !== null) return cached;
  }
  const inflight = STANDINGS_INFLIGHT.get(key);
  if (inflight) return inflight;
  const pending = loadJson(path, { initData, fetchImpl }).then(value => {
    STANDINGS_CACHE.set(key, { at:Date.now(), value });
    return value;
  }).finally(() => {
    if (STANDINGS_INFLIGHT.get(key) === pending) STANDINGS_INFLIGHT.delete(key);
  });
  STANDINGS_INFLIGHT.set(key, pending);
  return pending;
}

async function loadMatchCenterResource(
  competition,
  matchId,
  section,
  {
    initData = resolveTelegramInitData(),
    fetchImpl = globalThis.fetch,
    force = false,
    status = null,
  } = {},
) {
  getCompetitionConfig(competition);
  const canonicalMatchId = String(matchId || '');
  const canonicalSection = String(section || 'base');
  if (!initData) throw createClientError('telegram_auth_required');

  const query = new URLSearchParams({
    competition,
    match_id: canonicalMatchId,
  });
  if (section) query.set('section', section);
  const path = `/api/v23.3/match-center?${query.toString()}`;
  const key = matchCenterCacheKey(
    competition,
    canonicalMatchId,
    canonicalSection,
    initData,
    fetchImpl,
  );

  if (!force) {
    const cached = MATCH_CENTER_CACHE.get(key);
    if (cached !== null) return cached;
  }

  const inflight = MATCH_CENTER_CACHE.getInflight(key);
  if (inflight) return inflight;

  const pending = loadJson(path, { initData, fetchImpl }).then(value => {
    const resolvedStatus = status || value?.match?.status || value?.status || null;
    MATCH_CENTER_CACHE.set(key, value, { status:resolvedStatus });
    return value;
  }).finally(() => {
    MATCH_CENTER_CACHE.forgetInflight(key, pending);
  });

  MATCH_CENTER_CACHE.rememberInflight(key, pending);
  return pending;
}

export async function loadMatchCenterBase(
  competition,
  matchId,
  options = {},
) {
  return loadMatchCenterResource(competition, matchId, null, options);
}

export async function loadMatchCenterSection(
  competition,
  matchId,
  section,
  options = {},
) {
  const canonicalSection = String(section || '').trim().toLowerCase();
  if (!MATCH_CENTER_SECTIONS.has(canonicalSection)) {
    throw createClientError('invalid_match_center_section');
  }
  return loadMatchCenterResource(competition, matchId, canonicalSection, options);
}

export async function loadMatchCenterSnapshot(
  competition,
  matchId,
  options = {},
) {
  return loadMatchCenterBase(competition, matchId, options);
}
