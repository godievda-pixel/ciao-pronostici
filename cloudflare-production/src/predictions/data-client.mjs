const CORE_API = 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-core-api-fast-v4';
const EXTERNAL_API = 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-external-predictions';

function defaultInitData() {
  return globalThis.Telegram?.WebApp?.initData ?? '';
}

async function postJson(fetchImpl, getInitData, url, body) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-init-data': String(getInitData() || ''),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(String(payload?.error || `HTTP ${response.status}`));
  }
  return payload?.data ?? payload;
}

export function createPredictionsDataClient({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  getInitData = defaultInitData,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation required');
  if (typeof getInitData !== 'function') throw new TypeError('getInitData function required');

  return Object.freeze({
    loadSerieAState(round) {
      const value = Number(round);
      return postJson(fetchImpl, getInitData, CORE_API, {
        action: 'state',
        ...(Number.isInteger(value) && value > 0 ? { round: value } : {}),
      });
    },

    saveSerieAPredictions(round, predictions) {
      const value = Number(round);
      if (!Number.isInteger(value) || value <= 0) throw new TypeError('valid Serie A round required');
      return postJson(fetchImpl, getInitData, CORE_API, {
        action: 'save_predictions',
        round: value,
        predictions: Array.isArray(predictions) ? predictions : [],
      });
    },

    loadExternalState(competition) {
      return postJson(fetchImpl, getInitData, EXTERNAL_API, {
        action: 'state',
        competition: String(competition || ''),
      });
    },

    saveExternalPredictions(competition, predictions) {
      return postJson(fetchImpl, getInitData, EXTERNAL_API, {
        action: 'save_predictions',
        competition: String(competition || ''),
        predictions: Array.isArray(predictions) ? predictions : [],
      });
    },
  });
}

export const PREDICTIONS_ENDPOINTS = Object.freeze({
  core: CORE_API,
  external: EXTERNAL_API,
});
