import {
  MATCH_CENTER_SECTIONS,
  normalizeCanonicalBase,
  normalizeCanonicalSection,
} from './match-center-contract.mjs';
import { createPredictionService } from './prediction-service.mjs';

const SUPPORTED_COMPETITIONS = new Set([
  'serie_a',
  'coppa_italia',
  'ucl',
  'uel',
  'uecl',
]);
const SECTION_SET = new Set(MATCH_CENTER_SECTIONS);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function assertTarget(competition, matchId) {
  const key = String(competition || '').trim();
  const id = String(matchId || '').trim();
  if (!SUPPORTED_COMPETITIONS.has(key)) throw fail('competition_not_supported');
  if (!id || !id.startsWith(`${key}:`) || !id.slice(key.length + 1).trim()) {
    throw fail('competition_match_mismatch');
  }
  return { competition:key, matchId:id };
}

function assertSection(section) {
  const key = String(section || '').trim().toLowerCase();
  if (!SECTION_SET.has(key)) throw fail('invalid_match_center_section');
  return key;
}

function unwrapMatch(payload) {
  if (payload?.match && typeof payload.match === 'object' && !Array.isArray(payload.match)) {
    return payload.match;
  }
  if (payload?.data?.match && typeof payload.data.match === 'object' && !Array.isArray(payload.data.match)) {
    return payload.data.match;
  }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) return payload;
  return {};
}

function unwrapSection(payload) {
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      && ('section' in payload.data || 'coverage' in payload.data || 'available' in payload.data)) {
    return payload.data;
  }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) return payload;
  return { available:false, data:null };
}

function requireLoader(loader, code) {
  if (typeof loader !== 'function') throw fail(code);
  return loader;
}

function integerOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function savedPredictionForMatch(rows, matchId) {
  const row = (Array.isArray(rows) ? rows : []).find(item => String(item?.match_id || '') === matchId);
  if (!row) return null;
  const homeScore = integerOrNull(row.predicted_home ?? row.home_score);
  const awayScore = integerOrNull(row.predicted_away ?? row.away_score);
  if (homeScore === null || awayScore === null) return null;
  const prediction = { homeScore, awayScore, kind:'user' };
  if (row.points !== null && row.points !== undefined && row.points !== '') {
    const points = Number(row.points);
    if (Number.isFinite(points)) prediction.points = points;
  }
  return Object.freeze(prediction);
}

export async function loadAuthoritativeUserPrediction({ request, env, competition, matchId } = {}) {
  if (!env?.PREDICTION_LEAGUE) return null;
  try {
    const service = createPredictionService({ request, env, now:new Date() });
    const rows = await service.list(competition);
    return savedPredictionForMatch(rows, matchId);
  } catch {
    return null;
  }
}

export function createMatchCenterProviders({
  loadSerieABase,
  loadSerieASection,
  loadExternalBase,
  loadExternalSection,
  loadUserPrediction = loadAuthoritativeUserPrediction,
} = {}) {
  async function loadBase({ competition, matchId, ...context } = {}) {
    const target = assertTarget(competition, matchId);
    const loader = target.competition === 'serie_a'
      ? requireLoader(loadSerieABase, 'serie_a_provider_unavailable')
      : requireLoader(loadExternalBase, 'external_provider_unavailable');
    const payload = await loader({ ...context, ...target });
    return normalizeCanonicalBase(unwrapMatch(payload), target.competition, target.matchId);
  }

  async function loadSection({ competition, matchId, section, ...context } = {}) {
    const target = assertTarget(competition, matchId);
    const canonicalSection = assertSection(section);
    const loader = target.competition === 'serie_a'
      ? requireLoader(loadSerieASection, 'serie_a_provider_unavailable')
      : requireLoader(loadExternalSection, 'external_provider_unavailable');
    const payload = await loader({ ...context, ...target, section:canonicalSection });
    const normalized = normalizeCanonicalSection(canonicalSection, unwrapSection(payload));
    if (canonicalSection !== 'overview' || normalized?.available === false || !normalized?.data) return normalized;

    let prediction = null;
    try {
      prediction = await loadUserPrediction({ ...context, ...target });
    } catch {}
    if (!prediction) return normalized;

    return Object.freeze({
      ...normalized,
      data:Object.freeze({ ...normalized.data, prediction }),
    });
  }

  return Object.freeze({ loadBase, loadSection });
}

export function isMatchCenterCompetition(value) {
  return SUPPORTED_COMPETITIONS.has(String(value || '').trim());
}
