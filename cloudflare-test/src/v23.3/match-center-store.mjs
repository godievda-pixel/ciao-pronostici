import { MATCH_CENTER_SECTIONS } from './match-center-contract.mjs';

const POLL_MS = 15_000;
const SECTION_SET = new Set(MATCH_CENTER_SECTIONS);

function blankSections() {
  return Object.fromEntries(MATCH_CENTER_SECTIONS.map(section => [section, null]));
}

function blankSectionState() {
  return Object.fromEntries(MATCH_CENTER_SECTIONS.map(section => [section, { status:'idle', error:'' }]));
}

function canonicalTab(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!SECTION_SET.has(key)) {
    const error = new Error('invalid_match_center_section');
    error.code = 'invalid_match_center_section';
    throw error;
  }
  return key;
}

function unwrapBase(value) {
  if (value?.match && typeof value.match === 'object' && !Array.isArray(value.match)) return value.match;
  return value;
}

function text(value) {
  return String(value ?? '').trim();
}

function mergeTeam(bootstrap, loaded) {
  const initial = bootstrap && typeof bootstrap === 'object' ? bootstrap : {};
  const fresh = loaded && typeof loaded === 'object' ? loaded : {};
  const merged = { ...initial, ...fresh };
  if (!text(fresh.name) && text(initial.name)) merged.name = initial.name;
  if (!text(fresh.crestUrl) && text(initial.crestUrl)) merged.crestUrl = initial.crestUrl;
  return merged;
}

function mergeMatch(bootstrap, loaded) {
  if (!bootstrap || typeof bootstrap !== 'object') return loaded;
  if (!loaded || typeof loaded !== 'object') return bootstrap;
  return {
    ...bootstrap,
    ...loaded,
    homeTeam:mergeTeam(bootstrap.homeTeam, loaded.homeTeam),
    awayTeam:mergeTeam(bootstrap.awayTeam, loaded.awayTeam),
  };
}

function message(error, fallback) {
  return String(error?.code || error?.message || error || fallback);
}

function cloneSectionState(value) {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, { ...entry }]));
}

