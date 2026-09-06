import { resolveTelegramInitData, normalizeApiError } from './api-contract.mjs';

function text(value) { return String(value ?? '').trim(); }

function makeUrl(path, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const suffix = params.toString();
  return suffix ? `${path}${String(path).includes('?') ? '&' : '?'}${suffix}` : path;
}

export function createApiClient({
  fetchImpl = globalThis.fetch,
  initDataResolver = () => resolveTelegramInitData(),
  cacheTtlMs = 15000,
  now = () => Date.now(),
} = {}) {
  const cache = new Map();

  async function request(path, { method = 'GET', query, body, force = false } = {}) {
    const initData = text(initDataResolver());
    if (!initData) throw Object.assign(new Error('telegram_auth_required'), { code:'telegram_auth_required', status:401 });
    if (typeof fetchImpl !== 'function') throw Object.assign(new Error('fetch_unavailable'), { code:'fetch_unavailable', status:0 });

    const url = makeUrl(path, query);
    const upperMethod = String(method || 'GET').toUpperCase();
    const cacheKey = `${upperMethod}:${url}:${initData}`;
    if (upperMethod === 'GET' && !force) {
      const hit = cache.get(cacheKey);
      if (hit && now() - hit.at <= cacheTtlMs) return hit.value;
      if (hit) cache.delete(cacheKey);
    }

    let response;
    try {
      response = await fetchImpl(url, {
        method: upperMethod,
        headers: {
          accept: 'application/json',
          ...(body !== undefined ? { 'content-type':'application/json' } : {}),
          'x-telegram-init-data': initData,
        },
        ...(body !== undefined ? { body:JSON.stringify(body) } : {}),
      });
    } catch (error) {
      throw Object.assign(new Error(text(error?.message) || 'network_error'), normalizeApiError(error));
    }

    let payload = null;
    try { payload = await response.json(); } catch { /* handled below */ }
    if (!response.ok || payload?.ok === false || payload === null) {
      const message = text(payload?.error || payload?.message) || `api_http_${response.status}`;
      throw Object.assign(new Error(message), { code:text(payload?.code) || 'api_error', status:response.status, payload });
    }
    const value = payload?.data !== undefined ? payload.data : payload;
    if (upperMethod === 'GET') cache.set(cacheKey, { at:now(), value });
    return value;
  }

  return Object.freeze({
    get: (path, query = {}, options = {}) => request(path, { ...options, method:'GET', query }),
    post: (path, body = {}, options = {}) => request(path, { ...options, method:'POST', body }),
    invalidate(prefix = '') {
      for (const key of cache.keys()) if (!prefix || key.includes(prefix)) cache.delete(key);
    },
  });
}
