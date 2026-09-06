export const API_VERSION = 23;

export const API_ACTIONS = Object.freeze([
  'bootstrap',
  'matches',
  'calcio_today',
  'favorite_next_match',
  'standings',
  'match_center',
  'predictions_available',
  'predictions_mine',
  'prediction_save',
  'ranking',
  'profile',
  'favorite_set',
  'settings_update',
]);

const ACTION_SET = new Set(API_ACTIONS);
const text = value => String(value ?? '').trim();

export function assertApiAction(action) {
  const value = text(action);
  if (!ACTION_SET.has(value)) throw normalizedApiError('unknown_action', 'Неизвестный запрос', 400);
  return value;
}

export function isSuccessEnvelope(payload) {
  return !!payload
    && typeof payload === 'object'
    && payload.ok === true
    && Object.prototype.hasOwnProperty.call(payload, 'data')
    && !!payload.meta
    && typeof payload.meta === 'object'
    && Number(payload.meta.apiVersion) === API_VERSION;
}

export function isErrorEnvelope(payload) {
  return !!payload
    && typeof payload === 'object'
    && payload.ok === false
    && !!payload.error
    && typeof payload.error === 'object'
    && !!text(payload.error.code);
}

export function normalizedApiError(code, message, status = 0) {
  const numericStatus = Number(status);
  return Object.freeze({
    code:text(code) || 'api_error',
    message:text(message) || 'Не удалось выполнить запрос',
    status:Number.isInteger(numericStatus) ? numericStatus : 0,
  });
}

export function errorFromEnvelope(payload, status = 0) {
  if (!isErrorEnvelope(payload)) return normalizedApiError('api_invalid_response', 'Некорректный ответ сервера', status);
  return normalizedApiError(payload.error.code, payload.error.message, status);
}
