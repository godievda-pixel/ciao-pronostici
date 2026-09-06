import { TOURNAMENT_IDS, getTournament, isTournamentSupported } from '../core/tournament-registry.mjs';
import { selectCompetitionFixtures } from '../data/selectors.mjs';
import { renderMatchCard } from '../ui/match-card.mjs';
import { renderTournamentCard } from '../ui/tournament-card.mjs';

function text(value){return String(value??'').trim()}
function esc(value){return text(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

export function renderMatchesScreen({tournament='',matches=[],clubIndex=new Set()}={}){
  const selected=isTournamentSupported(tournament)?String(tournament):'';
  const entries=TOURNAMENT_IDS.map(id=>renderTournamentCard(id,{active:id===selected})).join('');
  if(!selected){
    return `<section class="ciao-matches-screen"><div class="ciao-matches-head"><span>Все турниры</span><h2>Матчи</h2></div><div class="ciao-tournament-grid">${entries}</div></section>`;
  }
  const config=getTournament(selected);
  const fixtures=selectCompetitionFixtures(matches,selected,clubIndex);
  const body=fixtures.length
    ? fixtures.map(match=>renderMatchCard(match,{variant:'fixture'})).join('')
    : `<div class="ciao-matches-empty">Матчей пока нет</div>`;
  return `<section class="ciao-matches-screen theme-${esc(config.theme)}" style="--ciao-matches-accent:${esc(config.colors.accent)};--ciao-matches-surface:${esc(config.colors.surface)}"><div class="ciao-matches-head"><span>Выберите турнир</span><h2>Матчи</h2></div><div class="ciao-tournament-grid">${entries}</div><div class="ciao-fixture-head"><span>${esc(config.shortLabel)}</span><strong>${esc(config.label)}</strong></div><div class="ciao-fixture-list">${body}</div></section>`;
}

export function handleMatchesScreenClick(event,{router}={}){
  const tournamentButton=event?.target?.closest?.('[data-ciao-tournament]');
  if(tournamentButton){
    const tournament=text(tournamentButton.dataset?.ciaoTournament);
    if(!isTournamentSupported(tournament))return false;
    router?.navigate?.({screen:'matches',tournament});
    return true;
  }
  const matchButton=event?.target?.closest?.('[data-ciao-match-id]');
  if(matchButton){
    const competition=text(matchButton.dataset?.ciaoCompetition);
    const matchId=text(matchButton.dataset?.ciaoMatchId);
    if(!competition||!matchId)return false;
    router?.openMatchCenter?.({competition,matchId});
    return true;
  }
  return false;
}

export function bindMatchesScreen(root,{router}={}){
  if(!root?.addEventListener)return ()=>{};
  const listener=event=>handleMatchesScreenClick(event,{router});
  root.addEventListener('click',listener);
  return ()=>root.removeEventListener?.('click',listener);
}
