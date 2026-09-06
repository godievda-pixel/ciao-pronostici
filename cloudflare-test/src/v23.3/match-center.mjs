import { loadMatchCenterBase, loadMatchCenterSection } from './data-client.mjs';
import { toSerieALegacyMatchCenterData } from './bsd-serie-a-cw20-adapter.mjs';

const EXTERNAL_SECTIONS = Object.freeze(['overview', 'stats', 'events', 'lineups', 'players']);
const SERIE_A_EVENT = 'ciao-v233-open-serie-a-match';
const EXTERNAL_EVENT = 'ciao-v233-open-external-legacy-match';

export function prepareCanonicalMatchCenterPayload(payload = {}) {
  if (payload?.competition === 'serie_a') return payload;
  const initialMatch = payload?.initialMatch;
  if (!initialMatch || typeof initialMatch !== 'object' || Array.isArray(initialMatch)) return payload;
  const { coverage: _bootstrapCoverage, ...bootstrap } = initialMatch;
  return { ...payload, initialMatch:bootstrap };
}

function serieALegacyId(matchId) {
  const value = String(matchId || '').trim();
  if (!value.startsWith('serie_a:')) return 0;
  const id = Number(value.slice('serie_a:'.length));
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export function openSerieALegacyMatchCenter(payload = {}, target = globalThis) {
  const legacyId = serieALegacyId(payload?.matchId);
  if (!legacyId) throw new Error('serie_a_legacy_match_id_required');
  const CustomEventCtor = target?.CustomEvent || globalThis.CustomEvent;
  if (typeof target?.dispatchEvent !== 'function' || typeof CustomEventCtor !== 'function') {
    throw new Error('serie_a_legacy_match_center_bridge_unavailable');
  }
  target.dispatchEvent(new CustomEventCtor(SERIE_A_EVENT, {
    detail:Object.freeze({
      matchId:String(payload.matchId),
      legacyId,
    }),
  }));
  return 'legacy';
}

function baseMatch(payload) {
  if (payload?.match && typeof payload.match === 'object') return payload.match;
  if (payload?.data?.match && typeof payload.data.match === 'object') return payload.data.match;
  return payload && typeof payload === 'object' ? payload : null;
}

function sectionData(payload) {
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) return payload.data;
  return payload ?? null;
}

export async function loadExternalLegacyMatchCenter(
  competition,
  matchId,
  {
    initialMatch = null,
    loadBase = loadMatchCenterBase,
    loadSection = loadMatchCenterSection,
    force = false,
  } = {},
) {
  const basePayload = await loadBase(competition, matchId, { force });
  const base = baseMatch(basePayload) || initialMatch;
  if (!base) throw new Error('external_match_center_base_missing');

  const pairs = await Promise.all(EXTERNAL_SECTIONS.map(async section => {
    try {
      const payload = await loadSection(competition, matchId, section, {
        force,
        status:base?.status || null,
      });
      return [section, sectionData(payload)];
    } catch (_error) {
      return [section, null];
    }
  }));

  return toSerieALegacyMatchCenterData(base, Object.fromEntries(pairs));
}

function dispatchExternalLegacy(data, context, target = globalThis) {
  const CustomEventCtor = target?.CustomEvent || globalThis.CustomEvent;
  if (typeof target?.dispatchEvent !== 'function' || typeof CustomEventCtor !== 'function') {
    throw new Error('external_legacy_match_center_bridge_unavailable');
  }
  target.dispatchEvent(new CustomEventCtor(EXTERNAL_EVENT, {
    detail:Object.freeze({
      competition:String(context?.competition || ''),
      matchId:String(context?.matchId || ''),
      data,
    }),
  }));
  return data;
}

let externalPending = null;
let externalContext = null;

export async function openExternalLegacyMatchCenter(payload = {}) {
  const prepared = prepareCanonicalMatchCenterPayload(payload);
  const competition = String(prepared?.competition || '').trim();
  const matchId = String(prepared?.matchId || '').trim();
  if (!competition || !matchId) throw new Error('external_match_center_target_missing');

  const context = Object.freeze({ competition, matchId, initialMatch:prepared?.initialMatch || null });
  externalContext = context;
  const token = Symbol('external-match-center');
  const pending = loadExternalLegacyMatchCenter(competition, matchId, {
    initialMatch:context.initialMatch,
  }).then(data => {
    if (externalPending?.token !== token) return data;
    return dispatchExternalLegacy(data, context);
  }).finally(() => {
    if (externalPending?.token === token) externalPending = null;
  });
  externalPending = Object.freeze({ token, promise:pending });
  return pending;
}

export async function refreshExternalLegacyMatchCenter(context = externalContext) {
  const competition = String(context?.competition || '').trim();
  const matchId = String(context?.matchId || '').trim();
  if (!competition || !matchId) return null;
  return loadExternalLegacyMatchCenter(competition, matchId, {
    initialMatch:context?.initialMatch || null,
    force:true,
  });
}

export function openCanonicalMatchCenter(payload = {}) {
  const competition = String(payload?.competition || '').trim();
  if (competition === 'serie_a') return openSerieALegacyMatchCenter(payload);
  return openExternalLegacyMatchCenter(payload);
}

globalThis.CiaoV233ExternalLegacyMatchCenter = Object.freeze({
  open:openExternalLegacyMatchCenter,
  refresh:refreshExternalLegacyMatchCenter,
});
