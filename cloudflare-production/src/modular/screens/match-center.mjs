import { getTournament } from '../core/tournament-registry.mjs';

export const MATCH_CENTER_TABS = Object.freeze([
  Object.freeze(['overview','Обзор']),
  Object.freeze(['stats','Статистика']),
  Object.freeze(['events','События']),
  Object.freeze(['lineups','Составы']),
  Object.freeze(['players','Игроки']),
]);

const TAB_IDS = new Set(MATCH_CENTER_TABS.map(([id]) => id));
function text(value) { return String(value ?? '').trim(); }
function esc(value) { return text(value).replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char])); }

function sectionBody(value, error) {
  if (error) return `<div class="ciao-mc-error"><b>Раздел временно недоступен</b><span>${esc(error.message || error)}</span></div>`;
  if (!value) return '<div class="ciao-mc-loading">Загружаем данные матча…</div>';
  const title = text(value?.title || value?.label || value?.match?.title);
  const note = text(value?.note || value?.summary || value?.status_text);
  return `<div class="ciao-mc-section-card">${title ? `<b>${esc(title)}</b>` : ''}${note ? `<span>${esc(note)}</span>` : ''}</div>`;
}

export function renderMatchCenter({
  competition,
  matchId,
  activeTab = 'overview',
  sections = {},
  sectionErrors = {},
} = {}) {
  const tournament = getTournament(competition);
  const tab = TAB_IDS.has(activeTab) ? activeTab : 'overview';
  const tabs = MATCH_CENTER_TABS.map(([id,label]) => (
    `<button type="button" class="ciao-mc-tab${id === tab ? ' is-active' : ''}" data-ciao-mc-tab="${id}">${label}</button>`
  )).join('');
  return `<section class="ciao-match-center theme-${esc(tournament.theme)}" data-tournament="${esc(tournament.id)}" data-match-id="${esc(matchId)}" style="--ciao-tournament-accent:${esc(tournament.colors.accent)};--ciao-tournament-surface:${esc(tournament.colors.surface)};--ciao-tournament-glow:${esc(tournament.colors.glow)}">
    <div class="ciao-mc-toolbar"><button type="button" class="ciao-mc-back" data-ciao-mc-back aria-label="Назад">‹</button><div><span>${esc(tournament.label)}</span><b>Матч-центр</b></div></div>
    <div class="ciao-mc-tabs" role="tablist">${tabs}</div>
    <div class="ciao-mc-body" data-ciao-mc-section="${tab}">${sectionBody(sections[tab], sectionErrors[tab])}</div>
  </section>`;
}

export function createMatchCenterController({ router, dataService, render }) {
  if (!router?.back) throw new Error('router_required');
  if (!dataService?.loadMatchCenter) throw new Error('match_center_data_service_required');
  if (typeof render !== 'function') throw new Error('match_center_render_required');
  const state = {
    competition:'', matchId:'', activeTab:'overview', sections:{}, sectionErrors:{}, loading:false,
  };

  function snapshot() {
    return Object.freeze({
      competition:state.competition,
      matchId:state.matchId,
      activeTab:state.activeTab,
      sections:Object.freeze({ ...state.sections }),
      sectionErrors:Object.freeze({ ...state.sectionErrors }),
      loading:state.loading,
    });
  }

  function emit() {
    const value = snapshot();
    render(value, renderMatchCenter(value));
    return value;
  }

  async function loadSection(section, { force = false } = {}) {
    if (!TAB_IDS.has(section)) throw new Error(`invalid_match_center_tab:${section}`);
    state.activeTab = section;
    state.loading = true;
    emit();
    try {
      const value = await dataService.loadMatchCenter({
        competition:state.competition,
        matchId:state.matchId,
        section,
        force,
      });
      state.sections = { ...state.sections, [section]:value };
      const nextErrors = { ...state.sectionErrors };
      delete nextErrors[section];
      state.sectionErrors = nextErrors;
    } catch (error) {
      state.sectionErrors = { ...state.sectionErrors, [section]:error instanceof Error ? error : new Error(String(error)) };
    } finally {
      state.loading = false;
      emit();
    }
    return snapshot();
  }

  return Object.freeze({
    async open({ competition, matchId }) {
      getTournament(competition);
      state.competition = competition;
      state.matchId = text(matchId);
      state.activeTab = 'overview';
      state.sections = {};
      state.sectionErrors = {};
      return loadSection('overview');
    },
    selectTab(section, options) { return loadSection(section, options); },
    back() { return router.back(); },
    state: snapshot,
  });
}
