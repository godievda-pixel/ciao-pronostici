import { escapeHtml } from './html.mjs';

export function renderTournamentCard(tournament = {}) {
  const id = String(tournament?.id ?? '').trim();
  const name = String(tournament?.nameRu ?? '').trim();
  if (!id) throw new Error('tournament_id_missing');
  if (!name) throw new Error('tournament_name_ru_missing');
  const subtitle = String(tournament?.subtitleRu ?? '').trim();
  return `<button type="button" class="tournament-card" data-component="tournament-card" data-action="open-tournament" data-competition="${escapeHtml(id)}"><span class="tournament-card__title">${escapeHtml(name)}</span>${subtitle ? `<span class="tournament-card__subtitle">${escapeHtml(subtitle)}</span>` : ''}<span class="tournament-card__arrow" aria-hidden="true">→</span></button>`;
}
