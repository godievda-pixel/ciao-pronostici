import { normalizeRoute, parseRoute, serializeRoute } from './route-codec.mjs';

const cloneRoute = route => ({ ...route });
const finiteScroll = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;

function stateRoute(value) {
  const candidate = value?.ciaoV23Route;
  return candidate && typeof candidate === 'object' ? normalizeRoute(candidate) : null;
}

export function createRouter({
  history = globalThis.history,
  location = globalThis.location,
  eventTarget = globalThis.window,
  render = () => {},
  readScroll = () => 0,
  restoreScroll = () => {},
  onBackAvailability = () => {},
} = {}) {
  if (typeof render !== 'function') throw new Error('router_render_required');

  let started = false;
  let stack = [];
  let expectedPopPath = null;
  const remembered = new Map();

  function notifyBack() {
    onBackAvailability(stack.length > 1);
  }

  function safeHistory(method, ...args) {
    try {
      const fn = history?.[method];
      if (typeof fn !== 'function') return false;
      fn.apply(history, args);
      return true;
    } catch {
      return false;
    }
  }

  function currentEntry() {
    return stack[stack.length - 1] ?? normalizeRoute({screen:'home'});
  }

  function captureCurrentScroll() {
    if (!stack.length) return;
    const current = currentEntry();
    current.scrollY = finiteScroll(readScroll());
    safeHistory('replaceState', { ciaoV23Route:cloneRoute(current) }, '', serializeRoute(current));
  }

  async function renderAndRestore(target) {
    await render(cloneRoute(target));
    restoreScroll(finiteScroll(target.scrollY));
  }

  function routeFromLocationOrState(event) {
    const fromState = stateRoute(event?.state);
    if (fromState) return fromState;
    return parseRoute(location?.pathname ?? '/home');
  }

  async function handlePopState(event) {
    const target = routeFromLocationOrState(event);
    const targetPath = serializeRoute(target);

    if (expectedPopPath) {
      const expected = expectedPopPath;
      expectedPopPath = null;
      if (targetPath === expected && serializeRoute(currentEntry()) === expected) {
        return;
      }
    }

    captureCurrentScroll();
    let found = -1;
    for (let index = stack.length - 2; index >= 0; index -= 1) {
      if (serializeRoute(stack[index]) === targetPath) {
        found = index;
        break;
      }
    }

    if (found >= 0) {
      stack = stack.slice(0, found + 1);
      const saved = stack[found];
      if (event?.state?.ciaoV23Route) saved.scrollY = finiteScroll(event.state.ciaoV23Route.scrollY);
    } else {
      stack.push(normalizeRoute(target));
    }

    await renderAndRestore(currentEntry());
    notifyBack();
  }

  async function start() {
    if (started) return cloneRoute(currentEntry());
    started = true;
    const initialFromState = stateRoute(history?.state);
    const initial = initialFromState ?? parseRoute(location?.pathname ?? '/home');
    stack = [normalizeRoute(initial)];
    safeHistory('replaceState', { ciaoV23Route:cloneRoute(currentEntry()) }, '', serializeRoute(currentEntry()));
    eventTarget?.addEventListener?.('popstate', handlePopState);
    await renderAndRestore(currentEntry());
    notifyBack();
    return cloneRoute(currentEntry());
  }

  async function navigate(next) {
    if (!started) await start();
    captureCurrentScroll();
    const target = normalizeRoute(next);
    stack.push(target);
    safeHistory('pushState', { ciaoV23Route:cloneRoute(target) }, '', serializeRoute(target));
    await renderAndRestore(target);
    notifyBack();
    return cloneRoute(target);
  }

  async function replace(next) {
    if (!started) await start();
    const target = normalizeRoute(next);
    if (stack.length) stack[stack.length - 1] = target;
    else stack = [target];
    safeHistory('replaceState', { ciaoV23Route:cloneRoute(target) }, '', serializeRoute(target));
    await renderAndRestore(target);
    notifyBack();
    return cloneRoute(target);
  }

  async function back() {
    if (!started) await start();
    if (stack.length <= 1) {
      notifyBack();
      return cloneRoute(currentEntry());
    }

    captureCurrentScroll();
    stack.pop();
    const target = currentEntry();
    expectedPopPath = serializeRoute(target);
    const browserBackStarted = safeHistory('back');
    if (!browserBackStarted) expectedPopPath = null;
    await renderAndRestore(target);
    notifyBack();
    return cloneRoute(target);
  }

  function current() {
    return cloneRoute(currentEntry());
  }

  function rememberSectionRoute(section, next) {
    const key = String(section ?? '').trim();
    if (!key) return;
    remembered.set(key, normalizeRoute(next));
  }

  function sectionRoute(section) {
    const saved = remembered.get(String(section ?? '').trim());
    return saved ? cloneRoute(saved) : null;
  }

  function destroy() {
    if (!started) return;
    eventTarget?.removeEventListener?.('popstate', handlePopState);
    started = false;
    expectedPopPath = null;
  }

  return Object.freeze({
    start,
    navigate,
    back,
    replace,
    current,
    rememberSectionRoute,
    sectionRoute,
    destroy,
  });
}
