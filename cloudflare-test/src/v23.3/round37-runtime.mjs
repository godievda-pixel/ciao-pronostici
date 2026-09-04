export const USER_FEEDBACK_ROUND37_BUILD = '2026-09-04-r37';
export const MATCH_CENTER_BACK_EVENT = 'ciao-v233-match-center-back';
export const COMPACT_STANDING_KEEP = Object.freeze([0, 1, 2, 7, 8]);

const STYLE_ID = 'ciao-v233-round37-runtime-style';
const MATCH_OPEN_EVENTS = Object.freeze([
  'ciao-v233-open-serie-a-match',
  'ciao-v233-open-external-legacy-match',
]);
const CARD_THEMES = Object.freeze({
  'serie-a':Object.freeze({ accent:'#0c5aa8', accent2:'#287fc7' }),
  coppa:Object.freeze({ accent:'#e53b49', accent2:'#087e46' }),
  champions:Object.freeze({ accent:'#4b63ff', accent2:'#222b9d' }),
  europa:Object.freeze({ accent:'#ff790d', accent2:'#b84000' }),
  conference:Object.freeze({ accent:'#22c875', accent2:'#087b46' }),
});

let rememberedSource = Object.freeze({ surface:'home', tab:'predict', competition:'' });
let installed = null;

function text(value) { return String(value ?? '').trim(); }

export function predictionCardTheme(theme) {
  return CARD_THEMES[text(theme)] || CARD_THEMES['serie-a'];
}

export function compactStandingValues(values = []) {
  const rows = Array.isArray(values) ? values : [];
  return COMPACT_STANDING_KEEP.map(index => rows[index]).filter(value => value !== undefined);
}

export function normalizeMatchSource(source = {}) {
  const surface = text(source?.surface);
  const competition = text(source?.competition);
  if (surface === 'predictions') return Object.freeze({ surface, tab:'mine', competition });
  if (surface === 'matches') return Object.freeze({ surface, tab:'calendar', competition });
  if (surface === 'club-profile') return Object.freeze({ surface, tab:'profile', competition });
  if (surface === 'ranking') return Object.freeze({ surface, tab:'table', competition });
  if (surface === 'profile') return Object.freeze({ surface, tab:'profile', competition });
  return Object.freeze({ surface:'home', tab:'predict', competition:'' });
}

export function rememberMatchSource(source = {}) {
  rememberedSource = normalizeMatchSource(source);
  return rememberedSource;
}

export function currentMatchSource() {
  return rememberedSource;
}

function matchSourceFromTarget(target) {
  if (!target?.closest) return null;
  const prediction = target.closest('[data-cw233-pred-card]');
  if (prediction) {
    const competition = text(prediction.dataset?.cw233Competition)
      || text(prediction.dataset?.cw233PredCard).split(':')[0];
    return normalizeMatchSource({ surface:'predictions', competition });
  }
  const profile = target.closest('[data-cw232-profile-match]');
  if (profile) return normalizeMatchSource({ surface:'club-profile', competition:profile.dataset?.cw232Competition });
  const schedule = target.closest('[data-cw232-match]');
  if (schedule) {
    const host = schedule.closest?.('[data-cw232-competition]');
    return normalizeMatchSource({ surface:'matches', competition:host?.dataset?.cw232Competition });
  }
  const canonical = target.closest('[data-cw233-match][data-cw233-competition]');
  if (!canonical) return null;
  if (canonical.closest?.('.cw233-prediction-page')) {
    return normalizeMatchSource({ surface:'predictions', competition:canonical.dataset?.cw233Competition });
  }
  return normalizeMatchSource({ surface:'home', competition:canonical.dataset?.cw233Competition });
}

