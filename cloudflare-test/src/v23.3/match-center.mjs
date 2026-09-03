import * as Core from './match-center-core.mjs';
import { loadMatchCenterBase, loadMatchCenterSection } from './data-client.mjs';
import { toSerieALegacyMatchCenterData } from './bsd-serie-a-cw20-adapter.mjs';

export * from './match-center-core.mjs';

const EXTERNAL_SECTIONS = Object.freeze(['overview', 'stats', 'events', 'lineups', 'players']);
const EXTERNAL_EVENT = 'ciao-v233-open-external-legacy-match';

export function createMatchCenterController(options) {
  return Core.createMatchCenterController(options);
}

export function renderMatchCenter(state) {
  return Core.renderMatchCenter(state);
}

export function patchMatchCenterOverlay(overlay, state) {
  return Core.patchMatchCenterOverlay(overlay, state);
}

export function prepareCanonicalMatchCenterPayload(payload = {}) {
  if (payload?.competition === 'serie_a') return payload;
  const initialMatch = payload?.initialMatch;
  if (!initialMatch || typeof initialMatch !== 'object' || Array.isArray(initialMatch)) return payload;
  const { coverage: _bootstrapCoverage, ...bootstrap } = initialMatch;
  return { ...payload, initialMatch:bootstrap };
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

let routedApi = null;
let externalPending = null;
let externalContext = null;

export function installCanonicalMatchCenter(
  documentRef = globalThis.document,
  options = {},
) {
  if (!documentRef?.createElement || !documentRef?.addEventListener) return null;
  if (routedApi) return routedApi;
  // Keep the real core document listeners intact. The previous proxy swallowed
  // every click event, which made the canonical tabs non-interactive.
  routedApi = Core.installCanonicalMatchCenter(documentRef, options);
  return routedApi;
}

export async function openExternalLegacyMatchCenter(payload = {}) {
  const prepared = prepareCanonicalMatchCenterPayload(payload);
  const competition = String(prepared?.competition || '');
  const matchId = String(prepared?.matchId || '');
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
  const competition = String(context?.competition || '');
  const matchId = String(context?.matchId || '');
  if (!competition || !matchId) return null;
  return loadExternalLegacyMatchCenter(competition, matchId, {
    initialMatch:context?.initialMatch || null,
    force:true,
  });
}

export function openCanonicalMatchCenter(payload) {
  if (payload?.competition === 'serie_a') return Core.openCanonicalMatchCenter(payload);
  return openExternalLegacyMatchCenter(payload);
}

globalThis.CiaoV233ExternalLegacyMatchCenter = Object.freeze({
  open:openExternalLegacyMatchCenter,
  refresh:refreshExternalLegacyMatchCenter,
});
