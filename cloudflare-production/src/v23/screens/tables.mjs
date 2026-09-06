import { escapeHtml } from '../ui/html.mjs';

export const TABLE_COMPETITIONS = Object.freeze([
  Object.freeze({id:'serie_a', label:'Серия А'}),
  Object.freeze({id:'ucl', label:'Лига чемпионов'}),
  Object.freeze({id:'uel', label:'Лига Европы'}),
  Object.freeze({id:'uecl', label:'Лига конференций'}),
]);

function text(value) {
  return String(value ?? '').trim();
}

function competitionItem(value) {
  const id = text(value) || 'serie_a';
  const found = TABLE_COMPETITIONS.find(item => item.id === id);
  if (!found) throw new Error('table_competition_invalid');
  return found;
}

function numberLabel(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '—';
}

function teamName(row) {
  const name = text(row?.team?.nameRu);
  if (!name) throw new Error('team_name_ru_missing');
  return name;
}

export async function loadTable({api, competition = 'serie_a'} = {}) {
  if (!api?.call) throw new Error('tables_api_required');
  const selected = competitionItem(competition);
  const data = await api.call('standings', {competition:selected.id});
  return {
    competition:selected.id,
    competitionNameRu:text(data?.competitionNameRu) || selected.label,
    rows:Array.isArray(data?.rows) ? data.rows : [],
  };
}

function renderCompetitionSwitch(active) {
  return `<div class="table-competitions" role="tablist">${TABLE_COMPETITIONS.map(item => `<button type="button" class="table-competitions__item${item.id === active ? ' is-active' : ''}" data-action="table-competition" data-competition="${item.id}" role="tab" aria-selected="${item.id === active ? 'true' : 'false'}">${escapeHtml(item.label)}</button>`).join('')}</div>`;
}

function renderRow(row = {}) {
  const name = teamName(row);
  return `<div class="standings-row"><span class="standings-row__position">${escapeHtml(numberLabel(row.position))}</span><strong class="standings-row__team">${escapeHtml(name)}</strong><span>${escapeHtml(numberLabel(row.played))}</span><span>${escapeHtml(numberLabel(row.wins))}</span><span>${escapeHtml(numberLabel(row.draws))}</span><span>${escapeHtml(numberLabel(row.losses))}</span><span>${escapeHtml(numberLabel(row.goalDifference))}</span><strong class="standings-row__points">${escapeHtml(numberLabel(row.points))}</strong></div>`;
}

export function renderTables(model = {}) {
  const selected = competitionItem(model.competition ?? 'serie_a');
  const rows = Array.isArray(model.rows) ? model.rows : [];
  const body = rows.length
    ? `<div class="standings"><div class="standings-row standings-row--head" aria-hidden="true"><span>#</span><span>Команда</span><span>И</span><span>В</span><span>Н</span><span>П</span><span>РМ</span><span>О</span></div>${rows.map(renderRow).join('')}</div>`
    : '<div class="status-state" data-state="empty">Таблица пока недоступна</div>';
  return `<section class="screen-stack" data-screen="tables" data-competition="${escapeHtml(selected.id)}">${renderCompetitionSwitch(selected.id)}<div class="screen-section__head"><h1 class="screen-section__title">${escapeHtml(model.competitionNameRu || selected.label)}</h1></div>${body}</section>`;
}
