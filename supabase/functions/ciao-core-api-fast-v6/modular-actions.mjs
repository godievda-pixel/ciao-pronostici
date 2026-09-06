import {
  MODULAR_COMPETITIONS,
  isExternalPredictionCompetition,
  normalizeCanonicalMatchId,
  rankingCompetitions,
} from './modular-domain.mjs';

export const MODULAR_ACTION_NAMES = Object.freeze([
  'modular_matches',
  'modular_standings',
  'modular_favorite',
  'modular_predictions',
  'modular_save_predictions',
  'modular_ranking',
  'modular_match_center',
]);

const MODULAR_ACTION_SET = new Set(MODULAR_ACTION_NAMES);
const PREDICTION_MODES = new Set(['predictions', 'mine']);
const MATCH_CENTER_SECTIONS = new Set(['overview', 'stats', 'events', 'lineups', 'players']);

function text(value) {
  return String(value ?? '').trim();
}

function competition(value, { optional = false } = {}) {
  const key = text(value).toLowerCase();
  if (!key && optional) return '';
  if (!MODULAR_COMPETITIONS.includes(key)) throw new Error(`invalid_competition:${key}`);
  return key;
}

function requireHandler(deps, name) {
  const handler = deps?.[name];
  if (typeof handler !== 'function') throw new Error(`modular_handler_missing:${name}`);
  return handler;
}

function predictionCompetition(body = {}) {
  const explicit = text(body.competition).toLowerCase();
  if (explicit) return competition(explicit);
  const items = Array.isArray(body.predictions) ? body.predictions : [];
  const prefixed = items
    .map(item => text(item?.match_id ?? item?.matchId))
    .map(id => id.includes(':') ? id.split(':', 1)[0].toLowerCase() : '')
    .filter(Boolean);
  if (!prefixed.length) return 'serie_a';
  const unique = [...new Set(prefixed.map(value => competition(value)))];
  if (unique.length !== 1) throw new Error('mixed_prediction_competitions');
  return unique[0];
}

function validateExternalPredictionPayload(body, key) {
  const items = Array.isArray(body?.predictions) ? body.predictions : [];
  if (!items.length) throw new Error('predictions_required');
  for (const item of items) {
    normalizeCanonicalMatchId(key, item?.match_id ?? item?.matchId);
  }
}

export function isModularAction(action) {
  return MODULAR_ACTION_SET.has(text(action));
}

export function createModularActionRouter(deps = {}) {
  return async function routeModularAction(actionValue, body = {}, context = {}) {
    const action = text(actionValue);
    if (!MODULAR_ACTION_SET.has(action)) throw new Error(`unknown_modular_action:${action}`);

    if (action === 'modular_matches') {
      const key = competition(body.competition);
      return await requireHandler(deps, 'loadMatches')({ ...body, competition:key }, context);
    }

    if (action === 'modular_standings') {
      const key = competition(body.competition);
      return await requireHandler(deps, 'loadStandings')({ ...body, competition:key }, context);
    }

    if (action === 'modular_favorite') {
      return await requireHandler(deps, 'loadFavorite')(body, context);
    }

    if (action === 'modular_predictions') {
      const mode = text(body.mode).toLowerCase() || 'predictions';
      if (!PREDICTION_MODES.has(mode)) throw new Error(`invalid_prediction_mode:${mode}`);
      const key = competition(body.competition, { optional:true });
      return await requireHandler(deps, 'loadPredictions')({ ...body, mode, competition:key }, context);
    }

    if (action === 'modular_save_predictions') {
      const key = predictionCompetition(body);
      if (isExternalPredictionCompetition(key)) {
        validateExternalPredictionPayload(body, key);
        return await requireHandler(deps, 'saveExternalPredictions')(body, context);
      }
      return await requireHandler(deps, 'saveSerieAPredictions')(body, context);
    }

    if (action === 'modular_ranking') {
      const scope = text(body.scope).toLowerCase() || 'all';
      rankingCompetitions(scope);
      return await requireHandler(deps, 'loadRanking')({ ...body, scope }, context);
    }

    const key = competition(body.competition);
    const matchId = normalizeCanonicalMatchId(key, body.match_id ?? body.matchId);
    const section = text(body.section).toLowerCase() || 'overview';
    if (!MATCH_CENTER_SECTIONS.has(section)) throw new Error(`invalid_match_center_section:${section}`);
    return await requireHandler(deps, 'loadMatchCenter')(
      { ...body, competition:key, match_id:matchId, section },
      context,
    );
  };
}
