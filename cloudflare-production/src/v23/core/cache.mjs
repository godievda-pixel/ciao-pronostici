const keyOf = value => String(value ?? '').trim();

export function createLastGoodCache() {
  const entries = new Map();

  function put(key, data, at = Date.now()) {
    const cacheKey = keyOf(key);
    if (!cacheKey) throw new Error('cache_key_required');
    const timestamp = Number(at);
    entries.set(cacheKey, {
      data,
      updatedAt:Number.isFinite(timestamp) ? timestamp : Date.now(),
      error:null,
    });
    return get(cacheKey);
  }

  function get(key) {
    const entry = entries.get(keyOf(key));
    return entry ? { data:entry.data, updatedAt:entry.updatedAt, error:entry.error } : null;
  }

  function markError(key, error) {
    const cacheKey = keyOf(key);
    if (!cacheKey) throw new Error('cache_key_required');
    const current = entries.get(cacheKey) ?? { data:null, updatedAt:null, error:null };
    entries.set(cacheKey, { ...current, error:error ?? null });
    return get(cacheKey);
  }

  return Object.freeze({ put, get, markError });
}
