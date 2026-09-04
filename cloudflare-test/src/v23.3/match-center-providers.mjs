import {
  MATCH_CENTER_SECTIONS,
  normalizeCanonicalBase,
  normalizeCanonicalSection,
} from './match-center-contract.mjs';

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

export function createMatchCenterProviders({
  loadSerieABase,
  loadSerieASection,
  loadExternalBase,
  loadExternalSection,
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
    return normalizeCanonicalSection(canonicalSection, unwrapSection(payload));
  }

  return Object.freeze({ loadBase, loadSection });
}

export function isMatchCenterCompetition(value) {
  return SUPPORTED_COMPETITIONS.has(String(value || '').trim());
}
