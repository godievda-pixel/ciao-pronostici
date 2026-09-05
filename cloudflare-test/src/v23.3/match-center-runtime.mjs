import { createMatchCenterRepository } from './match-center-repository.mjs';
import { createMatchCenterStore } from './match-center-store.mjs';
import { renderMatchCenterView } from './match-center-view.mjs';
import { enhanceRound502MatchCenterView } from './round50-2-match-center-view.mjs';
import {
  MATCH_CENTER_USER_TABS,
  MATCH_CENTER_DRAWER_RATIOS,
  drawerHeightForState,
  enhanceRound503MatchCenterView,
  providerTabForView,
  resolveDrawerSnap,
} from './round50-3-match-center-view.mjs';
import { currentMatchSource } from './match-center-lifecycle.mjs';

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

function defaultViewState() {
  return {
    activeViewTab:'overview',
    selectedLineupTeam:'home',
    expandedLineupDisclosure:null,
    selectedShotIndex:null,
  };
}

function canonicalViewTab(value) {
  const key = text(value).toLowerCase();
  return MATCH_CENTER_USER_TABS.includes(key) ? key : 'overview';
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

function viewportHeight(documentRef) {
  return Math.max(1, Number(documentRef?.defaultView?.innerHeight || globalThis.innerHeight || 800) || 800);
}

function drawerCssHeight(state) {
  const ratio = MATCH_CENTER_DRAWER_RATIOS[state] ?? MATCH_CENTER_DRAWER_RATIOS.standard;
  return `${Math.round(ratio * 100)}vh`;
}

function currentDrawerScroll(node) {
  return node?.querySelector?.('[data-cw503-drawer-scroll]') || null;
}

function currentDrawerShell(node) {
  return node?.querySelector?.('[data-cw503-drawer-shell]') || null;
}

export function createBrowserMatchCenterHost(documentRef = globalThis.document) {
  if (!documentRef?.createElement) throw new Error('match_center_document_required');

  ensureHostScrollbarStyle(documentRef);
  let node = documentRef.getElementById?.(MATCH_CENTER_RUNTIME_ID) || null;
  if (!node) {
    node = documentRef.createElement('div');
    node.id = MATCH_CENTER_RUNTIME_ID;
    node.dataset.cw239Runtime = MATCH_CENTER_RUNTIME_BUILD;
    node.dataset.cw503DrawerState = 'standard';
    node.hidden = true;
    node.setAttribute?.('aria-hidden', 'true');
    Object.assign(node.style || {}, {
      position:'fixed',
      left:'0',
      right:'0',
      bottom:'0',
      height:drawerCssHeight('standard'),
      maxHeight:drawerCssHeight('expanded'),
      zIndex:'58',
      overflow:'hidden',
      overscrollBehavior:'contain',
      background:'transparent',
      borderRadius:'24px 24px 0 0',
      boxShadow:'0 -18px 50px rgba(0,0,0,.34)',
      scrollbarWidth:'none',
      msOverflowStyle:'none',
      transition:'height .22s ease',
    });
    rootFor(documentRef)?.appendChild?.(node);
  } else {
    node.dataset.cw503DrawerState ||= 'standard';
    node.style.scrollbarWidth = 'none';
    node.style.msOverflowStyle = 'none';
    node.style.left = '0';
    node.style.right = '0';
    node.style.bottom = '0';
    node.style.overflow = 'hidden';
    node.style.background = 'transparent';
    node.style.borderRadius = '24px 24px 0 0';
  }

  let boundRuntime = null;
  let drag = null;

  function syncDrawerShellState() {
    const shell = currentDrawerShell(node);
    if (shell?.dataset) shell.dataset.cw503DrawerState = node.dataset.cw503DrawerState || 'standard';
  }

  function setDrawerState(next = 'standard') {
    const state = Object.hasOwn(MATCH_CENTER_DRAWER_RATIOS, next) ? next : 'standard';
    node.dataset.cw503DrawerState = state;
    node.style.height = drawerCssHeight(state);
    syncDrawerShellState();
    return state;
  }

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

  const pointerDownHandler = event => {
    const handle = event?.target?.closest?.('[data-cw503-drawer-handle]');
    if (!handle || !node.contains?.(handle)) return;
    const y = Number(event?.clientY);
    if (!Number.isFinite(y)) return;
    const height = Number(node.getBoundingClientRect?.().height) || drawerHeightForState(viewportHeight(documentRef), node.dataset.cw503DrawerState);
    drag = {
      pointerId:event?.pointerId,
      startY:y,
      startHeight:height,
      handle,
    };
    node.style.transition = 'none';
    handle.setPointerCapture?.(event?.pointerId);
    event.preventDefault?.();
    event.stopPropagation?.();
  };

  const pointerMoveHandler = event => {
    if (!drag) return;
    if (drag.pointerId !== undefined && event?.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
    const y = Number(event?.clientY);
    if (!Number.isFinite(y)) return;
    const viewport = viewportHeight(documentRef);
    const deltaY = y - drag.startY;
    const min = drawerHeightForState(viewport, 'compact') * 0.78;
    const max = drawerHeightForState(viewport, 'expanded');
    const height = Math.max(min, Math.min(max, drag.startHeight - deltaY));
    node.style.height = `${Math.round(height)}px`;
    event.preventDefault?.();
  };

  const finishDrag = event => {
    if (!drag) return;
    if (drag.pointerId !== undefined && event?.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
    const y = Number(event?.clientY);
    const deltaY = Number.isFinite(y) ? y - drag.startY : 0;
    const snap = resolveDrawerSnap(viewportHeight(documentRef), drag.startHeight, deltaY);
    drag.handle?.releasePointerCapture?.(drag.pointerId);
    drag = null;
    node.style.transition = 'height .22s ease';
    if (snap === 'close') {
      boundRuntime?.back?.();
      return;
    }
    setDrawerState(snap);
    event?.preventDefault?.();
  };

  node.addEventListener?.('click', clickHandler);
  node.addEventListener?.('error', imageErrorHandler, true);
  node.addEventListener?.('pointerdown', pointerDownHandler);
  node.addEventListener?.('pointermove', pointerMoveHandler);
  node.addEventListener?.('pointerup', finishDrag);
  node.addEventListener?.('pointercancel', finishDrag);

  return Object.freeze({
    node,
    bind(runtime) { boundRuntime = runtime; },
    setDrawerState,
    render(html) {
      const priorScroll = currentDrawerScroll(node);
      const scrollTop = Number(priorScroll?.scrollTop) || 0;
      node.innerHTML = String(html || '');
      node.hidden = false;
      node.removeAttribute?.('aria-hidden');
      node.style.display = 'block';
      syncDrawerShellState();
      const nextScroll = currentDrawerScroll(node);
      if (nextScroll) nextScroll.scrollTop = scrollTop;
    },
    hide() {
      node.hidden = true;
      node.setAttribute?.('aria-hidden', 'true');
      node.style.display = 'none';
    },
    scrollToTop() {
      const scroll = currentDrawerScroll(node);
      if (scroll) scroll.scrollTop = 0;
      else node.scrollTop = 0;
    },
    destroy() {
      boundRuntime = null;
      drag = null;
      node.removeEventListener?.('click', clickHandler);
      node.removeEventListener?.('error', imageErrorHandler, true);
      node.removeEventListener?.('pointerdown', pointerDownHandler);
      node.removeEventListener?.('pointermove', pointerMoveHandler);
      node.removeEventListener?.('pointerup', finishDrag);
      node.removeEventListener?.('pointercancel', finishDrag);
      node.remove?.();
    },
  });
}

function enhanceCurrentView(html, state, viewState) {
  return enhanceRound503MatchCenterView(
    enhanceRound502MatchCenterView(html, state, viewState),
    state,
    viewState,
  );
}

export function createCanonicalMatchCenterRuntime({
  store,
  host,
  renderView = renderMatchCenterView,
  enhanceView = enhanceCurrentView,
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
  if (typeof enhanceView !== 'function') throw new Error('match_center_enhancer_required');

  let source = null;
  let destroyed = false;
  let lastState = null;
  let viewState = defaultViewState();

  function rendered(state) {
    return enhanceView(renderView(state), state, viewState);
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
    suspendSource?.(source);
    host.setDrawerState?.('standard');
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
    viewState = defaultViewState();
    const result = store.close();
    host.hide();
    restoreSource?.(restore);
    return result;
  }

  async function selectTab(tab) {
    const nextView = canonicalViewTab(tab);
    const providerTab = providerTabForView(nextView);
    const state = store.getState?.() || lastState;
    const currentProvider = text(state?.activeTab);
    const previousView = viewState.activeViewTab;

    if (previousView === 'lineups' && nextView !== 'lineups') {
      viewState.selectedLineupTeam = 'home';
      viewState.expandedLineupDisclosure = null;
    }
    if (previousView === 'shots' && nextView !== 'shots') viewState.selectedShotIndex = null;
    viewState.activeViewTab = nextView;

    const result = await store.setActiveTab?.(providerTab);
    if (providerTab === currentProvider) renderCurrent();
    return result;
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
    const viewTab = canonicalViewTab(text(tab) || viewState.activeViewTab);
    return store.retrySection?.(providerTabForView(viewTab));
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    source = null;
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
