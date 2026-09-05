import { createMatchCenterRepository } from './match-center-repository.mjs';
import { createMatchCenterStore } from './match-center-store.mjs';
import { renderMatchCenterView } from './match-center-view.mjs';
import {
  currentMatchSource,
  suspendMatchSource,
  restoreMatchSource,
} from './match-center-lifecycle.mjs';

export const MATCH_CENTER_RUNTIME_BUILD = 'round43-canonical-match-center';
export const MATCH_CENTER_RUNTIME_ID = 'ciao-v239-match-center-overlay';
export const MATCH_CENTER_HOST_SCROLLBAR_STYLE_ID = 'ciao-v239-match-center-scrollbar-style';
export const MATCH_CENTER_HOST_SCROLLBAR_CSS = `#${MATCH_CENTER_RUNTIME_ID}{scrollbar-width:none;-ms-overflow-style:none}#${MATCH_CENTER_RUNTIME_ID}::-webkit-scrollbar{display:none;width:0;height:0}`;

let installedRuntime = null;

function text(value) {
  return String(value ?? '').trim();
}

function defaultSource() {
  return Object.freeze({
    surface:'home',
    competition:'',
    navTab:'predict',
    scrollTop:0,
    matchesOverlayScrollTop:0,
  });
}

function sourceOrDefault(source) {
  return source && typeof source === 'object' ? source : defaultSource();
}

function rootFor(documentRef) {
  return documentRef?.getElementById?.('ciao-miniapp-root') || documentRef?.body || null;
}

function ensureHostScrollbarStyle(documentRef) {
  if (!documentRef?.createElement || documentRef.getElementById?.(MATCH_CENTER_HOST_SCROLLBAR_STYLE_ID)) return null;
  const style = documentRef.createElement('style');
  style.id = MATCH_CENTER_HOST_SCROLLBAR_STYLE_ID;
  style.textContent = MATCH_CENTER_HOST_SCROLLBAR_CSS;
  (documentRef.head || rootFor(documentRef))?.appendChild?.(style);
  return style;
}

export function createBrowserMatchCenterHost(documentRef = globalThis.document) {
  if (!documentRef?.createElement) throw new Error('match_center_document_required');

  ensureHostScrollbarStyle(documentRef);
  let node = documentRef.getElementById?.(MATCH_CENTER_RUNTIME_ID) || null;
  if (!node) {
    node = documentRef.createElement('div');
    node.id = MATCH_CENTER_RUNTIME_ID;
    node.dataset.cw239Runtime = MATCH_CENTER_RUNTIME_BUILD;
    node.hidden = true;
    node.setAttribute?.('aria-hidden', 'true');
    Object.assign(node.style || {}, {
      position:'fixed',
      inset:'0',
      zIndex:'58',
      overflowY:'auto',
      overflowX:'hidden',
      overscrollBehavior:'contain',
      background:'#071626',
      scrollbarWidth:'none',
      msOverflowStyle:'none',
    });
    rootFor(documentRef)?.appendChild?.(node);
  } else {
    node.style.scrollbarWidth = 'none';
    node.style.msOverflowStyle = 'none';
  }

  let boundRuntime = null;
  const clickHandler = event => {
    if (!boundRuntime) return;

    const actionNode = event?.target?.closest?.('[data-cw239-action]');
    if (actionNode && node.contains?.(actionNode)) {
      const action = text(actionNode.dataset?.cw239Action);
      event.preventDefault?.();
      event.stopPropagation?.();
      if (action === 'back') boundRuntime.back();
      else if (action === 'retry-base') void boundRuntime.retryBase();
      else if (action === 'retry-section') {
        void boundRuntime.retrySection(text(actionNode.dataset?.cw239Section));
      }
      return;
    }

    const tabNode = event?.target?.closest?.('[data-cw239-tab]');
    if (!tabNode || !node.contains?.(tabNode) || tabNode.getAttribute?.('aria-disabled') === 'true') return;
    event.preventDefault?.();
    event.stopPropagation?.();
    void boundRuntime.selectTab(text(tabNode.dataset?.cw239Tab));
  };
  node.addEventListener?.('click', clickHandler);

  return Object.freeze({
    node,
    bind(runtime) { boundRuntime = runtime; },
    render(html) {
      const scrollTop = Number(node.scrollTop) || 0;
      node.innerHTML = String(html || '');
      node.hidden = false;
      node.removeAttribute?.('aria-hidden');
      node.style.display = 'block';
      node.scrollTop = scrollTop;
    },
    hide() {
      node.hidden = true;
      node.setAttribute?.('aria-hidden', 'true');
      node.style.display = 'none';
    },
    scrollToTop() { node.scrollTop = 0; },
    destroy() {
      boundRuntime = null;
      node.removeEventListener?.('click', clickHandler);
      node.remove?.();
    },
  });
}

