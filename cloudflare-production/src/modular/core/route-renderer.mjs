import { createSerieAClubIndex } from '../data/selectors.mjs';
import { renderFavoriteClub } from '../screens/favorite-club.mjs';
import { renderCalcioToday } from '../screens/calcio-today.mjs';
import { renderPredictionsScreen } from '../screens/predictions.mjs';
import { renderRankingScreen } from '../screens/ranking.mjs';
import { renderMatchesScreen } from '../screens/matches.mjs';
import { normalizeStandingRows, renderTablesScreen, TABLE_TOURNAMENTS } from '../screens/tables.mjs';
import { renderMatchCenter } from '../screens/match-center.mjs';

const PREDICTION_MODES = new Set(['predictions','mine']);
const RANKING_SCOPES = new Set(['all','italy','europe']);
const MATCH_CENTER_TABS = new Set(['overview','stats','events','lineups','players']);

function text(value) { return String(value ?? '').trim(); }

function rows(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.standings)) return value.standings;
  return [];
}

async function serieAClubIndex(dataService) {
  const value = await dataService.loadStandings('serie_a');
  return createSerieAClubIndex(normalizeStandingRows(value));
}

export async function renderModularRoute(route = {}, { dataService, now = new Date() } = {}) {
  if (!dataService) throw new Error('route_data_service_required');
  const screen = text(route.screen);

  if (screen === 'home') {
    const [favoriteClub, result, clubIndex] = await Promise.all([
      dataService.loadFavoriteClub(),
      dataService.loadAllMatches({}),
      serieAClubIndex(dataService),
    ]);
    const matches = result?.matches || [];
    return renderFavoriteClub({ favoriteClub, matches, now })
      + renderCalcioToday({ matches, clubIndex, now });
  }

  if (screen === 'favorite') {
    const [favoriteClub, result] = await Promise.all([
      dataService.loadFavoriteClub(),
      dataService.loadAllMatches({}),
    ]);
    return renderFavoriteClub({ favoriteClub, matches:result?.matches || [], now });
  }

  if (screen === 'calcio') {
    const [result, clubIndex] = await Promise.all([
      dataService.loadAllMatches({}),
      serieAClubIndex(dataService),
    ]);
    return renderCalcioToday({ matches:result?.matches || [], clubIndex, now });
  }

  if (screen === 'predictions') {
    const mode = PREDICTION_MODES.has(text(route.subview)) ? text(route.subview) : 'predictions';
    const data = await dataService.loadPredictions({ mode });
    return renderPredictionsScreen({ mode, data });
  }

  if (screen === 'ranking') {
    const scope = RANKING_SCOPES.has(text(route.subview)) ? text(route.subview) : 'all';
    const value = await dataService.loadRanking({ scope });
    return renderRankingScreen({ scope, rows:rows(value) });
  }

  if (screen === 'matches') {
    const tournament = text(route.tournament);
    if (!tournament) return renderMatchesScreen({ tournament:'', matches:[], clubIndex:new Set() });
    const [result, clubIndex] = await Promise.all([
      dataService.loadAllMatches({}),
      serieAClubIndex(dataService),
    ]);
    return renderMatchesScreen({ tournament, matches:result?.matches || [], clubIndex });
  }

  if (screen === 'tables') {
    const tournament = TABLE_TOURNAMENTS.includes(text(route.tournament)) ? text(route.tournament) : 'serie_a';
    const value = await dataService.loadStandings(tournament);
    return renderTablesScreen({ tournament, rows:normalizeStandingRows(value) });
  }

  if (screen === 'match-center') {
    const competition = text(route.tournament || route.competition);
    const matchId = text(route.matchId || route.match_id);
    const activeTab = MATCH_CENTER_TABS.has(text(route.subview)) ? text(route.subview) : 'overview';
    const value = await dataService.loadMatchCenter({ competition, matchId, section:activeTab });
    return renderMatchCenter({ competition, matchId, activeTab, sections:{ [activeTab]:value } });
  }

  throw new Error(`unsupported_modular_screen:${screen}`);
}
