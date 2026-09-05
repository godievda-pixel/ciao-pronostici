import { createMatchCenterRepository } from './match-center-repository.mjs';
import { createMatchCenterStore } from './match-center-store.mjs';
import { renderMatchCenterView } from './match-center-view.mjs';
import { enhanceRound502MatchCenterView } from './round50-2-match-center-view.mjs';
import {
  canonicalRound503ViewTab,
  providerTabForRound503View,
  round503SnapHeights,
  resolveRound503Snap,
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

const DRAWER_SNAPS = Object.freeze(['compact', 'standard', 'expanded']);
const DRAWER_HANDLE_HTML = '<div class="cw503-mc-drawer-handle" data-cw503-drawer-handle role="button" aria-label="Изменить высоту панели" style="position:sticky;top:0;z-index:6;display:flex;justify-content:center;align-items:center;height:28px;touch-action:none;cursor:grab;background:linear-gradient(180deg,#071626 68%,rgba(7,22,38,0))"><span aria-hidden="true" style="display:block;width:42px;height:4px;border-radius:999px;background:rgba(255,255,255,.32)"></span></div>';

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

function viewportHeightFor(documentRef) {
  const local = Number(documentRef?.defaultView?.innerHeight);
  const globalHeight = Number(globalThis?.innerHeight);
  if (Number.isFinite(local) && local > 0) return local;
  if (Number.isFinite(globalHeight) && globalHeight > 0) return globalHeight;
  return 800;
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
    node.dataset.cw503Drawer = '1';
    node.hidden = true;
    node.setAttribute?.('aria-hidden', 'true');
    Object.assign(node.style || {}, {
      position:'fixed',
      left:'0',
      right:'0',
      bottom:'0',
      top:'auto',
      width:'100%',
      zIndex:'58',
      overflowY:'auto',
      overflowX:'hidden',
      overscrollBehavior:'contain',
      background:'#071626',
      borderRadius:'24px 24px 0 0',
      boxShadow:'0 -18px 56px rgba(0,0,0,.36)',
      scrollbarWidth:'none',
      msOverflowStyle:'none',
      willChange:'height',
    });
    rootFor(documentRef)?.appendChild?.(node);
  } else {
    node.dataset.cw239Runtime = MATCH_CENTER_RUNTIME_BUILD;
    node.dataset.cw503Drawer = '1';
    Object.assign(node.style || {}, {
      position:'fixed',
      left:'0',
      right:'0',
      bottom:'0',
      top:'auto',
      width:'100%',
      borderRadius:'24px 24px 0 0',
      overflowY:'auto',
      overflowX:'hidden',
      scrollbarWidth:'none',
      msOverflowStyle:'none',
    });
    if (node.style?.inset === '0') node.style.inset = '';
  }

  let boundRuntime = null;
  let drag = null;

  const snapTo = (requested = 'standard', animate = true) => {
    const snap = DRAWER_SNAPS.includes(requested) ? requested : 'standard';
    const height = round503SnapHeights(viewportHeightFor(documentRef))[snap];
    node.dataset.matchCenterSnap = snap;
    node.style.transition = animate ? 'height 180ms ease' : 'none';
    node.style.height = `${height}px`;
    return height;
  };

  snapTo('standard', false);

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
    const startY = Number(event?.clientY);
    if (!Number.isFinite(startY)) return;
    const currentHeight = Number.parseFloat(node.style.height) || round503SnapHeights(viewportHeightFor(documentRef)).standard;
    drag = { pointerId:event?.pointerId, startY, startHeight:currentHeight };
    node.style.transition = 'none';
    node.style.cursor = 'grabbing';
    node.setPointerCapture?.(event?.pointerId);
    event?.preventDefault?.();
  };

  const pointerMoveHandler = event => {
    if (!drag || (drag.pointerId != null && event?.pointerId != null && drag.pointerId !== event.pointerId)) return;
    const y = Number(event?.clientY);
    if (!Number.isFinite(y)) return;
    const viewport = viewportHeightFor(documentRef);
    const snaps = round503SnapHeights(viewport);
    const deltaY = y - drag.startY;
    const minimum = Math.max(96, Math.round(snaps.compact * 0.62));
    const height = Math.max(minimum, Math.min(snaps.expanded, Math.round(drag.startHeight - deltaY)));
    node.dataset.matchCenterSnap = 'dragging';
    node.style.height = `${height}px`;
    event?.preventDefault?.();
  };

  const finishDrag = event => {
    if (!drag || (drag.pointerId != null && event?.pointerId != null && drag.pointerId !== event.pointerId)) return;
    const y = Number(event?.clientY);
    const deltaY = Number.isFinite(y) ? y - drag.startY : 0;
    const result = resolveRound503Snap({
      viewportHeight:viewportHeightFor(documentRef),
      currentHeight:drag.startHeight,
      deltaY,
    });
    const pointerId = drag.pointerId;
    drag = null;
    node.style.cursor = '';
    node.releasePointerCapture?.(pointerId);
    event?.preventDefault?.();
    if (result.action === 'dismiss') {
      boundRuntime?.back?.();
      return;
    }
    snapTo(result.snap || 'standard');
  };

  const cancelDrag = event => {
    if (!drag) return;
    const current = Number.parseFloat(node.style.height) || round503SnapHeights(viewportHeightFor(documentRef)).standard;
    const result = resolveRound503Snap({ viewportHeight:viewportHeightFor(documentRef), currentHeight:current, deltaY:0 });
    drag = null;
    node.style.cursor = '';
    snapTo(result.snap || 'standard');
    event?.preventDefault?.();
  };

  const resizeHandler = () => {
    const snap = DRAWER_SNAPS.includes(node.dataset.matchCenterSnap) ? node.dataset.matchCenterSnap : 'standard';
    snapTo(snap, false);
  };

  node.addEventListener?.('click', clickHandler);
  node.addEventListener?.('error', imageErrorHandler, true);
  node.addEventListener?.('pointerdown', pointerDownHandler);
  node.addEventListener?.('pointermove', pointerMoveHandler);
  node.addEventListener?.('pointerup', finishDrag);
  node.addEventListener?.('pointercancel', cancelDrag);
  documentRef?.defaultView?.addEventListener?.('resize', resizeHandler);

  return Object.freeze({
    node,
    bind(runtime) { boundRuntime = runtime; },
    snapTo,
    render(html) {
      const scrollTop = Number(node.scrollTop) || 0;
      const reopening = node.hidden || node.style.display === 'none';
      if (reopening) snapTo('standard', false);
      node.innerHTML = `${DRAWER_HANDLE_HTML}${String(html || '')}`;
      node.hidden = false;
      node.removeAttribute?.('aria-hidden');
      node.style.display = 'block';
      node.scrollTop = scrollTop;
    },
    hide() {
      drag = null;
      node.hidden = true;
      node.setAttribute?.('aria-hidden', 'true');
      node.style.display = 'none';
    },
    scrollToTop() { node.scrollTop = 0; },
    destroy() {
      boundRuntime = null;
      drag = null;
      node.removeEventListener?.('click', clickHandler);
      node.removeEventListener?.('error', imageErrorHandler, true);
      node.removeEventListener?.('pointerdown', pointerDownHandler);
      node.removeEventListener?.('pointermove', pointerMoveHandler);
      node.removeEventListener?.('pointerup', finishDrag);
      node.removeEventListener?.('pointercancel', cancelDrag);
      documentRef?.defaultView?.removeEventListener?.('resize', resizeHandler);
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
  currentSource = null,
  legacySourceLifecycle = null,
} = {}) {
  if (!store || typeof store.open !== 'function' || typeof store.close !== 'function') {
    throw new Error('match_center_store_required');
  }
  if (!host || typeof host.render !== 'function' || typeof host.hide !== 'function') {
    throw new Error('match_center_host_required');
  }
  if (typeof renderView !== 'function') throw new Error('match_center_view_required');
  if (typeof enhanceView !== 'function') throw new Error('match_center_enhancer_required');

  const hasCurrentSourceReader = typeof currentSource === 'function';
  const sourceReader = hasCurrentSourceReader ? currentSource : () => defaultSource();
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
    const explicitSource = payload.source && typeof payload.source === 'object';
    source = sourceOrDefault(explicitSource ? payload.source : sourceReader?.());
    const legacyRequested = legacySourceLifecycle === true || payload.legacySourceLifecycle === true;
    const historicalDirectCall = legacySourceLifecycle == null && !hasCurrentSourceReader && explicitSource;
    restoreLegacySource = legacyRequested || historicalDirectCall;
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
    legacySourceLifecycle:false,
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
