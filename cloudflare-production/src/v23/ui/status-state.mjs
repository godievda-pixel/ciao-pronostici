import { escapeHtml } from './html.mjs';

const DEFAULTS = Object.freeze({
  loading:'Загрузка…',
  error:'Не удалось обновить',
  empty:'Пока ничего нет',
});

export function renderStatusState(state, { message = '' } = {}) {
  const key = String(state ?? '').trim();
  if (!Object.hasOwn(DEFAULTS, key)) throw new Error(`status_state_invalid:${key}`);
  const text = String(message || DEFAULTS[key]).trim();
  const spinner = key === 'loading' ? '<span class="status-state__spinner" aria-hidden="true"></span>' : '';
  return `<div class="status-state status-state--${escapeHtml(key)}" data-state="${escapeHtml(key)}" role="status">${spinner}<span class="status-state__message">${escapeHtml(text)}</span></div>`;
}
