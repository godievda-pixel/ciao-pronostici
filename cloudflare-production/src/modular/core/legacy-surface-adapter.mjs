export const LEGACY_ROOT_SELECTOR = '#ciao-miniapp-root';

export const MIGRATED_NAV_LABELS = Object.freeze({
  'прогнозы':'predictions',
  'рейтинг':'ranking',
  'матчи':'matches',
  'таблицы':'tables',
  'серия а':'tables',
});

const MIGRATED_SCREENS = new Set(Object.values(MIGRATED_NAV_LABELS));
const CLICKABLE_SELECTOR = 'button,a,[role="button"],[data-screen],[data-view],[data-tab]';

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalized(value) {
  return text(value).toLocaleLowerCase('ru-RU');
}

function screenFromDataset(node) {
  for (const value of [node?.dataset?.screen, node?.dataset?.view, node?.dataset?.tab]) {
    const key = normalized(value).replace(/_/g, '-');
    if (MIGRATED_SCREENS.has(key)) return key;
    if (key === 'serie-a' || key === 'serie_a') return 'tables';
  }
  return '';
}

export function resolveLegacyScreen(target) {
  if (!target?.closest) return '';
  if (target.closest('[data-ciao-modular-host]')) return '';
  const node = target.closest(CLICKABLE_SELECTOR);
  if (!node) return '';
  const fromDataset = screenFromDataset(node);
  if (fromDataset) return fromDataset;
  const aria = node.getAttribute?.('aria-label');
  return MIGRATED_NAV_LABELS[normalized(aria || node.textContent)] || '';
}

export function createLegacySurfaceAdapter({
  documentRef = globalThis.document,
  onNavigate = () => {},
} = {}) {
  let root = null;
  let listener = null;
  let modularHost = null;
  let hiddenSnapshot = [];

  function content() {
    return root?.querySelector?.('.content') || root || null;
  }

  function ensureHost() {
    if (modularHost?.isConnected !== false) return modularHost;
    const parent = content();
    if (!parent || !documentRef?.createElement) return null;
    const existing = parent.querySelector?.('[data-ciao-modular-host]');
    if (existing) {
      modularHost = existing;
      return modularHost;
    }
    const host = documentRef.createElement('div');
    host.setAttribute?.('data-ciao-modular-host', 'main-v1');
    host.className = 'ciao-modular-host';
    host.hidden = true;
    parent.appendChild?.(host);
    modularHost = host;
    return modularHost;
  }

  function hideLegacyChildren(parent, host) {
    hiddenSnapshot = [];
    const children = Array.from(parent?.children || []);
    for (const child of children) {
      if (child === host) continue;
      hiddenSnapshot.push([child, !!child.hidden]);
      child.hidden = true;
    }
  }

  function restoreLegacyChildren() {
    for (const [child, wasHidden] of hiddenSnapshot) child.hidden = wasHidden;
    hiddenSnapshot = [];
  }

  return Object.freeze({
    start() {
      root = documentRef?.querySelector?.(LEGACY_ROOT_SELECTOR) || null;
      if (!root?.addEventListener) return false;
      if (listener) return true;
      listener = event => {
        const screen = resolveLegacyScreen(event?.target);
        if (!screen) return;
        event?.preventDefault?.();
        event?.stopImmediatePropagation?.();
        onNavigate(screen, event);
      };
      root.addEventListener('click', listener, true);
      return true;
    },
    stop() {
      if (root?.removeEventListener && listener) root.removeEventListener('click', listener, true);
      listener = null;
      if (modularHost) modularHost.hidden = true;
      restoreLegacyChildren();
      root = null;
    },
    showModular(html = '') {
      if (!root) root = documentRef?.querySelector?.(LEGACY_ROOT_SELECTOR) || null;
      const parent = content();
      const host = ensureHost();
      if (!parent || !host) return null;
      restoreLegacyChildren();
      hideLegacyChildren(parent, host);
      host.hidden = false;
      host.innerHTML = String(html ?? '');
      return host;
    },
    hideModular() {
      if (!modularHost) return false;
      modularHost.hidden = true;
      restoreLegacyChildren();
      return true;
    },
    host() { return modularHost; },
    root() { return root; },
  });
}
