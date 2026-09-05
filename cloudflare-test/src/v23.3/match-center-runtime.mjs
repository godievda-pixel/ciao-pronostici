import { createMatchCenterRepository } from './match-center-repository.mjs';
import { createMatchCenterStore } from './match-center-store.mjs';
import { renderMatchCenterView } from './match-center-view.mjs';
import { enhanceRound502MatchCenterView } from './round50-2-match-center-view.mjs';
import {
  canonicalRound503ViewTab,
  providerTabForRound503View,
  enhanceRound503MatchCenterView,
} from './round50-3-match-center-view.mjs';
import {
  currentMatchSource,
  suspendMatchSource,
  restoreMatchSource,
} from './match-center-lifecycle.mjs';

export const MATCH_CENTER_RUNTIME_BUILD = 'round50-3-bottom-drawer-seamless-refresh';
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

function defaultViewState() {
  return {
    activeViewTab:'overview',
    selectedLineupTeam:'home',
    expandedLineupDisclosure:null,
    selectedShotIndex:null,
  };
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

function enhanceRound503Pipeline(html, state, viewState) {
  const round502 = enhanceRound502MatchCenterView(html, state, viewState);
  return enhanceRound503MatchCenterView(round502, state, viewState);
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

    const uiNode = event?.target?.closest?.('[data-cw502-action]');
    if (uiNode && node.contains?.(uiNode)) {
      const action = text(uiNode.dataset?.cw502Action);
      const value = action === 'lineup-team'
        ? text(uiNode.dataset?.cw502LineupTeam)
        : action === 'lineup-disclosure'
          ? text(uiNode.dataset?.cw502LineupDisclosure)
          : action === 'shot'
            ? text(uiNode.dataset?.cw502ShotAction)
            : '';
      event.preventDefault?.();
      event.stopPropagation?.();
      boundRuntime.uiAction?.(action, value);
      return;
    }

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

  const imageErrorHandler = event => {
    const image = event?.target;
    if (!image?.matches?.('img[data-cw502-crest-fallback]')) return;
    const fallback = documentRef.createElement('span');
    fallback.className = 'cw239-mc-crest cw502-mc-crest-fallback';
    fallback.dataset.cw502CrestSide = text(image.dataset?.cw502CrestSide);
    fallback.dataset.cw502CrestFallback = text(image.dataset?.cw502CrestFallback);
    fallback.setAttribute?.('aria-hidden', 'true');
    fallback.textContent = text(image.dataset?.cw502CrestFallback) || '—';
    image.replaceWith?.(fallback);
  };

  node.addEventListener?.('click', clickHandler);
  node.addEventListener?.('error', imageErrorHandler, true);

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
      node.removeEventListener?.('error', imageErrorHandler, true);
      node.remove?.();
    },
  });
}

