import { getTournament } from '../core/tournament-registry.mjs';

function text(value){return String(value??'').trim()}
function esc(value){return text(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

export function renderTournamentCard(tournamentId,{active=false}={}){
  const tournament=getTournament(tournamentId);
  return `<button type="button" class="ciao-tournament-card theme-${esc(tournament.theme)}${active?' is-active':''}" data-ciao-tournament="${esc(tournament.id)}" style="--ciao-tournament-accent:${esc(tournament.colors.accent)};--ciao-tournament-surface:${esc(tournament.colors.surface)};--ciao-tournament-glow:${esc(tournament.colors.glow)}"><span class="ciao-tournament-kicker">Турнир</span><strong>${esc(tournament.label)}</strong><span class="ciao-tournament-action">Матчи →</span></button>`;
}
