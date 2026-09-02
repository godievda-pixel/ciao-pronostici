const STYLE_ID = 'ciao-v233-round6-polish';

const CSS = `
/* Home: score and status are two independent rows, never one inline string. */
.cw231-today-score{display:grid!important;grid-template-rows:auto auto!important;justify-items:center!important;align-content:center!important;gap:4px!important;min-width:66px!important;line-height:1!important}
.cw231-today-score-value{display:block!important;min-width:48px!important;text-align:center!important;color:#fff!important;font-size:18px!important;font-weight:950!important;line-height:1!important;font-variant-numeric:tabular-nums!important;white-space:nowrap!important}
.cw231-today-score-status{display:block!important;max-width:76px!important;text-align:center!important;color:rgba(167,184,228,.68)!important;font-size:8px!important;font-weight:800!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}

/* Predictions: rounds/stages follow the same premium chips as the rest of the app. */
.cw233-pred-nav{display:flex!important;gap:7px!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;overscroll-behavior-x:contain!important;scrollbar-width:none!important;padding:3px 1px 12px!important;-webkit-overflow-scrolling:touch!important}
.cw233-pred-nav::-webkit-scrollbar{display:none!important}
.cw233-pred-nav button{flex:0 0 auto!important;min-width:54px!important;min-height:38px!important;padding:0 13px!important;border:1px solid rgba(132,153,255,.13)!important;border-radius:13px!important;background:rgba(255,255,255,.04)!important;color:#aebbe0!important;font:850 11px/1 'Manrope',sans-serif!important;white-space:nowrap!important}
.cw233-pred-nav button[aria-selected='true']{background:linear-gradient(180deg,#3150ff,#142bd6)!important;border-color:rgba(109,134,255,.58)!important;color:#fff!important;box-shadow:0 7px 18px rgba(30,58,222,.25),inset 0 1px 0 rgba(255,255,255,.16)!important}

/* Keep club crest geometry reserved before images decode to stop layout jumps. */
#ciao-miniapp-root .match .logo,#ciao-miniapp-root .mine-match .logo,#ciao-miniapp-root .cw231-today-team .logo{display:block!important;width:28px!important;height:28px!important;min-width:28px!important;flex:0 0 28px!important;object-fit:contain!important;aspect-ratio:1/1!important}
#ciao-miniapp-root .match span.logo,#ciao-miniapp-root .mine-match span.logo{border-radius:50%!important;background:rgba(255,255,255,.045)!important}

@media(max-width:390px){
  .cw231-today-score{min-width:58px!important}
  .cw231-today-score-value{font-size:17px!important}
  .cw233-pred-nav button{min-width:50px!important;padding:0 11px!important}
}
`;

export function installRound6PolishUi(documentRef = globalThis.document) {
  if (!documentRef?.createElement || !documentRef?.head) return null;
  if (documentRef.getElementById(STYLE_ID)) return documentRef.getElementById(STYLE_ID);
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  documentRef.head.appendChild(style);
  return style;
}

if (typeof document !== 'undefined') installRound6PolishUi(document);
