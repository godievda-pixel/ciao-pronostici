import { pointsLabel } from '../locale/ru.mjs';
import { escapeHtml } from '../ui/html.mjs';

export const RANKING_SCOPES = Object.freeze([
  Object.freeze({id:'all', label:'Все'}),
  Object.freeze({id:'italy', label:'Италия'}),
  Object.freeze({id:'europe', label:'Еврокубки'}),
]);

function text(value) {
  return String(value ?? '').trim();
}

function assertScope(value) {
  const scope = text(value) || 'all';
  if (!RANKING_SCOPES.some(item => item.id === scope)) throw new Error('ranking_scope_invalid');
  return scope;
}

function pointsValue(value) {
  const points = Number(value);
  return Number.isFinite(points) ? points : 0;
}

export async function loadRanking({api, scope = 'all'} = {}) {
  if (!api?.call) throw new Error('ranking_api_required');
  const selectedScope = assertScope(scope);
  const data = await api.call('ranking', {scope:selectedScope});
  return {
    scope:selectedScope,
    rows:Array.isArray(data?.rows) ? data.rows : [],
  };
}

function renderScopeTabs(active) {
  return `<div class="ranking-scopes" role="tablist">${RANKING_SCOPES.map(item => `<button type="button" class="ranking-scopes__item${item.id === active ? ' is-active' : ''}" data-action="ranking-scope" data-scope="${item.id}" role="tab" aria-selected="${item.id === active ? 'true' : 'false'}">${escapeHtml(item.label)}</button>`).join('')}</div>`;
}

function renderRow(row = {}) {
  const rank = Number(row.rank);
  const displayRank = Number.isInteger(rank) && rank > 0 ? rank : '—';
  const displayName = text(row.displayName) || 'Участник';
  const username = text(row.username).replace(/^@/, '');
  const current = row.isCurrent === true;
  const podium = Number.isInteger(rank) && rank >= 1 && rank <= 3 ? ` ranking-row--top-${rank}` : '';
  return `<div class="ranking-row${current ? ' ranking-row--current' : ''}${podium}" data-rank="${escapeHtml(displayRank)}"${current ? ' data-current-user="true"' : ''}><span class="ranking-row__position">${escapeHtml(displayRank)}</span><span class="ranking-row__identity"><strong class="ranking-row__name">${escapeHtml(displayName)}</strong>${username ? `<span class="ranking-row__username">@${escapeHtml(username)}</span>` : ''}</span><strong class="ranking-row__points">${escapeHtml(pointsLabel(pointsValue(row.points)))}</strong></div>`;
}

export function renderRanking(model = {}) {
  const scope = assertScope(model.scope ?? 'all');
  const rows = Array.isArray(model.rows) ? model.rows : [];
  const content = rows.length
    ? `<div class="ranking-list">${rows.map(renderRow).join('')}</div>`
    : '<div class="status-state" data-state="empty">Рейтинг пока пуст</div>';
  return `<section class="screen-stack" data-screen="ranking">${renderScopeTabs(scope)}${content}</section>`;
}