export function createCanonicalMatchCenterRuntime({
  store,
  host,
  renderView = renderMatchCenterView,
  enhanceView = enhanceRound503Pipeline,
  suspendSource = () => {},
  restoreSource = () => {},
  currentSource = () => defaultSource(),
  legacySourceLifecycle = false,
} = {}) {
  if (!store || typeof store.open !== 'function' || typeof store.close !== 'function') {
    throw new Error('match_center_store_required');
  }
  if (!host || typeof host.render !== 'function' || typeof host.hide !== 'function') {
    throw new Error('match_center_host_required');
  }
  if (typeof renderView !== 'function') throw new Error('match_center_view_required');
  if (typeof enhanceView !== 'function') throw new Error('match_center_enhancer_required');

  let source = null;
  let restoreLegacySource = false;
  let destroyed = false;
  let lastState = null;
  let viewState = defaultViewState();

  function rendered(state) {
    return enhanceView(renderView(state, viewState), state, viewState);
  }

  function renderCurrent() {
    if (destroyed) return null;
    const state = store.getState?.() || lastState;
    if (!state?.open || state?.phase === 'closed') return null;
    lastState = state;
    host.render(rendered(state));
    return state;
  }

  const unsubscribe = store.subscribe?.(state => {
    if (destroyed) return;
    lastState = state;
    if (!state?.open || state?.phase === 'closed') {
      host.hide();
      return;
    }
    host.render(rendered(state));
  }) || (() => {});

  async function open(payload = {}) {
    if (destroyed) throw new Error('match_center_runtime_destroyed');
    const competition = text(payload.competition);
    const matchId = text(payload.matchId);
    if (!competition || !matchId) throw new Error('match_center_target_required');

    viewState = defaultViewState();
    source = sourceOrDefault(payload.source || currentSource?.());
    restoreLegacySource = legacySourceLifecycle === true || payload.legacySourceLifecycle === true;
    if (restoreLegacySource) suspendSource(source);
    host.scrollToTop?.();
    return store.open({
      competition,
      matchId,
      initialMatch:payload.initialMatch && typeof payload.initialMatch === 'object' ? payload.initialMatch : null,
    });
  }

  function back() {
    if (destroyed) return null;
    const sourceToRestore = restoreLegacySource ? source : null;
    source = null;
    restoreLegacySource = false;
    viewState = defaultViewState();
    const result = store.close();
    host.hide();
    if (sourceToRestore) restoreSource(sourceToRestore);
    return result;
  }

  function selectTab(tab) {
    if (destroyed) return null;
    const activeViewTab = canonicalRound503ViewTab(tab);
    const providerTab = providerTabForRound503View(activeViewTab);
    const currentState = store.getState?.() || lastState;
    const previousViewTab = viewState.activeViewTab;

    viewState = {
      ...viewState,
      activeViewTab,
      selectedShotIndex:activeViewTab === 'shots' ? viewState.selectedShotIndex : null,
      selectedLineupTeam:activeViewTab === 'lineups' ? viewState.selectedLineupTeam : 'home',
      expandedLineupDisclosure:activeViewTab === 'lineups' ? viewState.expandedLineupDisclosure : null,
    };

    if (currentState?.activeTab === providerTab) {
      if (previousViewTab !== activeViewTab) renderCurrent();
      return currentState;
    }
    return store.setActiveTab?.(providerTab);
  }

  function uiAction(action, value) {
    if (destroyed) return null;
    const state = store.getState?.() || lastState;
    if (!state?.open) return null;
    const key = text(action);

    if (key === 'lineup-team' && state.activeTab === 'lineups' && viewState.activeViewTab === 'lineups') {
      const side = value === 'away' ? 'away' : value === 'home' ? 'home' : null;
      if (!side) return null;
      viewState.selectedLineupTeam = side;
      viewState.expandedLineupDisclosure = null;
      return renderCurrent();
    }

    if (key === 'lineup-disclosure' && state.activeTab === 'lineups' && viewState.activeViewTab === 'lineups') {
      const disclosure = value === 'starters' || value === 'substitutes' ? value : null;
      if (!disclosure) return null;
      const selected = viewState.selectedLineupTeam === 'away' ? 'away' : 'home';
      const side = state?.sections?.lineups?.[selected];
      const rows = Array.isArray(side?.[disclosure]) ? side[disclosure] : [];
      if (!rows.length) return null;
      viewState.expandedLineupDisclosure = viewState.expandedLineupDisclosure === disclosure ? null : disclosure;
      return renderCurrent();
    }

    if (key === 'shot' && state.activeTab === 'stats' && viewState.activeViewTab === 'shots') {
      const index = Number(value);
      const shots = Array.isArray(state?.sections?.stats?.shots) ? state.sections.stats.shots : [];
      if (!Number.isInteger(index) || index < 0 || index >= shots.length) return null;
      viewState.selectedShotIndex = viewState.selectedShotIndex === index ? null : index;
      return renderCurrent();
    }
    return null;
  }

  function retryBase() {
    return store.retryBase?.();
  }

  function retrySection(tab) {
    const viewTab = text(tab);
    const providerTab = viewTab ? providerTabForRound503View(viewTab) : undefined;
    return store.retrySection?.(providerTab);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    source = null;
    restoreLegacySource = false;
    lastState = null;
    viewState = defaultViewState();
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
    uiAction,
    retryBase,
    retrySection,
    destroy,
    currentSource:() => source,
    currentViewState:() => Object.freeze({ ...viewState }),
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
    uiAction:runtime.uiAction,
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
