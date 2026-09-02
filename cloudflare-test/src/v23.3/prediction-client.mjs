function text(value) {
  return String(value ?? '').trim();
}

function clientError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

export function createPredictionClient({
  fetchImpl = globalThis.fetch,
  initData,
  origin,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Prediction fetch implementation is required');
  const base = text(origin) || globalThis.location?.origin || 'https://ciao-web-app-test.ciao-web.workers.dev';
  const auth = text(initData);

  async function request(path, { method = 'GET', body } = {}) {
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

  return Object.freeze({
    list: (competition = 'all') => request(`/api/v23.3/predictions?${new URLSearchParams({ competition })}`),
    available: (competition = 'all') => request(`/api/v23.3/predictions/available?${new URLSearchParams({ competition })}`),
    save: payload => request('/api/v23.3/predictions', { method:'POST', body:payload }),
    rankings: ({ scope = 'overall', competition } = {}) => {
      const params = new URLSearchParams({ scope });
      if (scope === 'competition' && competition) params.set('competition', competition);
      return request(`/api/v23.3/rankings?${params}`);
    },
    rankingMe: () => request('/api/v23.3/rankings/me'),
  });
}
