export const NAVIGATION_LABELS = Object.freeze({
  predict:'Главная',
  mine:'Прогнозы',
  table:'Рейтинг',
  calendar:'Матчи',
  seriea:'Таблицы',
  profile:'Профиль',
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

export function installNavigationUi(documentRef = globalThis.document) {
  if (!documentRef) return null;
  const apply = () => patchNavigation(documentRef);
  apply();
  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(apply);
    observer.observe(documentRef.documentElement || documentRef.body, { childList:true, subtree:true });
    return observer;
  }
  return Object.freeze({ disconnect() {} });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installNavigationUi(document), { once:true });
  } else {
    installNavigationUi(document);
  }
}
