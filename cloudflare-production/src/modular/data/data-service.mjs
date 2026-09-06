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

export function createDataService({ apiClient, coreUrl } = {}) {
  if (!apiClient?.post) throw new Error('api_client_required');
  if (!coreUrl) throw new Error('core_url_required');

  const core = (action, payload = {}) => apiClient.post(coreUrl, { action, ...payload });

  async function loadMatches({ competition, from = '', to = '', force = false } = {}) {
    const value = await core('modular_matches', { competition, from, to, ...(force ? { force:true } : {}) });
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
      return core('modular_standings', { competition, ...(force ? { force:true } : {}) });
    },
    loadFavoriteClub({ force = false } = {}) {
      return core('modular_favorite', { ...(force ? { force:true } : {}) });
    },
    loadPredictions({ mode = 'predictions', competition = '', force = false } = {}) {
      return core('modular_predictions', { mode, competition, ...(force ? { force:true } : {}) });
    },
    savePredictions(payload = {}) {
      return core('modular_save_predictions', payload);
    },
    loadRanking({ scope = 'all', force = false } = {}) {
      return core('modular_ranking', { scope, ...(force ? { force:true } : {}) });
    },
    loadMatchCenter({ competition, matchId, section = 'overview', force = false } = {}) {
      return core('modular_match_center', { competition, match_id:matchId, section, ...(force ? { force:true } : {}) });
    },
  });
}
