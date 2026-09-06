const FUNCTIONS = 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1';

export const CURRENT_API = Object.freeze({
  functionsOrigin: FUNCTIONS,
  core: `${FUNCTIONS}/ciao-core-api-fast-v6`,
  matchCenter: `${FUNCTIONS}/ciao-match-center`,
  clubProfile: `${FUNCTIONS}/ciao-club-profile-fast`,
  clubCalendar: `${FUNCTIONS}/ciao-club-calendar-fast-v1`,
  schedule: `${FUNCTIONS}/ciao-schedule-fast-v1`,
  liveSnapshot: `${FUNCTIONS}/ciao-live-snapshot-v1`,
  predictionInsights: `${FUNCTIONS}/ciao-prediction-insights-v1`,
  competitions: Object.freeze(['serie_a','coppa_italia','ucl','uel','uecl']),
  capabilities: Object.freeze({
    serieA: true,
    predictions: true,
    rankings: true,
    matchCenter: true,
    favoriteClub: true,
  }),
  provider: Object.freeze({
    name: 'BSD Football v2',
    browserToken: false,
    policy: 'existing-provider-only',
  }),
});

export function resolveTelegramInitData(root = globalThis) {
  return String(root?.Telegram?.WebApp?.initData || '').trim();
}

export function normalizeApiError(error) {
  const status = Number(error?.status);
  return {
    code: String(error?.code || 'api_error'),
    status: Number.isFinite(status) && status > 0 ? status : 0,
    message: String(error?.message || 'API request failed'),
  };
}
