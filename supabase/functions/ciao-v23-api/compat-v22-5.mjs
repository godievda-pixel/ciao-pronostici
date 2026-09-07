const CORE_ALIASES = new Set([
  'ciao-core-api-fast',
  'ciao-core-api-fast-v4',
  'ciao-core-api-fast-v5',
  'ciao-core-api-fast-v6',
]);

const STATIC_ROUTES = new Map([
  ['ciao-fast-api-v2', { kind:'live_updates', action:'live_updates' }],
  ['ciao-match-center-fast-v3', { kind:'match_center', action:'load' }],
  ['ciao-match-summary-fast-v2', { kind:'match_summary', action:'load' }],
  ['ciao-club-profile-fast', { kind:'club_profile', action:'load' }],
  ['ciao-club-calendar-fast-v1', { kind:'club_calendar', action:'load' }],
  ['ciao-live-snapshot-v1', { kind:'live_snapshot', action:'load' }],
  ['ciao-schedule-fast-v1', { kind:'schedule', action:'load' }],
  ['ciao-prediction-insights-v1', { kind:'prediction_insights', action:'load' }],
  ['ciao-miniapp-api', { kind:'diagnostic', action:'load' }],
]);

const text = value => String(value ?? '').trim();

export function legacyRouteFor(slugValue, payload = {}) {
  const slug = text(slugValue);
  if (CORE_ALIASES.has(slug)) {
    return { kind:'core', action:text(payload?.action) || 'state' };
  }
  const route = STATIC_ROUTES.get(slug);
  if (route) return { ...route };
  throw new Error(`unknown_legacy_endpoint:${slug || 'missing'}`);
}

export function legacySlugFromUrl(urlValue) {
  const url = urlValue instanceof URL ? urlValue : new URL(String(urlValue));
  const marker = '/functions/v1/ciao-v23-api/';
  const at = url.pathname.indexOf(marker);
  if (at < 0) return '';
  return decodeURIComponent(url.pathname.slice(at + marker.length).split('/')[0] || '');
}
