import { isTopLevelScreen, normalizeRoute, routeState } from './navigation-state.mjs';

export function createRouter({
  history = globalThis.history,
  renderRoute,
  readScroll = () => globalThis.scrollY || 0,
  restoreScroll = value => globalThis.scrollTo?.(0, value),
  afterRender = callback => globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(callback) : queueMicrotask(callback),
  fallbackRoute = { screen:'home' },
} = {}) {
  if (typeof renderRoute !== 'function') throw new Error('render_route_required');
  const safeFallback = normalizeRoute(fallbackRoute) || normalizeRoute({ screen:'home' });
  let currentRoute = safeFallback;
  let lastValidTopLevel = isTopLevelScreen(currentRoute.screen) ? currentRoute : safeFallback;

  function render(target) {
    currentRoute = target;
    if (isTopLevelScreen(target.screen)) lastValidTopLevel = target;
    renderRoute(target);
    afterRender(() => restoreScroll(target.scrollY || 0));
    return target;
  }

  function callHistory(method, ...args) {
    try {
      const fn = history?.[method];
      if (typeof fn !== 'function') return false;
      fn.apply(history, args);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function writeHistory(target, replace) {
    const state = routeState(target);
    if (!state || !history) return false;
    if (replace) return callHistory('replaceState', state, '');
    return callHistory('pushState', state, '');
  }

  function persistCurrentScroll() {
    const captured = normalizeRoute({ ...currentRoute, scrollY:readScroll() }) || currentRoute;
    currentRoute = captured;
    if (isTopLevelScreen(captured.screen)) lastValidTopLevel = captured;
    try {
      if (history?.length > 0) callHistory('replaceState', routeState(captured), '');
    } catch (_error) {
      // History is an enhancement only; navigation must remain usable in embedded WebViews.
    }
    return captured;
  }

  function commit(route, { replace = false, write = true } = {}) {
    const target = normalizeRoute(route) || lastValidTopLevel || safeFallback;
    if (write) writeHistory(target, replace);
    return render(target);
  }

  function fallback() {
    return lastValidTopLevel || safeFallback;
  }

  return Object.freeze({
    navigate(route, { replace = false } = {}) {
      if (!replace) persistCurrentScroll();
      return commit(route, { replace, write:true });
    },
    openMatchCenter({ competition, matchId }) {
      const origin = persistCurrentScroll();
      const target = normalizeRoute({
        screen:'match-center',
        tournament:competition,
        matchId,
        scrollY:0,
        origin,
      });
      if (!target?.matchId || !target?.tournament) return commit(fallback(), { replace:true, write:true });
      return commit(target, { replace:false, write:true });
    },
    back() {
      const origin = currentRoute?.origin && normalizeRoute(currentRoute.origin, { allowMatchCenter:false });
      let canGoBack = false;
      try { canGoBack = Number(history?.length) > 1; } catch (_error) { canGoBack = false; }
      if (canGoBack && callHistory('back')) return true;
      commit(origin || fallback(), { replace:true, write:true });
      return true;
    },
    handlePopState(event) {
      const candidate = normalizeRoute(event?.state?.ciaoRoute);
      if (!candidate) return commit(fallback(), { replace:true, write:true });
      return commit(candidate, { write:false });
    },
    current() { return currentRoute; },
    rememberScroll() { return persistCurrentScroll(); },
  });
}
