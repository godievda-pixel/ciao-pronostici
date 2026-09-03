import * as Core from './match-center-core.mjs';

export * from './match-center-core.mjs';

export function createMatchCenterController(options) {
  return Core.createMatchCenterController(options);
}

export function renderMatchCenter(state) {
  return Core.renderMatchCenter(state);
}

export function patchMatchCenterOverlay(overlay, state) {
  return Core.patchMatchCenterOverlay(overlay, state);
}

let routedApi = null;
let actionDocument = null;

function routedDocument(documentRef) {
  if (typeof Proxy !== 'function') return documentRef;
  return new Proxy(documentRef, {
    get(target, property) {
      if (property === 'addEventListener') {
        return (type, listener, options) => {
          if (type === 'click') return undefined;
          return target.addEventListener?.(type, listener, options);
        };
      }
      const value = target[property];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function installActionRouter(documentRef, api) {
  if (!documentRef?.addEventListener || actionDocument === documentRef) return;
  actionDocument = documentRef;
  documentRef.addEventListener('click', event => {
    const action = event?.target?.closest?.('[data-cw233-mc-action]');
    if (!action) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    const kind = action.dataset?.cw233McAction;
    if (kind === 'close') {
      api.close?.();
      return;
    }
    if (kind === 'retry') {
      const state = api.getState?.() || {};
      if (!state?.competition || !state?.matchId) return;
      void api.openCanonicalMatchCenter?.({
        competition:state.competition,
        matchId:state.matchId,
        initialMatch:state.match || null,
      });
    }
  }, true);
}

export function installCanonicalMatchCenter(
  documentRef = globalThis.document,
  options = {},
) {
  if (!documentRef?.createElement || !documentRef?.addEventListener) return null;
  if (routedApi) return routedApi;
  routedApi = Core.installCanonicalMatchCenter(routedDocument(documentRef), options);
  if (routedApi) installActionRouter(documentRef, routedApi);
  return routedApi;
}

export function openCanonicalMatchCenter(payload) {
  if (!routedApi && typeof document !== 'undefined') installCanonicalMatchCenter(document);
  if (!routedApi) throw new Error('Match Center UI is not installed');
  return routedApi.openCanonicalMatchCenter(payload);
}
