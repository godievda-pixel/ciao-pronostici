import { createMatchCenterRepository } from './match-center-repository.mjs';
import { createMatchCenterStore } from './match-center-store.mjs';
import { renderMatchCenterView } from './match-center-view.mjs';
import { enhanceRound502MatchCenterView } from './round50-2-match-center-view.mjs';
import {
  canonicalRound512UserView,
  providerSectionForRound512UserView,
  enhanceRound512MatchCenterView,
} from './round51-2-match-center-view.mjs';
import { createRound512MatchCenterHost } from './round51-2-match-center-host.mjs';

export const ROUND512_RUNTIME_BUILD = 'round51-2-bottom-drawer';

let installedRuntime = null;

function text(value) {
  return String(value ?? '').trim();
}

function defaultViewState() {
  return {
    activeUserView:'overview',
    selectedLineupTeam:'home',
    expandedLineupDisclosure:null,
    selectedShotIndex:null,
  };
}

export function createRound512MatchCenterRuntime({
  store,
  host,
  renderView = renderMatchCenterView,
  enhanceLegacy = enhanceRound502MatchCenterView,
  enhanceUser = enhanceRound512MatchCenterView,
} = {}) {
  if (!store || typeof store.open !== 'function' || typeof store.close !== 'function') {
    throw new Error('round512_match_center_store_required');
  }
  if (!host || typeof host.render !== 'function' || typeof host.hide !== 'function') {
    throw new Error('round512_match_center_host_required');
  }
  if (typeof renderView !== 'function' || typeof enhanceLegacy !== 'function' || typeof enhanceUser !== 'function') {
    throw new Error('round512_match_center_view_required');
  }

  let source = null;
  let destroyed = false;
  let lastState = null;
  let viewState = defaultViewState();

  function rendered(state) {
    const base = renderView(state);
    const legacy = enhanceLegacy(base, state, viewState);
    return enhanceUser(legacy, state, viewState);
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
    if (destroyed) throw new Error('round512_match_center_runtime_destroyed');
    const competition = text(payload.competition);
    const matchId = text(payload.matchId);
    if (!competition || !matchId) throw new Error('round512_match_center_target_required');

    source = payload.source && typeof payload.source === 'object' ? payload.source : null;
    viewState = defaultViewState();
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

  async function selectUserView(value) {
    if (destroyed) return null;
    const nextUserView = canonicalRound512UserView(value);
    const currentUserView = viewState.activeUserView;
    if (currentUserView === 'lineups' && nextUserView !== 'lineups') {
      viewState.selectedLineupTeam = 'home';
      viewState.expandedLineupDisclosure = null;
    }
    if (currentUserView === 'shots' && nextUserView !== 'shots') viewState.selectedShotIndex = null;

    viewState.activeUserView = nextUserView;
    const nextProviderSection = providerSectionForRound512UserView(nextUserView);
    const currentProviderSection = text((store.getState?.() || lastState)?.activeTab);
    if (currentProviderSection === nextProviderSection) {
      renderCurrent();
      return store.getState?.() || lastState;
    }
    return store.setActiveTab?.(nextProviderSection);
  }

  function uiAction(action, value) {
    if (destroyed) return null;
    const state = store.getState?.() || lastState;
    if (!state?.open) return null;
    const key = text(action);

    if (key === 'lineup-team' && viewState.activeUserView === 'lineups' && state.activeTab === 'lineups') {
      const side = value === 'away' ? 'away' : value === 'home' ? 'home' : null;
      if (!side) return null;
      viewState.selectedLineupTeam = side;
      viewState.expandedLineupDisclosure = null;
      return renderCurrent();
    }

    if (key === 'lineup-disclosure' && viewState.activeUserView === 'lineups' && state.activeTab === 'lineups') {
      const disclosure = value === 'starters' || value === 'substitutes' ? value : null;
      if (!disclosure) return null;
      const selected = viewState.selectedLineupTeam === 'away' ? 'away' : 'home';
      const side = state?.sections?.lineups?.[selected];
      const rows = Array.isArray(side?.[disclosure]) ? side[disclosure] : [];
      if (!rows.length) return null;
      viewState.expandedLineupDisclosure = viewState.expandedLineupDisclosure === disclosure ? null : disclosure;
      return renderCurrent();
    }

    if (key === 'shot' && viewState.activeUserView === 'shots' && state.activeTab === 'stats') {
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

  function retrySection() {
    return store.retrySection?.(providerSectionForRound512UserView(viewState.activeUserView));
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
    build:ROUND512_RUNTIME_BUILD,
    store,
    open,
    back,
    selectUserView,
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

export function installRound512MatchCenterRuntime(documentRef = globalThis.document, rootRef = globalThis) {
  if (installedRuntime) return installedRuntime;
  if (!documentRef?.createElement) return null;

  const repository = createMatchCenterRepository();
  const store = createMatchCenterStore({ repository, documentRef });
  const host = createRound512MatchCenterHost(documentRef);
  installedRuntime = createRound512MatchCenterRuntime({ store, host });

  rootRef.CiaoV2512MatchCenterRuntime = Object.freeze({
    build:ROUND512_RUNTIME_BUILD,
    open:installedRuntime.open,
    back:installedRuntime.back,
    selectUserView:installedRuntime.selectUserView,
    uiAction:installedRuntime.uiAction,
    retryBase:installedRuntime.retryBase,
    retrySection:installedRuntime.retrySection,
  });
  return installedRuntime;
}

export async function openRound512MatchCenter(payload = {}) {
  const runtime = installedRuntime || installRound512MatchCenterRuntime(globalThis.document, globalThis);
  if (!runtime) throw new Error('round512_match_center_runtime_unavailable');
  return runtime.open(payload);
}
