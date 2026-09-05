const FINISHED_STATUSES = new Set(['finished','cancelled','canceled']);

function text(value) {
  return String(value ?? '').trim();
}

function timestamp(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : null;
}

function nowTimestamp(now) {
  if (now instanceof Date) return now.getTime();
  const ms = Date.parse(now);
  return Number.isFinite(ms) ? ms : Date.now();
}

export function currentCompetitionGroupKey(groups = [], now = new Date()) {
  const rows = Array.isArray(groups) ? groups : [];
  if (!rows.length) return '';

  const live = rows.find(group => (Array.isArray(group?.matches) ? group.matches : []).some(match => text(match?.status).toLowerCase() === 'live'));
  if (live?.key) return text(live.key);

  const nowMs = nowTimestamp(now);
  const upcoming = [];
  for (const group of rows) {
    for (const match of Array.isArray(group?.matches) ? group.matches : []) {
      const status = text(match?.status).toLowerCase();
      const kickoff = timestamp(match?.kickoffAt);
      if (kickoff === null || kickoff < nowMs || FINISHED_STATUSES.has(status)) continue;
      upcoming.push({ key:text(group?.key), kickoff });
    }
  }
  upcoming.sort((left, right) => left.kickoff - right.kickoff);
  if (upcoming[0]?.key) return upcoming[0].key;

  return text(rows[rows.length - 1]?.key);
}

function domGroups(root) {
  if (!root?.querySelectorAll) return [];
  return [...root.querySelectorAll('[data-cw232-group-panel]')].map(panel => ({
    key:text(panel?.dataset?.cw232GroupPanel),
    matches:[...panel.querySelectorAll('[data-cw232-match]')].map(card => ({
      status:text(card?.dataset?.cw232MatchState).toLowerCase(),
      kickoffAt:text(card.querySelector?.('time[datetime]')?.getAttribute?.('datetime')),
    })),
  })).filter(group => group.key);
}

export function reconcileSerieACurrentRound(root, now = new Date()) {
  if (!root?.querySelectorAll) return '';
  const key = currentCompetitionGroupKey(domGroups(root), now);
  if (!key) return '';

  for (const button of root.querySelectorAll('[data-cw232-action="group-view"][data-cw232-group-key]')) {
    button.setAttribute?.('aria-selected', String(text(button?.dataset?.cw232GroupKey) === key));
  }
  for (const panel of root.querySelectorAll('[data-cw232-group-panel]')) {
    const selected = text(panel?.dataset?.cw232GroupPanel) === key;
    if (selected) panel.removeAttribute?.('hidden');
    else panel.setAttribute?.('hidden', '');
  }
  return key;
}

export function installRound511CurrentRound(documentRef = globalThis.document, { now = () => new Date() } = {}) {
  if (!documentRef?.querySelector) return null;
  const processed = new WeakSet();

  const reconcile = () => {
    const root = documentRef.querySelector('.cw232-competition[data-cw232-competition="serie_a"]');
    if (!root || processed.has(root)) return '';
    processed.add(root);
    return reconcileSerieACurrentRound(root, typeof now === 'function' ? now() : now);
  };

  reconcile();
  const Observer = documentRef.defaultView?.MutationObserver || globalThis.MutationObserver;
  const observer = typeof Observer === 'function' && documentRef.body
    ? new Observer(() => reconcile())
    : null;
  observer?.observe?.(documentRef.body, { childList:true, subtree:true });

  return Object.freeze({
    reconcile,
    disconnect() { observer?.disconnect?.(); },
  });
}

if (typeof document !== 'undefined') installRound511CurrentRound(document);
