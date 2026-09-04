const STYLE_ID = 'cw233-legacy-match-center-theme';
export const LEGACY_MATCH_CENTER_THEME_BUILD = 'r23-final-themes';

export const LEGACY_MATCH_CENTER_THEME_KEYS = Object.freeze({
  coppa_italia:'coppa_italia',
  champions_league:'ucl',
  europa_league:'uel',
  conference_league:'uecl',
  ucl:'ucl',
  uel:'uel',
  uecl:'uecl',
});

const CSS = `
/* Serie A is the default legacy Match Center theme. */
#ciao-miniapp-root.match-center-open {
  --cw233-mc-bg:#071626;
  --cw233-mc-surface:rgba(255,255,255,.050);
  --cw233-mc-surface-strong:rgba(255,255,255,.072);
  --cw233-mc-border:rgba(12,90,168,.34);
  --cw233-mc-accent:#0c5aa8;
  --cw233-mc-accent-2:#287fc7;
  --cw233-mc-away:#67aee0;
  --cw233-mc-glow:rgba(12,90,168,.25);
  --cw233-mc-glow-2:rgba(40,127,199,.14);
  background:
    radial-gradient(90% 42% at 12% -8%, var(--cw233-mc-glow), transparent 68%),
    radial-gradient(88% 42% at 92% 0%, var(--cw233-mc-glow-2), transparent 70%),
    var(--cw233-mc-bg) !important;
}

/* Coppa Italia reuses the red + green visual language of the Matches screen. */
#ciao-miniapp-root.match-center-open[data-cw233-mc-competition="coppa_italia"] {
  --cw233-mc-bg:#170d10;
  --cw233-mc-surface:rgba(255,255,255,.050);
  --cw233-mc-surface-strong:rgba(255,255,255,.072);
  --cw233-mc-border:rgba(206,43,55,.34);
  --cw233-mc-accent:#ce2b37;
  --cw233-mc-accent-2:#009246;
  --cw233-mc-away:#009246;
  --cw233-mc-glow:rgba(206,43,55,.24);
  --cw233-mc-glow-2:rgba(0,146,70,.17);
}
#ciao-miniapp-root.match-center-open[data-cw233-mc-competition="ucl"],
#ciao-miniapp-root.match-center-open[data-cw233-mc-competition="champions_league"] {
  --cw233-mc-bg:#080b29;
  --cw233-mc-surface:rgba(255,255,255,.052);
  --cw233-mc-surface-strong:rgba(255,255,255,.075);
  --cw233-mc-border:rgba(79,95,255,.32);
  --cw233-mc-accent:#3157ff;
  --cw233-mc-accent-2:#7b42ff;
  --cw233-mc-away:#aeb7dd;
  --cw233-mc-glow:rgba(49,87,255,.25);
  --cw233-mc-glow-2:rgba(123,66,255,.18);
}
#ciao-miniapp-root.match-center-open[data-cw233-mc-competition="uel"],
#ciao-miniapp-root.match-center-open[data-cw233-mc-competition="europa_league"] {
  --cw233-mc-bg:#160d08;
  --cw233-mc-surface:rgba(255,255,255,.050);
  --cw233-mc-surface-strong:rgba(255,255,255,.072);
  --cw233-mc-border:rgba(240,103,34,.32);
  --cw233-mc-accent:#f06722;
  --cw233-mc-accent-2:#ff9b32;
  --cw233-mc-away:#d1d4dd;
  --cw233-mc-glow:rgba(240,103,34,.25);
  --cw233-mc-glow-2:rgba(255,155,50,.15);
}
#ciao-miniapp-root.match-center-open[data-cw233-mc-competition="uecl"],
#ciao-miniapp-root.match-center-open[data-cw233-mc-competition="conference_league"] {
  --cw233-mc-bg:#06170f;
  --cw233-mc-surface:rgba(255,255,255,.050);
  --cw233-mc-surface-strong:rgba(255,255,255,.072);
  --cw233-mc-border:rgba(34,168,102,.32);
  --cw233-mc-accent:#22a866;
  --cw233-mc-accent-2:#55d68e;
  --cw233-mc-away:#d3ddd8;
  --cw233-mc-glow:rgba(34,168,102,.24);
  --cw233-mc-glow-2:rgba(85,214,142,.14);
}

/* Remove the old Serie A blue frame/background from the full Match Center viewport. */
#ciao-miniapp-root.match-center-open .mc-shell {
  background:
    radial-gradient(90% 46% at 12% -8%, var(--cw233-mc-glow), transparent 68%),
    radial-gradient(90% 46% at 90% -4%, var(--cw233-mc-glow-2), transparent 70%),
    var(--cw233-mc-bg) !important;
  box-shadow:none!important;
}
#ciao-miniapp-root.match-center-open .mc-toolbar {
  background:color-mix(in srgb, var(--cw233-mc-bg) 94%, black 6%)!important;
  border-bottom:1px solid var(--cw233-mc-border)!important;
  box-shadow:none!important;
}
#ciao-miniapp-root.match-center-open .mc-back {
  border-color:var(--cw233-mc-border)!important;
  background:var(--cw233-mc-surface)!important;
}
#ciao-miniapp-root.match-center-open .mc-back:active {
  background:var(--cw233-mc-surface-strong)!important;
}

/* One unified contained tab bar for Serie A and every external competition. */
#ciao-miniapp-root.match-center-open .mc-tabs-wrap {
  background:color-mix(in srgb, var(--cw233-mc-bg) 92%, transparent)!important;
  border-bottom:0!important;
  padding:8px 10px 10px!important;
  box-shadow:none!important;
}
#ciao-miniapp-root.match-center-open .mc-tabs {
  display:flex!important;
  gap:4px!important;
  overflow:visible!important;
  padding:5px!important;
  border:1px solid var(--cw233-mc-border)!important;
  border-radius:18px!important;
  background:var(--cw233-mc-surface)!important;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.018)!important;
}
#ciao-miniapp-root.match-center-open .mc-tab {
  flex:1 1 0!important;
  min-width:0!important;
  min-height:44px!important;
  padding:0 5px!important;
  border:0!important;
  border-radius:14px!important;
  background:transparent!important;
  color:rgba(235,240,250,.66)!important;
  box-shadow:none!important;
  white-space:nowrap!important;
  font-size:clamp(9px,2.45vw,11px)!important;
}
#ciao-miniapp-root.match-center-open .mc-tab.active {
  color:#fff!important;
  border:0!important;
  background:linear-gradient(135deg,var(--cw233-mc-accent),var(--cw233-mc-accent-2))!important;
  box-shadow:
    0 8px 24px color-mix(in srgb, var(--cw233-mc-accent) 25%, transparent),
    inset 0 0 0 1px rgba(255,255,255,.10)!important;
}

/* Core Match Center surfaces inherit the competition theme. */
#ciao-miniapp-root.match-center-open .mc-hero {
  border-color:var(--cw233-mc-border)!important;
  background:
    radial-gradient(75% 100% at 16% 0%, var(--cw233-mc-glow), transparent 72%),
    radial-gradient(70% 100% at 88% 0%, var(--cw233-mc-glow-2), transparent 72%),
    linear-gradient(145deg,var(--cw233-mc-surface-strong),var(--cw233-mc-surface))!important;
}
#ciao-miniapp-root.match-center-open .mc-status {
  border-color:var(--cw233-mc-border)!important;
  background:var(--cw233-mc-surface)!important;
}
#ciao-miniapp-root.match-center-open .mc-section,
#ciao-miniapp-root.match-center-open .mc-key,
#ciao-miniapp-root.match-center-open .mc-lineup,
#ciao-miniapp-root.match-center-open .mc-lineup-list,
#ciao-miniapp-root.match-center-open .mc-lineup-switch,
#ciao-miniapp-root.match-center-open .mc-rating-row,
#ciao-miniapp-root.match-center-open .mc-event,
#ciao-miniapp-root.match-center-open .cw14-info-item,
#ciao-miniapp-root.match-center-open .cw14-form-card,
#ciao-miniapp-root.match-center-open .cw20-stat-mini,
#ciao-miniapp-root.match-center-open .cw20-player-row,
#ciao-miniapp-root.match-center-open .cw20-event-card {
  border-color:var(--cw233-mc-border)!important;
}
#ciao-miniapp-root.match-center-open .mc-section,
#ciao-miniapp-root.match-center-open .mc-key,
#ciao-miniapp-root.match-center-open .mc-lineup,
#ciao-miniapp-root.match-center-open .mc-rating-row,
#ciao-miniapp-root.match-center-open .mc-event {
  background:var(--cw233-mc-surface)!important;
}
#ciao-miniapp-root.match-center-open .mc-section-title,
#ciao-miniapp-root.match-center-open .mc-key strong,
#ciao-miniapp-root.match-center-open .mc-rating {
  color:color-mix(in srgb,var(--cw233-mc-accent-2) 54%,white 46%)!important;
}
#ciao-miniapp-root.match-center-open .mc-bar.home i,
#ciao-miniapp-root.match-center-open .mc-momentum-bar.home i {
  background:linear-gradient(90deg,var(--cw233-mc-accent),var(--cw233-mc-accent-2))!important;
}
#ciao-miniapp-root.match-center-open .mc-bar.away i,
#ciao-miniapp-root.match-center-open .mc-momentum-bar.away i {
  background:var(--cw233-mc-away)!important;
}
#ciao-miniapp-root.match-center-open .mc-shot.home {
  background:var(--cw233-mc-accent)!important;
  border-color:#fff!important;
}
#ciao-miniapp-root.match-center-open .mc-shot.away {
  background:var(--cw233-mc-accent-2)!important;
  border-color:#fff!important;
}
#ciao-miniapp-root.match-center-open .mc-shirt,
#ciao-miniapp-root.match-center-open .mc-rating {
  border-color:var(--cw233-mc-border)!important;
  background:color-mix(in srgb,var(--cw233-mc-accent) 16%,var(--cw233-mc-surface))!important;
}

/* Predictions use the same competition palette instead of the legacy blue cards. */
#ciao-miniapp-root.match-center-open .cw20-pred-summary {
  border-color:var(--cw233-mc-border)!important;
  background:
    linear-gradient(145deg,
      color-mix(in srgb,var(--cw233-mc-accent) 19%,var(--cw233-mc-bg)),
      color-mix(in srgb,var(--cw233-mc-accent-2) 11%,var(--cw233-mc-bg)))!important;
}
#ciao-miniapp-root.match-center-open .cw20-pred-score {
  border-color:color-mix(in srgb,var(--cw233-mc-accent) 68%,white 8%)!important;
  background:linear-gradient(145deg,
    color-mix(in srgb,var(--cw233-mc-accent) 58%,var(--cw233-mc-bg)),
    color-mix(in srgb,var(--cw233-mc-accent-2) 38%,var(--cw233-mc-bg)))!important;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.055)!important;
}
#ciao-miniapp-root.match-center-open .cw20-pred-empty {
  border-color:var(--cw233-mc-border)!important;
  background:var(--cw233-mc-surface)!important;
}
#ciao-miniapp-root.match-center-open .mc-predsplit {
  border-color:var(--cw233-mc-border)!important;
}
#ciao-miniapp-root.match-center-open .mc-predsplit-track {
  border-color:var(--cw233-mc-border)!important;
  background:color-mix(in srgb,var(--cw233-mc-bg) 86%,white 3%)!important;
}
#ciao-miniapp-root.match-center-open .mc-predsplit-seg.home {
  background:var(--cw233-mc-accent)!important;
}
#ciao-miniapp-root.match-center-open .mc-predsplit-seg.draw {
  background:#aab7c9!important;
}
#ciao-miniapp-root.match-center-open .mc-predsplit-seg.away {
  background:var(--cw233-mc-accent-2)!important;
}
`;

export function installLegacyMatchCenterTheme(documentRef = globalThis.document) {
  if (!documentRef?.head || documentRef.getElementById?.(STYLE_ID)) return false;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  documentRef.head.appendChild(style);
  return true;
}

if (typeof globalThis.document !== 'undefined') installLegacyMatchCenterTheme(globalThis.document);
