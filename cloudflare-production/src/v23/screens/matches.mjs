import { toUiMatch } from '../data/selectors.mjs';
import { escapeHtml } from '../ui/html.mjs';
import { renderMatchCard } from '../ui/match-card.mjs';
import { renderTournamentCard } from '../ui/tournament-card.mjs';

export const MATCH_COMPETITIONS = Object.freeze([
  Object.freeze({id:'serie_a', label:'Серия А', subtitleRu:'Чемпионат Италии'}),
  Object.freeze({id:'coppa_italia', label:'Кубок Италии', subtitleRu:'С 1/8 финала'}),
  Object.freeze({id:'ucl', label:'Лига чемпионов', subtitleRu:'Матчи итальянских клубов'}),
  Object.freeze({id:'uel', label:'Лига Европы', subtitleRu:'Матчи итальянских клубов'}),
  Object.freeze({id:'uecl', label:'Лига конференций', subtitleRu:'Матчи итальянских клубов'}),
]);

const EUROPE = new Set(['ucl','uel','uecl']);

function text(value) {
  return String(value ?? '').trim();
}

function competitionItem(value) {
  const id = text(value);
  const found = MATCH_COMPETITIONS.find(item => item.id === id);
  if (!found) throw new Error('matches_competition_invalid');
  return found;
}

function eligibleMatch(row, competition) {
  if (!row || row.isQualification === true) return false;
  if (EUROPE.has(competition)) return row.isItalianRelevant === true;
  return true;
}

function groupLabel(match, competition) {
  if (competition === 'serie_a') {
    const round = Number(match.round);
    if (Number.isInteger(round) && round > 0) return `${round} тур`;
  }
  return text(match.stageNameRu) || text(match.competitionNameRu);
}

function groupMatches(items, competition) {
  const groups = [];
  const byLabel = new Map();
  for (const item of items) {
    const label = groupLabel(item, competition) || 'Матчи';
    let group = byLabel.get(label);
    if (!group) {
      group = {label, items:[]};
      byLabel.set(label, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export async function loadMatches({
  api,
  competition,
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
} = {}) {
  if (!api?.call) throw new Error('matches_api_required');
  const selected = competitionItem(competition);
  const raw = await api.call('matches', {competition:selected.id});
  const source = Array.isArray(raw) ? raw : [];
  const items = source
    .filter(row => eligibleMatch(row, selected.id))
    .map(row => toUiMatch(row, {now,timeZone}))
    .sort((left,right) => Date.parse(left.kickoffAt || 0) - Date.parse(right.kickoffAt || 0));

  return {
    competition:selected.id,
    competitionNameRu:selected.label,
    items,
    groups:groupMatches(items, selected.id),
  };
}

function renderLanding() {
  return `<section class="screen-stack" data-screen="matches"><div class="screen-section"><div class="screen-section__head"><h1 class="screen-section__title">Матчи</h1></div><div class="screen-grid">${MATCH_COMPETITIONS.map(item => renderTournamentCard({id:item.id,nameRu:item.label,subtitleRu:item.subtitleRu})).join('')}</div></div></section>`;
}

function renderGroup(group) {
  return `<section class="screen-section matches-group"><div class="screen-section__head"><h2 class="screen-section__title">${escapeHtml(group.label)}</h2></div><div class="screen-grid">${group.items.map(item => renderMatchCard(item,{timeLabel:item.timeLabel})).join('')}</div></section>`;
}

export function renderMatches(model = {}) {
  if (!model.competition) return renderLanding();
  const selected = competitionItem(model.competition);
  const groups = Array.isArray(model.groups) ? model.groups : [];
  const content = groups.length
    ? groups.map(renderGroup).join('')
    : '<div class="status-state" data-state="empty">Матчей пока нет</div>';
  return `<section class="screen-stack" data-screen="matches" data-competition="${escapeHtml(selected.id)}"><div class="screen-section__head"><h1 class="screen-section__title">${escapeHtml(model.competitionNameRu || selected.label)}</h1></div>${content}</section>`;
}