function ensureStyle(documentRef) {
  if (!documentRef?.head || !documentRef?.createElement || documentRef.getElementById?.(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* Round 37: one tournament palette owns the complete prediction match card. */
#ciao-miniapp-root .cw233-prediction-page .match{
  border-color:color-mix(in srgb,var(--r11a) 42%,rgba(255,255,255,.08))!important;
  background:
    radial-gradient(circle at 92% 7%,color-mix(in srgb,var(--r11a) 21%,transparent),transparent 47%),
    radial-gradient(circle at 7% 94%,color-mix(in srgb,var(--r11b) 14%,transparent),transparent 52%),
    linear-gradient(145deg,color-mix(in srgb,var(--r11a) 15%,#131b29),color-mix(in srgb,var(--r11b) 11%,#08101c))!important;
  box-shadow:0 10px 24px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.045)!important;
}
#ciao-miniapp-root .cw233-prediction-page .match .score-value{
  border-color:color-mix(in srgb,var(--r11a) 28%,rgba(255,255,255,.08))!important;
  background:linear-gradient(145deg,color-mix(in srgb,var(--r11a) 15%,#182238),color-mix(in srgb,var(--r11b) 9%,#101827))!important;
}
#ciao-miniapp-root .cw233-prediction-page .match [data-cw233-delta]{
  border-color:color-mix(in srgb,var(--r11a) 34%,rgba(255,255,255,.10))!important;
  background:linear-gradient(145deg,color-mix(in srgb,var(--r11a) 25%,#182238),color-mix(in srgb,var(--r11b) 18%,#101827))!important;
}

/* Round 37 compact production-style standings: # / team / played / GD / points. */
#ciao-v233-tables-overlay .cw233-standing-wrap{
  max-width:100%!important;
  overflow-x:hidden!important;
}
#ciao-v233-tables-overlay table.cw237-compact-standing{
  width:100%!important;
  min-width:0!important;
  max-width:100%!important;
  table-layout:fixed!important;
  border-collapse:separate!important;
  border-spacing:0!important;
}
#ciao-v233-tables-overlay table.cw237-compact-standing th,
#ciao-v233-tables-overlay table.cw237-compact-standing td{
  box-sizing:border-box!important;
  min-width:0!important;
  border-left:0!important;
  border-right:0!important;
}
#ciao-v233-tables-overlay table.cw237-compact-standing th:nth-child(1),
#ciao-v233-tables-overlay table.cw237-compact-standing td:nth-child(1){width:42px!important;text-align:center!important}
#ciao-v233-tables-overlay table.cw237-compact-standing th:nth-child(2),
#ciao-v233-tables-overlay table.cw237-compact-standing td:nth-child(2){width:auto!important;text-align:left!important}
#ciao-v233-tables-overlay table.cw237-compact-standing th:nth-child(3),
#ciao-v233-tables-overlay table.cw237-compact-standing td:nth-child(3){width:38px!important;text-align:center!important}
#ciao-v233-tables-overlay table.cw237-compact-standing th:nth-child(4),
#ciao-v233-tables-overlay table.cw237-compact-standing td:nth-child(4){width:52px!important;text-align:center!important}
#ciao-v233-tables-overlay table.cw237-compact-standing th:nth-child(5),
#ciao-v233-tables-overlay table.cw237-compact-standing td:nth-child(5){width:42px!important;text-align:center!important;font-weight:950!important;color:#fff!important}
#ciao-v233-tables-overlay table.cw237-compact-standing thead th{
  height:42px!important;
  padding:0 5px!important;
  background:transparent!important;
  border-bottom:1px solid color-mix(in srgb,var(--r11a) 22%,rgba(255,255,255,.08))!important;
  color:rgba(191,203,231,.58)!important;
  font-size:9px!important;
  font-weight:850!important;
  letter-spacing:.07em!important;
  text-transform:uppercase!important;
}
#ciao-v233-tables-overlay table.cw237-compact-standing tbody td{
  height:58px!important;
  padding:7px 5px!important;
  background:linear-gradient(90deg,color-mix(in srgb,var(--r11a) 4%,rgba(9,17,31,.25)),rgba(9,17,31,.16))!important;
  border-bottom:1px solid color-mix(in srgb,var(--r11a) 13%,rgba(255,255,255,.055))!important;
  box-shadow:none!important;
}
#ciao-v233-tables-overlay table.cw237-compact-standing .cw233-standing-team{
  display:flex!important;
  align-items:center!important;
  gap:10px!important;
  min-width:0!important;
}
#ciao-v233-tables-overlay table.cw237-compact-standing .cw233-standing-team strong{
  display:block!important;
  min-width:0!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
  font-size:12px!important;
}
#ciao-v233-tables-overlay table.cw237-compact-standing .cw233-table-logo{
  width:28px!important;height:28px!important;min-width:28px!important;min-height:28px!important;object-fit:contain!important;
}

