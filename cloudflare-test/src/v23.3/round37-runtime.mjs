export const USER_FEEDBACK_ROUND37_BUILD = '2026-09-04-r37';

const STYLE_ID = 'ciao-v233-round37-runtime-style';
const CARD_THEMES = Object.freeze({
  'serie-a':Object.freeze({ accent:'#0c5aa8', accent2:'#287fc7' }),
  coppa:Object.freeze({ accent:'#e53b49', accent2:'#087e46' }),
  champions:Object.freeze({ accent:'#4b63ff', accent2:'#222b9d' }),
  europa:Object.freeze({ accent:'#ff790d', accent2:'#b84000' }),
  conference:Object.freeze({ accent:'#22c875', accent2:'#087b46' }),
});

let installed = null;

function text(value) { return String(value ?? '').trim(); }

export function predictionCardTheme(theme) {
  return CARD_THEMES[text(theme)] || CARD_THEMES['serie-a'];
}

function ensureStyle(documentRef) {
  if (!documentRef?.head || !documentRef?.createElement || documentRef.getElementById?.(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
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
`;
  documentRef.head.appendChild(style);
}

export function installRound37Runtime(documentRef = globalThis.document, rootRef = globalThis) {
  if (!documentRef?.addEventListener) return null;
  if (installed) return installed;
  ensureStyle(documentRef);
  installed = Object.freeze({
    disconnect() {
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
