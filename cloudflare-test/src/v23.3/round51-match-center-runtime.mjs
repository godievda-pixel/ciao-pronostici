import { createMatchCenterRepository } from './match-center-repository.mjs';
import { createMatchCenterStore } from './match-center-store.mjs';
import { renderMatchCenterView } from './match-center-view.mjs';
import { enhanceRound502MatchCenterView } from './round50-2-match-center-view.mjs';
import { createRound51MatchCenterStore } from './round51-match-center-store.mjs';
import { createRound51MatchCenterHost } from './round51-match-center-host.mjs';
import {
  canonicalRound51ViewTab,
  providerTabForRound51View,
  enhanceRound51MatchCenterView,
} from './round51-match-center-view.mjs';

export const ROUND51_RUNTIME_BUILD = 'round51-bottom-drawer';

let installedRuntime = null;

function text(value) {
  return String(value ?? '').trim();
}

function defaultViewState() {
  return {
    activeViewTab:'overview',
    selectedLineupTeam:'home',
    expandedLineupDisclosure:null,
    selectedShotIndex:null,
  };
}

function enhanceRound51Pipeline(html, state, viewState) {
  const round502 = enhanceRound502MatchCenterView(html, state, viewState);
  return enhanceRound51MatchCenterView(round502, state, viewState);
}

export function createRound51MatchCenterRuntime({
  store,
  host,
  renderView = renderMatchCenterView,
  enhanceView = enhanceRound51Pipeline,
} = {}) {
  if (!store || typeof store.open !== 'function' || typeof store.close !== 'function') {
    throw new Error('round51_match_center_store_required');
  }
  if (!host || typeof host.render !== 'function' || typeof host.hide !== 'function') {
    throw new Error('round51_match_center_host_required');
  }
  if (typeof renderView !== 'function') throw new Error('round51_match_center_view_required');
  if (typeof enhanceView !== 'function') throw new Error('round51_match_center_enhancer_required');

  let source = null;
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
    if (destroyed) throw new Error('round51_match_center_runtime_destroyed');
    const competition = text(payload.competition);
    const matchId = text(payload.matchId);
    if (!competition || !matchId) throw new Error('round51_match_center_target_required');

    viewState = defaultViewState();
    source = payload.source && typeof payload.source === 'object' ? payload.source : null;
    host.setSnap?.('standard');
    host.scrollToTop?.();
    return store.open({
      competition,
      matchId,
      initialMatch:payload.initialMatch && typeof payload.initialMatch === 'object' ? payload.initialMatch : null,
    });
  }

  function back() {
    if (destroyed) return null;
    source = null;
    viewState = defaultViewState();
    const result = store.close();
    host.hide();
    return result;
  }

  function selectTab(tab) {
    if (destroyed) return null;
    const activeViewTab = canonicalRound51ViewTab(tab);
    const providerTab = providerTabForRound51View(activeViewTab);
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
    const requested = text(tab);
    const viewTab = requested ? canonicalRound51ViewTab(requested) : viewState.activeViewTab;
    return store.retrySection?.(providerTabForRound51View(viewTab));
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    source = null;
    lastState = null;
    viewState = defaultViewState();
    unsubscribe?.();
    store.close?.();
    store.destroy?.();
    host.hide?.();
    host.destroy?.();
  }

  const runtime = Object.freeze({
    build:ROUND51_RUNTIME_BUILD,
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

export function installRound51MatchCenterRuntime(documentRef = globalThis.document, rootRef = globalThis) {
  if (installedRuntime) return installedRuntime;
  if (!documentRef?.createElement) return null;

  const repository = createMatchCenterRepository();
  const stableStore = createMatchCenterStore({ repository, documentRef });
  const store = createRound51MatchCenterStore({ store:stableStore });
  const host = createRound51MatchCenterHost(documentRef);
  const runtime = createRound51MatchCenterRuntime({ store, host });

  installedRuntime = runtime;
  if (rootRef) {
    rootRef.CiaoV251MatchCenterRuntime = Object.freeze({
      build:ROUND51_RUNTIME_BUILD,
      open:runtime.open,
      back:runtime.back,
      selectTab:runtime.selectTab,
      uiAction:runtime.uiAction,
      retryBase:runtime.retryBase,
      retrySection:runtime.retrySection,
    });
  }
  return installedRuntime;
}

export async function openRound51MatchCenter(payload = {}) {
  const runtime = installedRuntime || installRound51MatchCenterRuntime(globalThis.document, globalThis);
  if (!runtime) throw new Error('round51_match_center_runtime_unavailable');
  return runtime.open(payload);
}
