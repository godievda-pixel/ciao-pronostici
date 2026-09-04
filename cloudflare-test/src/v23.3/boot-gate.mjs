export const BOOT_GATE_ID = 'ciao-v233-boot-gate';
export const BOOT_GATE_TIMEOUT_MS = 10_000;
export const HOME_SETTLED_EVENT = 'ciao-v233-home-settled';
export const RUNTIME_READY_EVENT = 'ciao-v233-ready';

function ensureGate(documentRef) {
  if (!documentRef?.createElement) return null;
  let gate = documentRef.getElementById?.(BOOT_GATE_ID);
  if (gate) return gate;
  gate = documentRef.createElement('div');
  gate.id = BOOT_GATE_ID;
  gate.setAttribute?.('role', 'status');
  gate.setAttribute?.('aria-label', 'Загрузка Ciao, Web!');
  gate.innerHTML = '<div class="cw238-boot-mark"><div class="cw238-boot-logo">Ciao, Web!</div><div class="cw238-boot-line" aria-hidden="true"></div></div>';
  (documentRef.body || documentRef.documentElement)?.prepend?.(gate);
  return gate;
}

export function createBootGate({
  documentRef = globalThis.document,
  rootRef = globalThis,
  timeoutMs = BOOT_GATE_TIMEOUT_MS,
  autoTimer = true,
} = {}) {
  let runtimeReady = false;
  let homeReady = false;
  let released = false;
  let releaseReason = '';
  let timer = null;
  const gate = ensureGate(documentRef);

  const state = () => Object.freeze({ runtimeReady, homeReady, released, releaseReason });

  const release = (reason = 'ready') => {
    if (released) return state();
    released = true;
    releaseReason = String(reason || 'ready');
    if (timer !== null) {
      (rootRef?.clearTimeout || globalThis.clearTimeout)?.(timer);
      timer = null;
    }
    if (gate) {
      gate.dataset.released = '1';
      gate.setAttribute?.('aria-hidden', 'true');
      const remove = () => gate.remove?.();
      (rootRef?.setTimeout || globalThis.setTimeout)?.(remove, 220);
    }
    return state();
  };

  const maybeRelease = () => {
    if (runtimeReady && homeReady) release('ready');
    return state();
  };

  const markRuntimeReady = () => {
    runtimeReady = true;
    return maybeRelease();
  };

  const markHomeReady = () => {
    homeReady = true;
    return maybeRelease();
  };

  const onRuntimeReady = () => markRuntimeReady();
  const onHomeReady = () => markHomeReady();
  rootRef?.addEventListener?.(RUNTIME_READY_EVENT, onRuntimeReady);
  rootRef?.addEventListener?.(HOME_SETTLED_EVENT, onHomeReady);

  if (autoTimer && Number(timeoutMs) >= 0 && typeof (rootRef?.setTimeout || globalThis.setTimeout) === 'function') {
    timer = (rootRef?.setTimeout || globalThis.setTimeout)(() => release('timeout'), Math.max(0, Number(timeoutMs) || 0));
  }

  return Object.freeze({
    markRuntimeReady,
    markHomeReady,
    release,
    state,
    disconnect() {
      if (timer !== null) {
        (rootRef?.clearTimeout || globalThis.clearTimeout)?.(timer);
        timer = null;
      }
      rootRef?.removeEventListener?.(RUNTIME_READY_EVENT, onRuntimeReady);
      rootRef?.removeEventListener?.(HOME_SETTLED_EVENT, onHomeReady);
    },
  });
}

let installed = null;

export function installBootGate(documentRef = globalThis.document, rootRef = globalThis) {
  if (installed) return installed;
  installed = createBootGate({ documentRef, rootRef });
  rootRef.CiaoV233BootGate = installed;
  return installed;
}

if (typeof document !== 'undefined') installBootGate(document, globalThis);
