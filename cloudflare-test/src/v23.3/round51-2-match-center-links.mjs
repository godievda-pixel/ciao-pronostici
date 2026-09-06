import { getMatchBootstrap } from './match-bootstrap-cache.mjs';

const PREDICTION_CONTROL_SELECTOR = '[data-cw233-delta],[data-cw233-save-all],[data-cw231-action="predict"]';
const INTERACTIVE_SELECTOR = 'button,input,select,textarea,a,[data-cw233-pred-nav]';
const MATCH_CENTER_BUTTON_SELECTOR = '[data-cw231-action="match-center"]';

function text(value) {
  return String(value ?? '').trim();
}

async function openRound512MatchCenterLazy(payload) {
  const { openRound512MatchCenter } = await import('./round51-2-match-center-runtime.mjs');
  return openRound512MatchCenter(payload);
}

function sourceForTarget(target, competition = '') {
  const key = text(competition);
  if (target?.closest?.('[data-cw233-pred-card]')) {
    return Object.freeze({ surface:'predictions', tab:'mine', competition:key });
  }
  if (target?.closest?.('[data-cw232-profile-match]')) {
    return Object.freeze({ surface:'club-profile', tab:'profile', competition:key });
  }
  if (target?.closest?.('#ciao-v232-matches-overlay') || target?.closest?.('[data-cw232-match]')) {
    return Object.freeze({ surface:'matches', tab:'calendar', competition:key });
  }
  return Object.freeze({ surface:'home', tab:'predict', competition:key });
}

function canonicalPair(competition, matchId, source = null) {
  const key = text(competition);
  const id = text(matchId);
  if (!key || !id || !id.startsWith(`${key}:`) || !id.slice(key.length + 1).trim()) return null;
  const initialMatch = getMatchBootstrap(key, id);
  return Object.freeze({
    competition:key,
    matchId:id,
    ...(initialMatch ? { initialMatch } : {}),
    ...(source ? { source } : {}),
  });
}

function pairFromCanonicalId(matchId, sourceTarget = null) {
  const id = text(matchId);
  const separator = id.indexOf(':');
  if (separator <= 0) return null;
  const competition = id.slice(0, separator);
  return canonicalPair(competition, id, sourceForTarget(sourceTarget, competition));
}

export function resolveRound512MatchTarget(target) {
  if (!target?.closest) return null;
  if (target.closest(PREDICTION_CONTROL_SELECTOR)) return null;

  const interactive = target.closest(INTERACTIVE_SELECTOR);
  const explicitMatchCenter = target.closest(MATCH_CENTER_BUTTON_SELECTOR);
  if (interactive && !explicitMatchCenter) return null;

  const canonical = target.closest('[data-cw233-match][data-cw233-competition]');
  if (canonical) {
    const competition = text(canonical.dataset?.cw233Competition);
    return canonicalPair(
      competition,
      canonical.dataset?.cw233Match,
      sourceForTarget(target, competition),
    );
  }

  const predictionCard = target.closest('[data-cw233-pred-card]');
  if (predictionCard) return pairFromCanonicalId(predictionCard.dataset?.cw233PredCard, target);

  const profileCard = target.closest('[data-cw232-profile-match][data-cw232-competition]');
  if (profileCard) {
    const competition = text(profileCard.dataset?.cw232Competition);
    return canonicalPair(
      competition,
      profileCard.dataset?.cw232ProfileMatch,
      sourceForTarget(target, competition),
    );
  }

  const scheduleCard = target.closest('[data-cw232-match]');
  if (!scheduleCard) return null;
  const competitionHost = scheduleCard.closest?.('[data-cw232-competition]');
  const competition = text(competitionHost?.dataset?.cw232Competition);
  return canonicalPair(
    competition,
    scheduleCard.dataset?.cw232Match,
    sourceForTarget(target, competition),
  );
}

export function installRound512MatchLinks(
  documentRef = globalThis.document,
  { open = openRound512MatchCenterLazy } = {},
) {
  if (!documentRef?.addEventListener || typeof open !== 'function') return null;

  const handler = event => {
    const payload = resolveRound512MatchTarget(event?.target);
    if (!payload) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    void open(payload);
  };

  documentRef.addEventListener('click', handler, true);
  return Object.freeze({
    handler,
    resolveRound512MatchTarget,
    disconnect() {
      documentRef.removeEventListener?.('click', handler, true);
    },
  });
}
