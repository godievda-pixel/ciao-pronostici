import { escapeHtml, safeHttpUrl } from './html.mjs';

export function renderTeamBadge(team = {}, { compact = false } = {}) {
  const name = String(team?.nameRu ?? '').trim();
  if (!name) throw new Error('team_name_ru_missing');
  const logo = safeHttpUrl(team?.logoUrl ?? team?.logo);
  const media = logo
    ? `<img class="team-badge__logo" src="${escapeHtml(logo)}" alt="" loading="lazy">`
    : `<span class="team-badge__fallback" aria-hidden="true">${escapeHtml(name.slice(0, 1).toUpperCase())}</span>`;
  return `<span class="team-badge${compact ? ' team-badge--compact' : ''}" data-component="team-badge">${media}<span class="team-badge__name">${escapeHtml(name)}</span></span>`;
}