export function createCanonicalMatchCenterRuntime({
  store,
  host,
  renderView = renderMatchCenterView,
  suspendSource = () => {},
  restoreSource = () => {},
  currentSource = () => defaultSource(),
} = {}) {
  if (!store || typeof store.open !== 'function' || typeof store.close !== 'function') {
    throw new Error('match_center_store_required');
  }
  if (!host || typeof host.render !== 'function' || typeof host.hide !== 'function') {
    throw new Error('match_center_host_required');
  }
  if (typeof renderView !== 'function') throw new Error('match_center_view_required');

  let source = null;
  let destroyed = false;

  const unsubscribe = store.subscribe?.(state => {
    if (destroyed) return;
    if (!state?.open || state?.phase === 'closed') {
      host.hide();
      return;
    }
    host.render(renderView(state));
  }) || (() => {});

  async function open(payload = {}) {
    if (destroyed) throw new Error('match_center_runtime_destroyed');
    const competition = text(payload.competition);
    const matchId = text(payload.matchId);
    if (!competition || !matchId) throw new Error('match_center_target_required');

    source = sourceOrDefault(payload.source || currentSource?.());
    suspendSource?.(source);
    host.scrollToTop?.();
    return store.open({
      competition,
      matchId,
      initialMatch:payload.initialMatch && typeof payload.initialMatch === 'object' ? payload.initialMatch : null,
    });
  }

  function back() {
    if (destroyed) return null;
    const restore = sourceOrDefault(source || currentSource?.());
    source = null;
    const result = store.close();
    host.hide();
    restoreSource?.(restore);
    return result;
  }

  function selectTab(tab) {
    return store.setActiveTab?.(tab);
  }

  function retryBase() {
    return store.retryBase?.();
  }

  function retrySection(tab) {
    return store.retrySection?.(text(tab) || undefined);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    source = null;
    unsubscribe?.();
    store.close?.();
    host.hide?.();
    host.destroy?.();
  }

  const runtime = Object.freeze({
    build:MATCH_CENTER_RUNTIME_BUILD,
    store,
    open,
    back,
    selectTab,
    retryBase,
    retrySection,
    destroy,
    currentSource:() => source,
  });
  host.bind?.(runtime);
  return runtime;
}

export function installCanonicalMatchCenterRuntime(documentRef = globalThis.document, rootRef = globalThis) {
  if (installedRuntime) return installedRuntime;
  if (!documentRef?.createElement) return null;

  const repository = createMatchCenterRepository();
  const store = createMatchCenterStore({ repository, documentRef });
  const host = createBrowserMatchCenterHost(documentRef);
  const runtime = createCanonicalMatchCenterRuntime({
    store,
    host,
    renderView:renderMatchCenterView,
    suspendSource:() => suspendMatchSource(documentRef),
    restoreSource:source => restoreMatchSource(documentRef, source),
    currentSource:() => currentMatchSource(),
  });

  installedRuntime = runtime;
  rootRef.CiaoV239MatchCenterRuntime = Object.freeze({
    build:MATCH_CENTER_RUNTIME_BUILD,
    open:runtime.open,
    back:runtime.back,
    selectTab:runtime.selectTab,
    retryBase:runtime.retryBase,
    retrySection:runtime.retrySection,
  });
  return installedRuntime;
}

export async function openCanonicalMatchCenter(payload = {}) {
  const runtime = installedRuntime || installCanonicalMatchCenterRuntime(globalThis.document, globalThis);
  if (!runtime) throw new Error('match_center_runtime_unavailable');
  return runtime.open(payload);
}
