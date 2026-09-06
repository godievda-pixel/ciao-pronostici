import { TOURNAMENT_IDS } from '../core/tournament-registry.mjs';
import { normalizeMatch } from './match-normalizer.mjs';

function rows(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.matches)) return value.matches;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function normalizeMatches(value, competition) {
  return rows(value).map(match => normalizeMatch(match, competition));
}

export function createDataService({ apiClient }) {
  if (!apiClient?.get) throw new Error('api_client_required');

  async function loadMatches({ competition, from = '', to = '', force = false } = {}) {
    const value = await apiClient.get('/api/modular/matches', { competition, from, to }, { force });
    return normalizeMatches(value, competition);
  }

  async function loadAllMatches({ from = '', to = '', force = false } = {}) {
    const settled = await Promise.allSettled(TOURNAMENT_IDS.map(competition => (
      loadMatches({ competition, from, to, force }).then(matches => ({ competition, matches }))
    )));
    const matches = [];
    const errors = [];
    settled.forEach((result, index) => {
      const competition = TOURNAMENT_IDS[index];
      if (result.status === 'fulfilled') matches.push(...result.value.matches);
      else errors.push({ competition, error:result.reason });
    });
    matches.sort((a, b) => Date.parse(a.kickoffAt || '') - Date.parse(b.kickoffAt || ''));
    return { matches, errors };
  }

  return Object.freeze({
    loadMatches,
    loadAllMatches,
    loadStandings(competition, { force = false } = {}) {
      return apiClient.get('/api/modular/standings', { competition }, { force });
    },
    loadFavoriteClub({ force = false } = {}) {
      return apiClient.get('/api/modular/favorite', {}, { force });
    },
    loadPredictions({ mode = 'predictions', competition = '', force = false } = {}) {
      return apiClient.get('/api/modular/predictions', { mode, competition }, { force });
    },
    loadRanking({ scope = 'all', force = false } = {}) {
      return apiClient.get('/api/modular/ranking', { scope }, { force });
    },
    loadMatchCenter({ competition, matchId, section = 'overview', force = false } = {}) {
      return apiClient.get('/api/modular/match-center', { competition, match_id:matchId, section }, { force });
    },
  });
}
