import { escapeHtml } from './html.mjs';

function teamName(team, side) {
  const value = String(team?.nameRu ?? '').trim();
  if (!value) throw new Error(`match_${side}_team_name_ru_missing`);
  return value;
}

function scoreValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function renderMatchCard(match = {}, { timeLabel = '' } = {}) {
  const id = String(match?.id ?? '').trim();
  if (!id) throw new Error('match_id_missing');
  const home = teamName(match.homeTeam, 'home');
  const away = teamName(match.awayTeam, 'away');
  const competition = String(match?.competitionNameRu ?? '').trim();
  const stage = String(match?.stageNameRu ?? '').trim();
  const status = String(match?.statusRu ?? '').trim();
  const homeScore = scoreValue(match?.score?.home);
  const awayScore = scoreValue(match?.score?.away);
  const score = homeScore !== null && awayScore !== null
    ? `<span class="match-card__score" aria-label="Счёт ${homeScore}:${awayScore}">${homeScore} — ${awayScore}</span>`
    : '<span class="match-card__score match-card__score--pending">—</span>';
  const meta = [competition, stage, timeLabel, status].filter(Boolean).map(item => escapeHtml(item)).join(' · ');

  return `<button type="button" class="match-card" data-component="match-card" data-action="open-match" data-match-id="${escapeHtml(id)}"><span class="match-card__meta">${meta}</span><span class="match-card__teams"><span class="match-card__team"><span class="match-card__team-name">${escapeHtml(home)}</span></span>${score}<span class="match-card__team match-card__team--away"><span class="match-card__team-name">${escapeHtml(away)}</span></span></span></button>`;
}
