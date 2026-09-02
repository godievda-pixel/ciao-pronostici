import { openCanonicalMatchCenter } from './match-center.mjs';

function canonicalPair(competition, matchId) {
  const key = String(competition || '').trim();
  const id = String(matchId || '').trim();
  if (!key || !id || !id.startsWith(`${key}:`) || !id.slice(key.length + 1).trim()) return null;
  return Object.freeze({ competition: key, matchId: id });
}

export function resolveCanonicalMatchTarget(target) {
  if (!target?.closest) return null;

  const profileCard = target.closest('[data-cw232-profile-match][data-cw232-competition]');
  if (profileCard) {
    return canonicalPair(
      profileCard.dataset?.cw232Competition,
      profileCard.dataset?.cw232ProfileMatch,
    );
  }

  const scheduleCard = target.closest('[data-cw232-match]');
  if (!scheduleCard) return null;
  const competitionHost = scheduleCard.closest?.('[data-cw232-competition]');
  return canonicalPair(
    competitionHost?.dataset?.cw232Competition,
    scheduleCard.dataset?.cw232Match,
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
    event.preventDefault?.();
    event.stopPropagation?.();
    void open(payload);
  };

  documentRef.addEventListener('click', handler, true);
  return Object.freeze({ handler, resolveCanonicalMatchTarget });
}
