import {
  assertApiAction,
  errorFromEnvelope,
  isErrorEnvelope,
  isSuccessEnvelope,
  normalizedApiError,
} from './contracts.mjs';

function validatedEndpoint(value) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('ciao_api_url_missing');
  let url;
  try { url = new URL(raw); }
  catch { throw new Error('ciao_api_url_invalid'); }
  if (url.protocol !== 'https:') throw new Error('ciao_api_url_https_required');
  if (!/^https:\/\//i.test(raw)) throw new Error('ciao_api_url_invalid');
  return url.href;
}

export function readApiUrl(documentRef = globalThis.document) {
  const meta = documentRef?.querySelector?.('meta[name="ciao-api-url"]');
  const content = meta?.getAttribute?.('content');
  return validatedEndpoint(content);
}

export function createApiClient({
  fetchImpl = globalThis.fetch,
  endpoint,
  getInitData = () => '',
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch_unavailable');
  if (typeof getInitData !== 'function') throw new Error('telegram_init_data_reader_required');
  const apiUrl = validatedEndpoint(endpoint);

  async function call(actionValue, payload = {}, { signal } = {}) {
    let action;
    try { action = assertApiAction(actionValue); }
    catch (error) { throw error; }

    const initData = String(getInitData() ?? '').trim();
    if (!initData) throw normalizedApiError('telegram_auth_required', 'Требуется авторизация Telegram', 401);

    let response;
    try {
      response = await fetchImpl(apiUrl, {
        method:'POST',
        headers:{
          'content-type':'application/json',
          'x-telegram-init-data':initData,
        },
        body:JSON.stringify({ action, ...(payload && typeof payload === 'object' ? payload : {}) }),
        signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw normalizedApiError('request_aborted', 'Запрос отменён', 0);
      throw normalizedApiError('network_error', 'Не удалось связаться с сервером', 0);
    }

    let body;
    try {
      body = await response.json();
    } catch {
      throw normalizedApiError('api_invalid_response', 'Некорректный ответ сервера', Number(response?.status) || 0);
    }

    if (isSuccessEnvelope(body) && response?.ok !== false) return body.data;
    if (isErrorEnvelope(body)) throw errorFromEnvelope(body, Number(response?.status) || 0);
    throw normalizedApiError('api_invalid_response', 'Некорректный ответ сервера', Number(response?.status) || 0);
  }

  return Object.freeze({ call });
}
