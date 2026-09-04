export const ROUND35_MATCH_CENTER_BUILD = '2026-09-04-r35';
const STYLE_ID = 'ciao-v233-round35-match-center-overview-fixes';

const EXTERNAL_COMPETITIONS = new Set([
  'coppa_italia',
  'ucl',
  'uel',
  'uecl',
  'champions_league',
  'europa_league',
  'conference_league',
]);

export function isRound35ExternalCompetition(value) {
  return EXTERNAL_COMPETITIONS.has(String(value || '').trim().toLowerCase());
}

export const ROUND35_CSS = `
/* Контекст Серии А is league metadata. It stays Serie A blue in every Match Center. */
#ciao-miniapp-root.match-center-open .cw18-match-context{
  --cw233-serie-context-bg:#071626;
  --cw233-serie-context-accent:#0c5aa8;
  --cw233-serie-context-accent-2:#287fc7;
  --cw233-serie-context-border:rgba(12,90,168,.34);
  --cw233-serie-context-surface:rgba(12,90,168,.10);
  --cw233-serie-context-surface-2:rgba(40,127,199,.09);
  border-color:var(--cw233-serie-context-border)!important;
  background:
    radial-gradient(85% 130% at 0% 0%,rgba(12,90,168,.16),transparent 68%),
    radial-gradient(78% 120% at 100% 0%,rgba(40,127,199,.10),transparent 72%),
    linear-gradient(145deg,#0a1730,#071426)!important;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.018),0 10px 30px rgba(1,10,22,.16)!important;
}
#ciao-miniapp-root.match-center-open .cw18-match-context .cw18-context-title{
  color:color-mix(in srgb,var(--cw233-serie-context-accent-2) 62%,white 38%)!important;
}
#ciao-miniapp-root.match-center-open .cw18-match-context .cw18-context-team{
  border-color:color-mix(in srgb,var(--cw233-serie-context-accent) 34%,transparent)!important;
  background:linear-gradient(145deg,
    color-mix(in srgb,var(--cw233-serie-context-accent) 12%,var(--cw233-serie-context-bg)),
    color-mix(in srgb,var(--cw233-serie-context-accent-2) 7%,var(--cw233-serie-context-bg)))!important;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.018)!important;
}
#ciao-miniapp-root.match-center-open .cw18-match-context .cw18-context-pos,
#ciao-miniapp-root.match-center-open .cw18-match-context .cw18-context-team-top small{
  color:color-mix(in srgb,var(--cw233-serie-context-accent-2) 56%,white 44%)!important;
}
#ciao-miniapp-root.match-center-open .cw18-match-context .cw18-context-scorer{
  border-color:color-mix(in srgb,var(--cw233-serie-context-accent) 28%,transparent)!important;
  color:#dceafb!important;
}

/* External Overview Form fail-safe: hide the WHOLE legacy Form section, never only its contents. */
#ciao-miniapp-root.match-center-open[data-cw233-mc-competition] [data-mc-tab-content="overview"] .mc-section:has(.cw14-form-card){
  display:none!important;
}
`;

export function removeRound35ExternalOverviewForm(root) {
  if (!root?.classList?.contains?.('match-center-open')) return 0;
  if (!isRound35ExternalCompetition(root?.dataset?.cw233McCompetition)) return 0;
  const host = root.querySelector?.('[data-mc-tab-content="overview"]');
  if (!host) return 0;

  let removed = 0;
  for (const marker of host.querySelectorAll?.('.cw14-form-card') || []) {
    const section = marker.closest?.('.mc-section') || marker.closest?.('section');
    const target = section || marker;
    target.remove?.();
    removed += 1;
  }
  return removed;
}

export function installRound35MatchCenterOverviewFixes(
  documentRef = globalThis.document,
  windowRef = globalThis,
) {
  if (!documentRef?.getElementById || !documentRef?.createElement) return null;

  if (!documentRef.getElementById(STYLE_ID) && documentRef.head) {
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = ROUND35_CSS;
    documentRef.head.appendChild(style);
  }

  const root = documentRef.getElementById('ciao-miniapp-root');
  if (!root) return null;

  const cleanup = () => removeRound35ExternalOverviewForm(root);
  const scheduleCleanup = () => {
    if (typeof windowRef.queueMicrotask === 'function') windowRef.queueMicrotask(cleanup);
    else Promise.resolve().then(cleanup).catch(() => {});
  };

  windowRef.addEventListener?.('ciao-v233-open-external-legacy-match', scheduleCleanup);

  const Observer = windowRef.MutationObserver || globalThis.MutationObserver;
  const observer = typeof Observer === 'function'
    ? new Observer(() => {
      if (isRound35ExternalCompetition(root?.dataset?.cw233McCompetition)) cleanup();
    })
    : null;
  observer?.observe?.(root, { childList:true, subtree:true });

  cleanup();
  return Object.freeze({
    cleanup,
    disconnect(){
      observer?.disconnect?.();
      windowRef.removeEventListener?.('ciao-v233-open-external-legacy-match', scheduleCleanup);
    },
  });
}

if (typeof document !== 'undefined') {
  const boot = () => installRound35MatchCenterOverviewFixes(document, globalThis);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
}
