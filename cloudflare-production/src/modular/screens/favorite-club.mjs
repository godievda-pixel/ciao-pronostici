import { selectNearestClubMatch } from '../data/selectors.mjs';
import { renderMatchCard } from '../ui/match-card.mjs';
import { renderEmptyState } from '../ui/empty-state.mjs';

export function renderFavoriteClub({favoriteClub,matches=[],now=new Date()}={}){
  const nearest=favoriteClub?selectNearestClubMatch(matches,favoriteClub,now):null;
  return `<section class="ciao-favorite-next"><div class="ciao-screen-title"><div><span>Любимый клуб</span><h3>Предстоящий матч</h3></div></div>${nearest?renderMatchCard(nearest,{variant:'favorite'}):renderEmptyState('Ближайший матч пока не определён')}</section>`;
}
