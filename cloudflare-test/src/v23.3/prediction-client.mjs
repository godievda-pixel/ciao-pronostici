function text(value) {
  return String(value ?? '').trim();
}

function clientError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

const GET_CACHE = new Map();
const GET_INFLIGHT = new Map();
const GET_CACHE_TTL = 30_000;

function cacheKey(base, auth, path) {
  return `${base}\n${auth}\n${path}`;
}

function getFreshCached(key, now = Date.now()) {
  const entry = GET_CACHE.get(key);
  if (!entry) return null;
  if (now - entry.at > GET_CACHE_TTL) {
    GET_CACHE.delete(key);
    return null;
  }
  return entry.value;
}

function clearIdentityCache(base, auth) {
  const prefix = `${base}\n${auth}\n`;
  for (const key of GET_CACHE.keys()) {
    if (key.startsWith(prefix)) GET_CACHE.delete(key);
  }
}

export function createPredictionClient({
  fetchImpl = globalThis.fetch,
  initData,
  origin,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Prediction fetch implementation is required');
  const base = text(origin) || globalThis.location?.origin || 'https://ciao-web-app-test.ciao-web.workers.dev';
  const auth = text(initData);

  async function networkRequest(path, { method = 'GET', body } = {}) {
    if (!auth) throw clientError('telegram_auth_required', 401);
    const response = await fetchImpl(new Request(new URL(path, base), {
      method,
      headers: {
        'x-telegram-init-data': auth,
        ...(body ? { 'content-type':'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }));
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw clientError('prediction_backend_unavailable', response.status || 503);
    }
    if (!response.ok || payload?.ok === false) {
      throw clientError(text(payload?.error) || 'prediction_backend_unavailable', response.status || 503);
    }
    return payload?.data;
  }

  function request(path, { method = 'GET', body, force = false } = {}) {
    if (method !== 'GET') {
      return networkRequest(path, { method, body }).then(value => {
        clearIdentityCache(base, auth);
        return value;
      });
    }

    if (!auth) return Promise.reject(clientError('telegram_auth_required', 401));
    const key = cacheKey(base, auth, path);
    if (!force) {
      const cached = getFreshCached(key);
      if (cached !== null) return Promise.resolve(cached);
      const inflight = GET_INFLIGHT.get(key);
      if (inflight) return inflight;
    }

    const pending = networkRequest(path).then(value => {
      GET_CACHE.set(key, { at:Date.now(), value });
      return value;
    }).finally(() => {
      if (GET_INFLIGHT.get(key) === pending) GET_INFLIGHT.delete(key);
    });
    GET_INFLIGHT.set(key, pending);
    return pending;
  }

  const paths = Object.freeze({
    list: competition => `/api/v23.3/predictions?${new URLSearchParams({ competition })}`,
    available: competition => `/api/v23.3/predictions/available?${new URLSearchParams({ competition })}`,
    rankings: ({ scope = 'overall', competition } = {}) => {
      const params = new URLSearchParams({ scope });
      if (scope === 'competition' && competition) params.set('competition', competition);
      return `/api/v23.3/rankings?${params}`;
    },
  });

  return Object.freeze({
    list: (competition = 'all', options) => request(paths.list(competition), options),
    available: (competition = 'all', options) => request(paths.available(competition), options),
    save: payload => request('/api/v23.3/predictions', { method:'POST', body:payload }),
    rankings: (options = {}, requestOptions) => request(paths.rankings(options), requestOptions),
    rankingMe: options => request('/api/v23.3/rankings/me', options),
    prefetchAvailable: (competition = 'all') => request(paths.available(competition)).catch(() => null),
    invalidate: () => clearIdentityCache(base, auth),
  });
}
