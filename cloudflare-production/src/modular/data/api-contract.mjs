const PROJECT_ORIGIN = 'https://lcnwccnkkxaosxnfvjvr.supabase.co';
const FUNCTIONS = `${PROJECT_ORIGIN}/functions/v1`;
const V23_API = `${FUNCTIONS}/ciao-v23-api`;

export const CURRENT_API = Object.freeze({
  origin: PROJECT_ORIGIN,
  core: V23_API,
  matchCenter: V23_API,
  clubProfile: V23_API,
  live: V23_API,
  schedule: V23_API,
  predictionInsights: V23_API,
  competitions: Object.freeze(['serie_a','coppa_italia','ucl','uel','uecl']),
  capabilities: Object.freeze({
    serieA: true,
    predictions: true,
    rankings: true,
    matchCenter: true,
    favoriteClub: true,
    live: true,
    schedule: true,
  }),
  provider: Object.freeze({
    name: 'BSD Football API v2',
    base: 'https://sports.bzzoiro.com/api/v2',
    browserTokenAllowed: false,
    competitions: Object.freeze(['serie_a','coppa_italia','ucl','uel','uecl']),
  }),
});

function text(value) {
  return String(value ?? '').trim();
}

export function resolveTelegramInitData(root = globalThis) {
  return text(root?.Telegram?.WebApp?.initData);
}

export function normalizeApiError(error) {
  return {
    code: text(error?.code) || 'api_error',
    status: Number.isFinite(Number(error?.status)) ? Number(error.status) : 0,
    message: text(error?.message) || 'API request failed',
  };
}
