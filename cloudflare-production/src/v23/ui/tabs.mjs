import { escapeHtml } from './html.mjs';

export function renderTabs(items = [], active = '') {
  if (!Array.isArray(items) || !items.length) throw new Error('tabs_items_missing');
  const labels = items.map(item => String(item ?? '').trim()).filter(Boolean);
  if (!labels.length) throw new Error('tabs_items_missing');
  const selected = labels.includes(active) ? active : labels[0];
  const html = labels.map(label => `<button type="button" class="tabs__item${label === selected ? ' is-active' : ''}" role="tab" data-tab="${escapeHtml(label)}" aria-selected="${label === selected ? 'true' : 'false'}">${escapeHtml(label)}</button>`).join('');
  return `<div class="tabs" role="tablist">${html}</div>`;
}
