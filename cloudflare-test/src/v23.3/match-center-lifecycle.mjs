export const MATCH_CENTER_OWNER_CLASS = 'cw238-match-center-owner';
export const MATCH_CENTER_SUSPENDED_ATTR = 'cw238MatchCenterSuspended';

const SERIE_A_OPEN_EVENT = 'ciao-v233-open-serie-a-match';
const EXTERNAL_OPEN_EVENT = 'ciao-v233-open-external-legacy-match';
const STYLE_ID = 'ciao-v233-round38-match-center-lifecycle-style';

let installed = null;
let rememberedSource = Object.freeze({
  surface:'home',
  competition:'',
  navTab:'predict',
  scrollTop:0,
  matchesOverlayScrollTop:0,
});

function text(value) {
  return String(value ?? '').trim();
}

function appRoot(documentRef) {
  return documentRef?.getElementById?.('ciao-miniapp-root') || null;
}

function contentNode(documentRef) {
  return documentRef?.querySelector?.('#ciao-miniapp-root .content') || null;
}

function matchesOverlay(documentRef) {
  return documentRef?.getElementById?.('ciao-v232-matches-overlay') || null;
}

function navButton(documentRef, tab) {
  return documentRef?.querySelector?.(`#ciao-miniapp-root .nav button[data-tab="${tab}"]`)
    || documentRef?.querySelector?.(`button[data-tab="${tab}"]`)
    || null;
}

function sourceFromTarget(target) {
  if (!target?.closest) return { surface:'home', competition:'', navTab:'predict' };

  const prediction = target.closest('[data-cw233-pred-card]')
    || target.closest('.cw233-prediction-page [data-cw233-match][data-cw233-competition]');
  if (prediction) {
    const competition = text(prediction.dataset?.cw233Competition)
      || text(prediction.dataset?.cw233PredCard).split(':')[0];
    return { surface:'predictions', competition, navTab:'mine' };
  }

  const club = target.closest('[data-cw232-profile-match]');
  if (club) {
    return {
      surface:'club-profile',
      competition:text(club.dataset?.cw232Competition),
      navTab:'profile',
    };
  }

  const match = target.closest('[data-cw232-match]');
  if (match) {
    const host = match.closest?.('[data-cw232-competition]');
    return {
      surface:'matches',
      competition:text(host?.dataset?.cw232Competition),
      navTab:'calendar',
    };
  }

  const canonical = target.closest('[data-cw233-match][data-cw233-competition]');
  if (canonical) {
    return {
      surface:'home',
      competition:text(canonical.dataset?.cw233Competition),
      navTab:'predict',
    };
  }

  return { surface:'home', competition:'', navTab:'predict' };
}

export function captureMatchSource(documentRef = globalThis.document, target = null) {
  const base = sourceFromTarget(target);
  return Object.freeze({
    surface:base.surface,
    competition:base.competition,
    navTab:base.navTab,
    scrollTop:Number(contentNode(documentRef)?.scrollTop) || 0,
    matchesOverlayScrollTop:Number(matchesOverlay(documentRef)?.scrollTop) || 0,
  });
}

