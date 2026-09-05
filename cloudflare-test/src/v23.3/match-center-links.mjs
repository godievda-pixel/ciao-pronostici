import { openCanonicalMatchCenter } from './match-center-runtime.mjs';
import { getMatchBootstrap } from './match-bootstrap-cache.mjs';

const PREDICTION_CONTROL_SELECTOR = '[data-cw233-delta],[data-cw233-save-all],[data-cw231-action="predict"]';
const INTERACTIVE_SELECTOR = 'button,input,select,textarea,a,[data-cw233-pred-nav]';

function text(value) {
  return String(value ?? '').trim();
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

function cardAttribute(node, name) {
  return text(node?.getAttribute?.(name));
}

function cardTeam(card, side) {
  const selector = `.cw232-match-team--${side}`;
  const name = text(card?.querySelector?.(`${selector} strong`)?.textContent);
  const crestUrl = cardAttribute(card?.querySelector?.(`${selector} img`), 'src');
  return name || crestUrl ? Object.freeze({ name, crestUrl }) : null;
}

function scheduleCardBootstrap(card, competition, matchId) {
  if (!card?.querySelector) return null;
  const homeTeam = cardTeam(card, 'home');
  const awayTeam = cardTeam(card, 'away');
  if (!homeTeam && !awayTeam) return null;
  return Object.freeze({
    competition:text(competition),
    matchId:text(matchId),
    kickoffAt:cardAttribute(card.querySelector('time[datetime]'), 'datetime'),
    status:text(card?.dataset?.cw232MatchState).toLowerCase(),
    homeTeam,
    awayTeam,
  });
}

function mergeInitialMatch(cached, direct) {
  if (!cached) return direct || null;
  if (!direct) return cached;
  return Object.freeze({
    ...cached,
    ...direct,
    homeTeam:Object.freeze({ ...(cached.homeTeam || {}), ...(direct.homeTeam || {}) }),
    awayTeam:Object.freeze({ ...(cached.awayTeam || {}), ...(direct.awayTeam || {}) }),
  });
}

function canonicalPair(competition, matchId, source = null, directInitialMatch = null) {
  const key = text(competition);
  const id = text(matchId);
  if (!key || !id || !id.startsWith(`${key}:`) || !id.slice(key.length + 1).trim()) return null;
  const initialMatch = mergeInitialMatch(getMatchBootstrap(key, id), directInitialMatch);
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

export function resolveCanonicalMatchTarget(target) {
  if (!target?.closest) return null;
  if (target.closest(PREDICTION_CONTROL_SELECTOR)) return null;
  if (target.closest(INTERACTIVE_SELECTOR)) return null;

  const canonical = target.closest('[data-cw233-match][data-cw233-competition]');
  if (canonical) {
    const competition = canonical.dataset?.cw233Competition;
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
    const competition = profileCard.dataset?.cw232Competition;
    return canonicalPair(
      competition,
      profileCard.dataset?.cw232ProfileMatch,
      sourceForTarget(target, competition),
    );
  }

  const scheduleCard = target.closest('[data-cw232-match]');
  if (!scheduleCard) return null;
  const competitionHost = scheduleCard.closest?.('[data-cw232-competition]');
  const competition = competitionHost?.dataset?.cw232Competition;
  const matchId = scheduleCard.dataset?.cw232Match;
  return canonicalPair(
    competition,
    matchId,
    sourceForTarget(target, competition),
    scheduleCardBootstrap(scheduleCard, competition, matchId),
  );
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
  return Object.freeze({ handler, resolveCanonicalMatchTarget });
}
