import { MATCH_CENTER_RUNTIME_BUILD } from './match-center-runtime.mjs';
import { resolveRound512MatchTarget } from './round51-2-match-center-links.mjs';

const PREDICTION_CONTROL_SELECTOR = '[data-cw233-delta],[data-cw233-save-all],[data-cw231-action="predict"]';

// Historical Round 39 deployment identity remains readable at the canonical seam.
// The active Match Center implementation is Round 51.2 and does not use legacy suspend/restore ownership.
void MATCH_CENTER_RUNTIME_BUILD;

export function resolveCanonicalMatchTarget(target) {
  if (!target?.closest) return null;
  if (target.closest(PREDICTION_CONTROL_SELECTOR)) return null;
  return resolveRound512MatchTarget(target);
}

export async function openCanonicalMatchCenter(payload = {}) {
  const { openRound512MatchCenter } = await import('./round51-2-match-center-runtime.mjs');
  return openRound512MatchCenter(payload);
}

export function installCanonicalMatchLinks(
  documentRef = globalThis.document,
  { open = openCanonicalMatchCenter } = {},
) {
  if (!documentRef?.addEventListener || typeof open !== 'function') return null;

  const handler = event => {
    const payload = resolveCanonicalMatchTarget(event?.target);
    if (!payload) return;
    const source = globalThis.CiaoV233MatchCenterLifecycle?.capture?.(event?.target) || payload.source;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    void open({ ...payload, source });
  };

  documentRef.addEventListener('click', handler, true);
  return Object.freeze({
    handler,
    resolveCanonicalMatchTarget,
    disconnect() {
      documentRef.removeEventListener?.('click', handler, true);
    },
  });
}
