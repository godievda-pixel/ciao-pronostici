function cloneState(state) {
  return Object.freeze({
    running: state.running,
    context: state.context,
    data: state.data,
    error: state.error,
    updatedAt: state.updatedAt,
  });
}

function contextKey(context) {
  if (!context || typeof context !== 'object') return String(context ?? '');
  return [
    context.screen,
    context.tournament,
    context.competition,
    context.matchId,
    context.subview,
  ].map(value => String(value ?? '')).join('|');
}

export function createLiveEngine({
  refresh,
  intervalMs = 30000,
  retryMs = 15000,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  now = () => Date.now(),
} = {}) {
  if (typeof refresh !== 'function') throw new Error('live_refresh_required');
  const listeners = new Set();
  let timer = null;
  let generation = 0;
  let inFlight = null;
  const state = { running:false, context:null, data:null, error:null, updatedAt:null };

  function emit() {
    const snapshot = cloneState(state);
    for (const listener of listeners) listener(snapshot);
  }

  function clearScheduled() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function schedule(delay, token) {
    clearScheduled();
    if (!state.running || token !== generation) return;
    timer = setTimer(() => run(token), delay);
  }

  async function run(token = generation) {
    if (!state.running || token !== generation) return cloneState(state);
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const data = await refresh(state.context);
        if (!state.running || token !== generation) return cloneState(state);
        state.data = data;
        state.error = null;
        state.updatedAt = now();
        emit();
        schedule(intervalMs, token);
      } catch (error) {
        if (!state.running || token !== generation) return cloneState(state);
        state.error = error instanceof Error ? error : new Error(String(error));
        emit();
        schedule(retryMs, token);
      } finally {
        inFlight = null;
      }
      return cloneState(state);
    })();
    return inFlight;
  }

  return Object.freeze({
    async start(context) {
      generation += 1;
      clearScheduled();
      const changed = contextKey(state.context) !== contextKey(context);
      state.running = true;
      state.context = context;
      state.error = null;
      if (changed) {
        state.data = null;
        state.updatedAt = null;
      }
      emit();
      return run(generation);
    },
    stop() {
      generation += 1;
      clearScheduled();
      state.running = false;
      state.context = null;
      state.error = null;
      emit();
    },
    refreshNow() { return run(generation); },
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    state() { return cloneState(state); },
  });
}
