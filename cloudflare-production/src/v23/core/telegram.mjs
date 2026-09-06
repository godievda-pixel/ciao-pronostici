const zeroSafeArea = () => ({ top:0, right:0, bottom:0, left:0 });

function insetValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function callSafely(target, method, ...args) {
  try {
    if (typeof target?.[method] === 'function') {
      target[method](...args);
      return true;
    }
  } catch {}
  return false;
}

export function createTelegramBridge(windowRef = globalThis.window ?? {}) {
  const webApp = windowRef?.Telegram?.WebApp ?? null;
  const backButton = webApp?.BackButton ?? null;
  const activeBackHandlers = new Map();

  function initData() {
    return typeof webApp?.initData === 'string' ? webApp.initData : '';
  }

  function user() {
    const value = webApp?.initDataUnsafe?.user;
    return value && typeof value === 'object' ? value : null;
  }

  function ready() {
    callSafely(webApp, 'ready');
  }

  function expand() {
    callSafely(webApp, 'expand');
  }

  function setBackVisible(visible) {
    callSafely(backButton, visible ? 'show' : 'hide');
  }

  function onBack(handler) {
    if (typeof handler !== 'function' || !backButton || typeof backButton.onClick !== 'function') {
      return () => {};
    }

    const existing = activeBackHandlers.get(handler);
    if (existing) return existing.unsubscribe;

    let removed = false;
    const wrapped = () => handler();
    try {
      backButton.onClick(wrapped);
    } catch {
      return () => {};
    }

    const unsubscribe = () => {
      if (removed) return;
      removed = true;
      activeBackHandlers.delete(handler);
      callSafely(backButton, 'offClick', wrapped);
    };

    activeBackHandlers.set(handler, { wrapped, unsubscribe });
    return unsubscribe;
  }

  function safeArea() {
    const source = webApp?.contentSafeAreaInset ?? webApp?.safeAreaInset;
    if (!source || typeof source !== 'object') return zeroSafeArea();
    return {
      top:insetValue(source.top),
      right:insetValue(source.right),
      bottom:insetValue(source.bottom),
      left:insetValue(source.left),
    };
  }

  return Object.freeze({
    initData,
    user,
    ready,
    expand,
    setBackVisible,
    onBack,
    safeArea,
  });
}
