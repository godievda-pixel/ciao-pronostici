const PROJECT_ORIGIN = 'https://dkefzepiiudehhzbbrjn.supabase.co';
const FUNCTIONS = `${PROJECT_ORIGIN}/functions/v1`;

export const CURRENT_API = Object.freeze({
  origin: PROJECT_ORIGIN,
  core: `${FUNCTIONS}/ciao-core-api-fast-v6`,
  matchCenter: `${FUNCTIONS}/ciao-match-center-fast-v3`,
  clubProfile: `${FUNCTIONS}/ciao-club-profile-fast`,
  live: `${FUNCTIONS}/ciao-live-snapshot-v1`,
  schedule: `${FUNCTIONS}/ciao-schedule-fast-v1`,
  predictionInsights: `${FUNCTIONS}/ciao-prediction-insights-v1`,
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