export function createMatchCenterStore({
  repository,
  now = () => new Date(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = id => clearTimeout(id),
  documentRef = globalThis.document,
} = {}) {
  if (!repository || typeof repository.base !== 'function' || typeof repository.section !== 'function') {
    throw new Error('match_center_repository_required');
  }

  let generation = 0;
  let timerId = null;
  let bootstrapMatch = null;
  const listeners = new Set();
  let state = {
    open:false,
    phase:'closed',
    competition:'',
    matchId:'',
    match:null,
    activeTab:'overview',
    sections:blankSections(),
    sectionState:blankSectionState(),
    error:'',
    updatedAt:null,
  };

  function getState() {
    return Object.freeze({
      ...state,
      sections:{ ...state.sections },
      sectionState:cloneSectionState(state.sectionState),
    });
  }

  function emit() {
    const snapshot = getState();
    for (const listener of [...listeners]) {
      try { listener(snapshot); } catch {}
    }
  }

  function clearPoll() {
    if (timerId === null || timerId === undefined) return;
    const id = timerId;
    timerId = null;
    clearTimer(id);
  }

  function isCurrent(token, competition = state.competition, matchId = state.matchId) {
    return state.open
      && token === generation
      && state.competition === competition
      && state.matchId === matchId;
  }

  function shouldPoll() {
    return Boolean(
      state.open
      && String(state?.match?.status || '').toLowerCase() === 'live'
      && !documentRef?.hidden,
    );
  }

  function schedulePoll() {
    clearPoll();
    if (!shouldPoll()) return;
    timerId = setTimer(async () => {
      timerId = null;
      await refreshLive();
    }, POLL_MS);
  }

  async function loadBase({ force = false, revealLoading = false, schedule = true } = {}) {
    if (!state.open) return getState();
    const token = generation;
    const competition = state.competition;
    const matchId = state.matchId;

    if (revealLoading) {
      state = { ...state, phase:'loading-base', error:'' };
      emit();
    }

    try {
      const payload = await repository.base(competition, matchId, { force:force === true });
      if (!isCurrent(token, competition, matchId)) return getState();
      const loaded = unwrapBase(payload);
      if (!loaded || typeof loaded !== 'object') throw new Error('match_center_base_missing');
      const match = mergeMatch(bootstrapMatch, loaded);
      state = {
        ...state,
        match,
        phase:'ready',
        error:'',
        updatedAt:now(),
      };
      emit();
      if (schedule) schedulePoll();
    } catch (error) {
      if (!isCurrent(token, competition, matchId)) return getState();
      state = {
        ...state,
        phase:state.match ? 'ready' : 'error-base',
        error:message(error, 'match_center_base_failed'),
      };
      emit();
      if (schedule) schedulePoll();
    }
    return getState();
  }

  async function loadSection(tab, { force = false } = {}) {
    const key = canonicalTab(tab);
    if (!state.open || !state.match) return getState();

    const token = generation;
    const competition = state.competition;
    const matchId = state.matchId;
    const status = String(state?.match?.status || '') || null;

    if (!force && state.sectionState[key]?.status === 'ready') return getState();
    if (!force && state.sectionState[key]?.status === 'unavailable') return getState();

    state = {
      ...state,
      sectionState:{ ...state.sectionState, [key]:{ status:'loading', error:'' } },
    };
    emit();

    try {
      const payload = await repository.section(competition, matchId, key, {
        force:force === true,
        status,
      });
      if (!isCurrent(token, competition, matchId)) return getState();

      const available = payload?.available !== false;
      const nextCoverage = payload?.coverage && typeof payload.coverage === 'object'
        ? { ...(state.match?.coverage || {}), ...payload.coverage }
        : state.match?.coverage;
      state = {
        ...state,
        match:nextCoverage ? { ...state.match, coverage:nextCoverage } : state.match,
        sections:{ ...state.sections, [key]:available ? (payload?.data ?? null) : null },
        sectionState:{
          ...state.sectionState,
          [key]:{ status:available ? 'ready' : 'unavailable', error:'' },
        },
      };
      emit();
    } catch (error) {
      if (!isCurrent(token, competition, matchId)) return getState();
      state = {
        ...state,
        sectionState:{
          ...state.sectionState,
          [key]:{ status:'error', error:message(error, 'match_center_section_failed') },
        },
      };
      emit();
    }
    return getState();
  }

  async function refreshLive() {
    if (!state.open || String(state?.match?.status || '').toLowerCase() !== 'live') return getState();
    await loadBase({ force:true, revealLoading:false, schedule:false });
    if (!state.open) return getState();
    if (SECTION_SET.has(state.activeTab)) {
      await loadSection(state.activeTab, { force:true });
    }
    schedulePoll();
    return getState();
  }

  async function open({ competition, matchId, initialMatch } = {}) {
    const canonicalCompetition = String(competition || '').trim();
    const canonicalMatchId = String(matchId || '').trim();
    if (!canonicalCompetition || !canonicalMatchId) throw new Error('match_center_target_required');

    generation += 1;
    const token = generation;
    clearPoll();
    bootstrapMatch = initialMatch && typeof initialMatch === 'object' && !Array.isArray(initialMatch)
      ? initialMatch
      : null;
    state = {
      open:true,
      phase:'loading-base',
      competition:canonicalCompetition,
      matchId:canonicalMatchId,
      match:null,
      activeTab:'overview',
      sections:blankSections(),
      sectionState:blankSectionState(),
      error:'',
      updatedAt:null,
    };
    emit();

    await loadBase({ force:false, revealLoading:false, schedule:false });
    if (!isCurrent(token, canonicalCompetition, canonicalMatchId)) return getState();

    if (state.match && SECTION_SET.has(state.activeTab)) {
      await loadSection(state.activeTab, { force:false });
    }

    if (isCurrent(token, canonicalCompetition, canonicalMatchId)) schedulePoll();
    return getState();
  }

  function close() {
    generation += 1;
    clearPoll();
    bootstrapMatch = null;
    state = {
      ...state,
      open:false,
      phase:'closed',
      error:'',
    };
    emit();
    return getState();
  }

  async function setActiveTab(tab) {
    const key = canonicalTab(tab);
    if (!state.open) return getState();
    if (state.activeTab !== key) {
      state = { ...state, activeTab:key };
      emit();
    }
    return loadSection(key, { force:false });
  }

  function retryBase() {
    return loadBase({ force:true, revealLoading:!state.match, schedule:true });
  }

  function retrySection(tab = state.activeTab) {
    return loadSection(tab, { force:true });
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new Error('match_center_listener_required');
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  const visibilityHandler = () => {
    if (!state.open) return;
    if (documentRef?.hidden) {
      clearPoll();
      return;
    }
    schedulePoll();
  };
  documentRef?.addEventListener?.('visibilitychange', visibilityHandler);

  return Object.freeze({
    open,
    close,
    setActiveTab,
    retryBase,
    retrySection,
    subscribe,
    getState,
  });
}
