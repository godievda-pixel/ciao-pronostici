export const APP_THEME_STYLE_ID = 'ciao-v233-app-theme';
export const APP_THEME_TOKENS = Object.freeze({
  background:'#061128',
  backgroundDeep:'#040b1b',
  surface:'#0B1B3D',
  surfaceElevated:'#102755',
  border:'rgba(101,128,255,.18)',
  primary:'#315CFF',
  primary2:'#1937DF',
  text:'#FFFFFF',
  muted:'rgba(181,196,240,.68)',
});

export function appThemeCss(tokens = APP_THEME_TOKENS) {
  return `
:root{
  --cw-app-bg:${tokens.background};
  --cw-app-bg-deep:${tokens.backgroundDeep};
  --cw-surface:${tokens.surface};
  --cw-surface-elevated:${tokens.surfaceElevated};
  --cw-border:${tokens.border};
  --cw-primary:${tokens.primary};
  --cw-primary-2:${tokens.primary2};
  --cw-text:${tokens.text};
  --cw-muted:${tokens.muted};
}
html,body{
  background:var(--cw-app-bg-deep)!important;
}
#ciao-miniapp-root{
  --primary:var(--cw-primary);
  --primary-2:var(--cw-primary-2);
  --muted:var(--cw-muted);
  background:
    radial-gradient(circle at 78% -12%,rgba(49,92,255,.17),transparent 34%),
    linear-gradient(180deg,var(--cw-app-bg) 0%,var(--cw-app-bg-deep) 100%)!important;
  color:var(--cw-text)!important;
}
#ciao-miniapp-root .content{
  background:
    radial-gradient(circle at 85% -8%,rgba(49,92,255,.12),transparent 35%),
    linear-gradient(180deg,var(--cw-app-bg) 0%,var(--cw-app-bg-deep) 100%)!important;
}
#ciao-miniapp-root .cw233-prediction-page,
#ciao-miniapp-root .cw233-ranking-page{
  min-height:100%;
  background:transparent!important;
  color:var(--cw-text)!important;
}
#ciao-v232-matches-overlay,
#ciao-v233-tables-overlay{
  background:
    radial-gradient(circle at 82% -10%,rgba(49,92,255,.16),transparent 36%),
    linear-gradient(180deg,var(--cw-app-bg) 0%,var(--cw-app-bg-deep) 100%)!important;
  color:var(--cw-text)!important;
}
#ciao-miniapp-root .card,
#ciao-miniapp-root .hero:not(.match-hero),
#ciao-v233-tables-overlay .cw233-standing-legend{
  border-color:var(--cw-border)!important;
}
#ciao-miniapp-root .nav{
  background:rgba(4,11,30,.94)!important;
  border-top-color:rgba(91,119,224,.18)!important;
  box-shadow:0 -18px 40px rgba(1,5,18,.28)!important;
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
}
#ciao-miniapp-root .nav button.active,
#ciao-miniapp-root .nav button[aria-selected="true"]{
  background:linear-gradient(145deg,rgba(49,92,255,.34),rgba(25,55,223,.24))!important;
  border-color:rgba(94,125,255,.48)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 8px 20px rgba(21,53,209,.18)!important;
}
`;
}

export function installAppTheme(documentRef = globalThis.document) {
  if (!documentRef?.head || !documentRef?.createElement) return null;
  const existing = documentRef.getElementById?.(APP_THEME_STYLE_ID);
  if (existing) return existing;
  const style = documentRef.createElement('style');
  style.id = APP_THEME_STYLE_ID;
  style.textContent = appThemeCss();
  documentRef.head.appendChild(style);
  return style;
}

if (typeof document !== 'undefined') installAppTheme(document);
