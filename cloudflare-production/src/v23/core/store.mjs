export function createStore(initial) {
  let state = initial;
  const listeners = new Set();

  function get() {
    return state;
  }

  function set(updater) {
    const previous = state;
    state = typeof updater === 'function' ? updater(previous) : updater;
    if (Object.is(state, previous)) return state;
    for (const listener of [...listeners]) listener(state, previous);
    return state;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new Error('store_listener_required');
    listeners.add(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      listeners.delete(listener);
    };
  }

  return Object.freeze({ get, set, subscribe });
}