function ensureStyle(documentRef) {
  if (!documentRef?.head || !documentRef?.createElement || documentRef.getElementById?.(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
html.${MATCH_CENTER_OWNER_CLASS} #ciao-v232-matches-overlay{
  display:none!important;
  visibility:hidden!important;
  pointer-events:none!important;
}
html.${MATCH_CENTER_OWNER_CLASS} #ciao-miniapp-root .cw232-competition__head{
  display:none!important;
}
`;
  documentRef.head.appendChild(style);
}

export function suspendMatchSource(documentRef = globalThis.document) {
  const overlay = matchesOverlay(documentRef);
  if (overlay) {
    overlay.dataset[MATCH_CENTER_SUSPENDED_ATTR] = '1';
    overlay.hidden = true;
    overlay.setAttribute?.('aria-hidden', 'true');
  }
  documentRef?.documentElement?.classList?.add?.(MATCH_CENTER_OWNER_CLASS);
  appRoot(documentRef)?.classList?.add?.('match-center-open');
}

function restoreScroll(documentRef, source) {
  const content = contentNode(documentRef);
  if (content) content.scrollTop = Number(source?.scrollTop) || 0;
  const overlay = matchesOverlay(documentRef);
  if (overlay) overlay.scrollTop = Number(source?.matchesOverlayScrollTop) || 0;
}

function schedule(documentRef, callback) {
  const view = documentRef?.defaultView || globalThis;
  if (typeof view?.queueMicrotask === 'function') view.queueMicrotask(callback);
  else if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(callback);
  else (view?.setTimeout || globalThis.setTimeout)?.(callback, 0);
}

function restorePredictionCompetition(documentRef, competition) {
  if (!competition) return;
  schedule(documentRef, () => {
    const selector = documentRef?.querySelector?.(`[data-cw233-pred-filter="${competition}"]`)
      || documentRef?.querySelector?.(`[data-cw233-prediction-filter="${competition}"]`)
      || documentRef?.querySelector?.(`[data-cw233-filter="${competition}"]`);
    selector?.click?.();
  });
}

export function restoreMatchSource(documentRef = globalThis.document, source = rememberedSource) {
  const normalized = Object.freeze({
    surface:text(source?.surface) || 'home',
    competition:text(source?.competition),
    navTab:text(source?.navTab) || 'predict',
    scrollTop:Number(source?.scrollTop) || 0,
    matchesOverlayScrollTop:Number(source?.matchesOverlayScrollTop) || 0,
  });

  documentRef?.documentElement?.classList?.remove?.(MATCH_CENTER_OWNER_CLASS);
  appRoot(documentRef)?.classList?.remove?.('match-center-open');

  const overlay = matchesOverlay(documentRef);
  if (overlay) {
    delete overlay.dataset?.[MATCH_CENTER_SUSPENDED_ATTR];
    overlay.removeAttribute?.('aria-hidden');
    overlay.hidden = normalized.surface !== 'matches';
  }

  const nav = navButton(documentRef, normalized.navTab);
  nav?.click?.();

  if (normalized.surface === 'predictions') restorePredictionCompetition(documentRef, normalized.competition);

  schedule(documentRef, () => restoreScroll(documentRef, normalized));
  return normalized;
}

export function currentMatchSource() {
  return rememberedSource;
}

export function installMatchCenterLifecycle(documentRef = globalThis.document, rootRef = globalThis) {
  if (!documentRef?.addEventListener) return null;
  if (installed) return installed;
  ensureStyle(documentRef);

  let restoreQueued = false;

  const rememberFromEvent = event => {
    const target = event?.target;
    if (!target?.closest) return;
    const hasMatchTarget = target.closest('[data-cw232-match]')
      || target.closest('[data-cw232-profile-match]')
      || target.closest('[data-cw233-pred-card]')
      || target.closest('[data-cw233-match][data-cw233-competition]');
    if (!hasMatchTarget) return;
    rememberedSource = captureMatchSource(documentRef, target);
  };

  const onOpen = () => {
    restoreQueued = false;
    suspendMatchSource(documentRef);
  };

  const queueRestore = () => {
    if (restoreQueued) return;
    restoreQueued = true;
    const source = rememberedSource;
    schedule(documentRef, () => {
      restoreQueued = false;
      restoreMatchSource(documentRef, source);
    });
  };

  const onClick = event => {
    rememberFromEvent(event);
    const back = event?.target?.closest?.('.mc-back,[data-cw233-mc-action="close"]');
    if (back) queueRestore();
  };

  documentRef.addEventListener('pointerdown', rememberFromEvent, true);
  documentRef.addEventListener('click', onClick, true);
  rootRef?.addEventListener?.(SERIE_A_OPEN_EVENT, onOpen);
  rootRef?.addEventListener?.(EXTERNAL_OPEN_EVENT, onOpen);

  installed = Object.freeze({
    capture:target => {
      rememberedSource = captureMatchSource(documentRef, target);
      return rememberedSource;
    },
    restore:source => restoreMatchSource(documentRef, source || rememberedSource),
    current:() => rememberedSource,
    disconnect() {
      documentRef.removeEventListener?.('pointerdown', rememberFromEvent, true);
      documentRef.removeEventListener?.('click', onClick, true);
      rootRef?.removeEventListener?.(SERIE_A_OPEN_EVENT, onOpen);
      rootRef?.removeEventListener?.(EXTERNAL_OPEN_EVENT, onOpen);
      documentRef?.documentElement?.classList?.remove?.(MATCH_CENTER_OWNER_CLASS);
      installed = null;
    },
  });

  rootRef.CiaoV233MatchCenterLifecycle = installed;
  return installed;
}

if (typeof document !== 'undefined') {
  const boot = () => installMatchCenterLifecycle(document, globalThis);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
}
