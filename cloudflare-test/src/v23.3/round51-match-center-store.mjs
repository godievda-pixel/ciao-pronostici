function text(value) {
  return String(value ?? '').trim();
}

function renderable(value) {
  return value !== null && value !== undefined;
}

export function normalizeRound51MatchCenterSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const sections = snapshot.sections && typeof snapshot.sections === 'object'
    ? snapshot.sections
    : {};
  const sourceSectionState = snapshot.sectionState && typeof snapshot.sectionState === 'object'
    ? snapshot.sectionState
    : {};
  const sectionState = {};

  for (const [key, rawEntry] of Object.entries(sourceSectionState)) {
    const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry : {};
    const status = text(entry.status).toLowerCase();
    const hasRenderableData = renderable(sections[key]);
    if (hasRenderableData && (status === 'loading' || status === 'error')) {
      sectionState[key] = {
        ...entry,
        status:'ready',
        error:status === 'error' ? text(entry.error) : '',
      };
    } else {
      sectionState[key] = { ...entry };
    }
  }

  return {
    ...snapshot,
    sections:{ ...sections },
    sectionState,
  };
}

function normalizedResult(result) {
  if (result && typeof result.then === 'function') {
    return result.then(normalizeRound51MatchCenterSnapshot);
  }
  return normalizeRound51MatchCenterSnapshot(result);
}

export function createRound51MatchCenterStore({ store } = {}) {
  if (!store || typeof store.getState !== 'function' || typeof store.subscribe !== 'function') {
    throw new Error('round51_match_center_store_required');
  }

  return Object.freeze({
    getState() {
      return normalizeRound51MatchCenterSnapshot(store.getState());
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new Error('round51_match_center_listener_required');
      return store.subscribe(snapshot => listener(normalizeRound51MatchCenterSnapshot(snapshot)));
    },
    open(payload) {
      return normalizedResult(store.open?.(payload));
    },
    close() {
      return normalizedResult(store.close?.());
    },
    setActiveTab(tab) {
      return normalizedResult(store.setActiveTab?.(tab));
    },
    retryBase() {
      return normalizedResult(store.retryBase?.());
    },
    retrySection(tab) {
      return normalizedResult(store.retrySection?.(tab));
    },
    destroy() {
      return store.destroy?.();
    },
  });
}