/* Match Center exclusively owns the viewport; parent Matches chrome never sits above it. */
#ciao-miniapp-root.match-center-open #ciao-v232-matches-overlay{display:none!important}
#ciao-miniapp-root.match-center-open .cw232-competition__head{display:none!important}
`;
  documentRef.head.appendChild(style);
}

export function compactStandingTable(table) {
  if (!table?.querySelectorAll || table.dataset?.cw237Compact === '1') return false;
  const keep = new Set(COMPACT_STANDING_KEEP);
  for (const row of table.querySelectorAll('tr')) {
    const cells = [...(row.children || [])];
    for (let index = cells.length - 1; index >= 0; index -= 1) {
      if (!keep.has(index)) cells[index]?.remove?.();
    }
  }
  table.classList?.add?.('cw237-compact-standing');
  if (table.dataset) table.dataset.cw237Compact = '1';
  return true;
}

function compactTables(documentRef) {
  let changed = 0;
  for (const table of documentRef?.querySelectorAll?.('#ciao-v233-tables-overlay .cw233-standing-table') || []) {
    if (compactStandingTable(table)) changed += 1;
  }
  return changed;
}

function matchesOverlay(documentRef) {
  return documentRef?.getElementById?.('ciao-v232-matches-overlay') || null;
}

function appRoot(documentRef) {
  return documentRef?.getElementById?.('ciao-miniapp-root') || null;
}

function suppressParentMatches(documentRef) {
  const overlay = matchesOverlay(documentRef);
  if (!overlay) return;
  if (overlay.dataset && !Object.prototype.hasOwnProperty.call(overlay.dataset, 'cw237WasHidden')) {
    overlay.dataset.cw237WasHidden = overlay.hidden ? '1' : '0';
  }
  overlay.hidden = true;
  overlay.setAttribute?.('aria-hidden', 'true');
}

function restoreParentMatches(documentRef, source) {
  const overlay = matchesOverlay(documentRef);
  if (!overlay) return;
  if (source.surface === 'matches') {
    overlay.hidden = false;
    overlay.removeAttribute?.('aria-hidden');
  } else {
    overlay.hidden = true;
  }
  if (overlay.dataset) delete overlay.dataset.cw237WasHidden;
}

function enterMatchCenter(documentRef) {
  appRoot(documentRef)?.classList?.add?.('match-center-open');
  suppressParentMatches(documentRef);
}

function navButton(documentRef, tab) {
  const root = appRoot(documentRef);
  return root?.querySelector?.(`.nav button[data-tab="${tab}"]`)
    || documentRef?.querySelector?.(`button[data-tab="${tab}"]`)
    || null;
}

export function restoreMatchSource(documentRef = globalThis.document, source = rememberedSource) {
  const normalized = normalizeMatchSource(source);
  const root = appRoot(documentRef);
  root?.classList?.remove?.('match-center-open');
  restoreParentMatches(documentRef, normalized);

  if (normalized.surface === 'matches' || normalized.surface === 'club-profile') return normalized;
  const nav = navButton(documentRef, normalized.tab);
  nav?.click?.();
  return normalized;
}

export function dispatchMatchCenterBack(documentRef = globalThis.document, source = rememberedSource) {
  if (!documentRef?.dispatchEvent) return false;
  const normalized = normalizeMatchSource(source);
  const view = documentRef.defaultView || globalThis;
  const CustomEventCtor = view?.CustomEvent || globalThis.CustomEvent;
  const event = typeof CustomEventCtor === 'function'
    ? new CustomEventCtor(MATCH_CENTER_BACK_EVENT, { detail:normalized })
    : { type:MATCH_CENTER_BACK_EVENT, detail:normalized };
  documentRef.dispatchEvent(event);
  return true;
}

function schedule(documentRef, fn) {
  const view = documentRef?.defaultView || globalThis;
  if (typeof view?.queueMicrotask === 'function') view.queueMicrotask(fn);
  else if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(fn);
  else (view?.setTimeout || globalThis.setTimeout)?.(fn, 0);
}

export function installRound37Runtime(documentRef = globalThis.document, rootRef = globalThis) {
  if (!documentRef?.addEventListener) return null;
  if (installed) return installed;
  ensureStyle(documentRef);

  const onDocumentClick = event => {
    const target = event?.target;
    const source = matchSourceFromTarget(target);
    if (source) rememberMatchSource(source);

    const back = target?.closest?.('.mc-back,[data-cw233-mc-action="close"]');
    if (!back) return;
    const saved = currentMatchSource();
    schedule(documentRef, () => dispatchMatchCenterBack(documentRef, saved));
  };

  const onBack = event => {
    restoreMatchSource(documentRef, event?.detail || rememberedSource);
  };

  const onOpen = () => enterMatchCenter(documentRef);
  documentRef.addEventListener('click', onDocumentClick, true);
  documentRef.addEventListener(MATCH_CENTER_BACK_EVENT, onBack);
  for (const name of MATCH_OPEN_EVENTS) rootRef?.addEventListener?.(name, onOpen);

  const Observer = rootRef?.MutationObserver || globalThis.MutationObserver;
  const observer = typeof Observer === 'function'
    ? new Observer(() => compactTables(documentRef))
    : null;
  observer?.observe?.(documentRef.documentElement || documentRef.body, { childList:true, subtree:true });
  compactTables(documentRef);

  installed = Object.freeze({
    rememberMatchSource,
    restoreMatchSource:source => restoreMatchSource(documentRef, source),
    compactTables:() => compactTables(documentRef),
    disconnect() {
      observer?.disconnect?.();
      documentRef.removeEventListener?.('click', onDocumentClick, true);
      documentRef.removeEventListener?.(MATCH_CENTER_BACK_EVENT, onBack);
      for (const name of MATCH_OPEN_EVENTS) rootRef?.removeEventListener?.(name, onOpen);
      installed = null;
    },
  });
  rootRef.CiaoV233Round37 = installed;
  return installed;
}

if (typeof document !== 'undefined') {
  const boot = () => installRound37Runtime(document, globalThis);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
}
