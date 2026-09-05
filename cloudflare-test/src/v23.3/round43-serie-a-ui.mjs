export const ROUND43_SERIE_A_STYLE_ID = 'ciao-v233-round43-serie-a-ui';

export const ROUND43_SERIE_A_CSS = `
.cw232-competition[data-cw232-competition='serie_a']{
  --cw232-match-accent:#0c5aa8;
  --cw232-match-accent-2:#287fc7;
  --cw232-match-bg:#071626;
  --cw232-match-border:rgba(40,127,199,.28);
  --cw232-match-glow:rgba(12,90,168,.15);
}
.cw232-competition[data-cw232-competition='serie_a'] .cw232-match-card{
  background:
    radial-gradient(circle at 92% 8%,rgba(12,90,168,.15),transparent 48%),
    linear-gradient(145deg,rgba(24,42,91,.90),rgba(12,24,55,.94));
  border-color:rgba(40,127,199,.28);
  box-shadow:0 18px 34px rgba(2,10,24,.26),inset 0 1px 0 rgba(255,255,255,.04);
}
.cw232-competition[data-cw232-competition='serie_a'] .cw232-match-card__status{
  border-color:rgba(40,127,199,.42);
  background:rgba(12,90,168,.18);
  color:#9acdf3;
}
.cw232-competition[data-cw232-competition='serie_a'] .cw232-group-tabs button[aria-selected='true']{
  background:linear-gradient(180deg,#287fc7,#0c5aa8);
  border-color:rgba(103,174,224,.48);
  color:#fff;
}
`;

export function installRound43SerieAUi(documentRef = globalThis.document) {
  if (!documentRef?.createElement) return null;
  const existing = documentRef.getElementById?.(ROUND43_SERIE_A_STYLE_ID);
  if (existing) return existing;
  const style = documentRef.createElement('style');
  style.id = ROUND43_SERIE_A_STYLE_ID;
  style.textContent = ROUND43_SERIE_A_CSS;
  (documentRef.head || documentRef.documentElement || documentRef.body)?.appendChild?.(style);
  return style;
}

if (typeof document !== 'undefined') installRound43SerieAUi(document);
