const DEFAULT_MAX_ENTRIES = 120;
const LIVE_TTL = 10_000;
const FINISHED_TTL = 5 * 60_000;
const DEFAULT_TTL = 60_000;

export function matchCenterSectionTtl(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'live') return LIVE_TTL;
  if (normalized === 'finished') return FINISHED_TTL;
  return DEFAULT_TTL;
}

export function createMatchCenterSectionCache({
  maxEntries = DEFAULT_MAX_ENTRIES,
  now = Date.now,
} = {}) {
  const parsedLimit = Number(maxEntries);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.max(1, Math.floor(parsedLimit))
    : DEFAULT_MAX_ENTRIES;
  const values = new Map();
  const inflight = new Map();

  function get(key) {
    const cached = values.get(key);
    if (!cached) return null;
    if (now() - cached.at >= cached.ttl) {
      values.delete(key);
      return null;
    }
    return cached.value;
  }

  function set(key, value, { status } = {}) {
    if (values.has(key)) values.delete(key);
    values.set(key, {
      at:now(),
      ttl:matchCenterSectionTtl(status),
      value,
    });
    while (values.size > limit) {
      const oldest = values.keys().next().value;
      values.delete(oldest);
    }
    return value;
  }

  function getInflight(key) {
    return inflight.get(key) || null;
  }

  function rememberInflight(key, promise) {
    inflight.set(key, promise);
    return promise;
  }

  function forgetInflight(key, promise) {
    if (!promise || inflight.get(key) === promise) inflight.delete(key);
  }

  function clear() {
    values.clear();
    inflight.clear();
  }

  return Object.freeze({
    get,
    set,
    getInflight,
    rememberInflight,
    forgetInflight,
    clear,
    get size() {
      return values.size;
    },
  });
}
