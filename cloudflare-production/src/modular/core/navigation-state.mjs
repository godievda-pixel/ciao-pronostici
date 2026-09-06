export const SCREEN_IDS = Object.freeze([
  'home', 'favorite', 'calcio', 'predictions', 'ranking', 'matches', 'tables', 'match-center',
]);

const SCREEN_SET = new Set(SCREEN_IDS);
const TOP_LEVEL_SET = new Set(SCREEN_IDS.filter(id => id !== 'match-center'));

function text(value) { return String(value ?? '').trim(); }
function number(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : 0; }

export function isValidScreen(screen) {
  return SCREEN_SET.has(text(screen));
}

export function isTopLevelScreen(screen) {
  return TOP_LEVEL_SET.has(text(screen));
}

export function normalizeRoute(route, { allowMatchCenter = true } = {}) {
  if (!route || !isValidScreen(route.screen)) return null;
  const screen = text(route.screen);
  if (!allowMatchCenter && screen === 'match-center') return null;
  const origin = route.origin ? normalizeRoute(route.origin, { allowMatchCenter:false }) : null;
  return Object.freeze({
    screen,
    subview: text(route.subview),
    tournament: text(route.tournament || route.competition),
    matchId: text(route.matchId || route.match_id),
    scrollY: number(route.scrollY),
    origin,
  });
}

export function routeState(route) {
  const normalized = normalizeRoute(route);
  return normalized ? { ciaoRoute:normalized } : null;
}
