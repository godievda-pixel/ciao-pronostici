export const NAVIGATION_LABELS = Object.freeze({
  predict:'Главная',
  mine:'Прогнозы',
  table:'Рейтинг',
  calendar:'Матчи',
  seriea:'Таблицы',
  profile:'Профиль',
});

const NAVIGATION_READY_EVENT = 'ciao-v233-navigation-ready';
const NAVIGATION_READY_SELECTORS = Object.freeze({
  predict:'#ciao-miniapp-root .content [data-cw233-home]',
  mine:'#ciao-miniapp-root .content .cw233-prediction-page',
  table:'#ciao-miniapp-root .content .cw233-ranking-page',
  profile:'#ciao-miniapp-root .content .stats-grid',
});

export function patchNavigation(documentRef = globalThis.document) {
  if (!documentRef?.querySelectorAll) return 0;
  let changed = 0;
  for (const button of documentRef.querySelectorAll('button[data-tab]')) {
    const label = NAVIGATION_LABELS[button.dataset?.tab];
    if (!label) continue;
    const node = button.querySelector?.('.nav-label') || button.querySelector?.('span:last-child');
    if (node && node.textContent !== label) {
      node.textContent = label;
      changed += 1;
    }
    button.setAttribute?.('aria-label', label);
  }
  return changed;
}

export function navigationDestinationReady(documentRef, tab) {
  if (!documentRef || !tab) return false;
  if (tab === 'seriea') {
    const overlay = documentRef.getElementById?.('ciao-v233-tables-overlay');
    return Boolean(overlay && overlay.hidden !== true);
  }
  const selector = NAVIGATION_READY_SELECTORS[tab];
  return Boolean(selector && documentRef.querySelector?.(selector));
}

export function dispatchNavigationReady(documentRef, tab) {
  if (!documentRef?.dispatchEvent || !tab) return false;
  const detail = { tab };
  const view = documentRef.defaultView || globalThis;
  const CustomEventCtor = view?.CustomEvent || globalThis.CustomEvent;
  const event = typeof CustomEventCtor === 'function'
    ? new CustomEventCtor(NAVIGATION_READY_EVENT, { detail })
    : { type:NAVIGATION_READY_EVENT, detail };
  try {
    documentRef.dispatchEvent(event);
    return true;
  } catch {
    return false;
  }
}

function scheduleNavigationProbe(documentRef, tab, generation, currentGeneration, attempt = 0) {
  const run = () => {
    if (generation !== currentGeneration()) return;
    if (navigationDestinationReady(documentRef, tab)) {
      dispatchNavigationReady(documentRef, tab);
      return;
    }
    if (attempt >= 30) return;
    scheduleNavigationProbe(documentRef, tab, generation, currentGeneration, attempt + 1);
  };
  const view = documentRef?.defaultView || globalThis;
  if (attempt === 0 && typeof globalThis.queueMicrotask === 'function') {
    globalThis.queueMicrotask(run);
  } else if (typeof view?.requestAnimationFrame === 'function') {
    view.requestAnimationFrame(run);
  } else {
    (view?.setTimeout || globalThis.setTimeout)?.(run, 0);
  }
}

export function installNavigationUi(documentRef = globalThis.document) {
  if (!documentRef) return null;
  let navigationGeneration = 0;
  const apply = () => patchNavigation(documentRef);
  const onClick = event => {
    const nav = event.target?.closest?.('button[data-tab]');
    if (!nav) return;
    const tab = String(nav.dataset?.tab || '');
    const generation = ++navigationGeneration;
    if (!NAVIGATION_READY_SELECTORS[tab] && tab !== 'seriea') return;
    scheduleNavigationProbe(documentRef, tab, generation, () => navigationGeneration);
  };

  apply();
  documentRef.addEventListener?.('click', onClick, true);
  let observer = null;
  if (typeof MutationObserver === 'function') {
    observer = new MutationObserver(apply);
    observer.observe(documentRef.documentElement || documentRef.body, { childList:true, subtree:true });
  }
  return Object.freeze({
    disconnect() {
      navigationGeneration += 1;
      observer?.disconnect?.();
      documentRef.removeEventListener?.('click', onClick, true);
    },
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installNavigationUi(document), { once:true });
  } else {
    installNavigationUi(document);
  }
}
