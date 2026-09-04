export const USER_FEEDBACK_ROUND30_BUILD = '2026-09-04-r30';

const STYLE_ID = 'ciao-v233-round30-feedback-fixes';

const SURFACE_THEMES = Object.freeze({
  overall:'neutral',
  all:'neutral',
  serie_a:'serie-a',
  coppa_italia:'coppa',
  ucl:'champions',
  uel:'europa',
  uecl:'conference',
});

export function round30SurfaceTheme(surface, value) {
  const key = String(value ?? '').trim();
  if (surface === 'ranking' && key === 'overall') return 'neutral';
  if (surface === 'predictions' && key === 'all') return 'neutral';
  return SURFACE_THEMES[key] || 'neutral';
}

export const ROUND30_CSS = `
/* Overall ranking and All predictions are app-neutral. Serie A blue belongs only to Serie A. */
#ciao-miniapp-root .cw233-ranking-page:has([data-cw233-rank-filter='overall'][aria-selected='true']),
#ciao-miniapp-root .cw233-prediction-page:has([data-cw233-filter='all'][aria-selected='true']){
  --r11a:#546681;
  --r11b:#334158;
  --r11soft:rgba(255,255,255,.055);
  --r11line:rgba(255,255,255,.11);
}
#ciao-miniapp-root .content:has(.cw233-ranking-page:has([data-cw233-rank-filter='overall'][aria-selected='true'])),
#ciao-miniapp-root .content:has(.cw233-prediction-page:has([data-cw233-filter='all'][aria-selected='true'])){
  background:radial-gradient(circle at 85% 4%,rgba(75,91,118,.12),transparent 37%),radial-gradient(circle at 4% 72%,rgba(33,43,59,.14),transparent 43%),linear-gradient(165deg,#08111e 0%,#070e19 50%,#050a12 100%)!important;
}
#ciao-miniapp-root .cw233-ranking-page:has([data-cw233-rank-filter='overall'][aria-selected='true']) .cw233-ranking-hero,
#ciao-miniapp-root .cw233-prediction-page:has([data-cw233-filter='all'][aria-selected='true']) .hero{
  border-color:var(--r11line)!important;
  background:radial-gradient(circle at 90% 8%,var(--r11soft),transparent 46%),linear-gradient(145deg,rgba(23,33,50,.94),rgba(9,16,28,.96))!important;
}

/* Ranking surfaces inherit the selected tournament instead of a global blue card skin. */
#ciao-miniapp-root .cw233-ranking-page .cw233-ranking-hero,
#ciao-miniapp-root .cw233-ranking-page .cw233-ranking-section>.card,
#ciao-miniapp-root .cw233-ranking-page .cw233-ranking-row:not(.is-podium){
  border-color:var(--r11line)!important;
  background:radial-gradient(circle at 92% 8%,var(--r11soft),transparent 52%),linear-gradient(145deg,rgba(20,30,50,.92),rgba(8,15,27,.96))!important;
}
#ciao-miniapp-root .cw233-ranking-page .cw233-ranking-filters button:not([aria-selected='true']),
#ciao-miniapp-root .cw233-prediction-page .cw233-pred-filters button:not([aria-selected='true']){
  border-color:rgba(255,255,255,.10)!important;
  background:rgba(255,255,255,.045)!important;
  color:#d8e0ee!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important;
}
#ciao-miniapp-root .cw233-ranking-page .cw233-ranking-filters button[aria-selected='true'],
#ciao-miniapp-root .cw233-prediction-page .cw233-pred-filters button[aria-selected='true']{
  background:linear-gradient(145deg,var(--r11a),var(--r11b))!important;
  border-color:rgba(255,255,255,.16)!important;
}

/* Favorite club crest replaces initials in ranking avatars. */
#ciao-miniapp-root .cw233-ranking-avatar{
  display:grid!important;
  place-items:center!important;
  overflow:hidden!important;
}
#ciao-miniapp-root .cw233-ranking-club-logo{
  display:block!important;
  width:27px!important;
  height:27px!important;
  max-width:82%!important;
  max-height:82%!important;
  object-fit:contain!important;
}
#ciao-miniapp-root .cw233-ranking-avatar--hero .cw233-ranking-club-logo{
  width:34px!important;
  height:34px!important;
}
#ciao-miniapp-root .cw233-ranking-club-placeholder{
  font-size:17px!important;
  line-height:1!important;
  color:#dbe4f2!important;
}

/* Place and points occupy truly centered cells in the participant hero. */
#ciao-miniapp-root .cw233-ranking-stat{
  align-items:center!important;
  justify-content:center!important;
  text-align:center!important;
}
#ciao-miniapp-root .cw233-ranking-stat strong,
#ciao-miniapp-root .cw233-ranking-stat span{
  width:100%!important;
  text-align:center!important;
}

/* Match Center exclusively owns the viewport; do not leave the tournament Matches header/frame behind it. */
#ciao-miniapp-root.match-center-open #ciao-v232-matches-overlay{
  display:none!important;
}
#ciao-miniapp-root.match-center-open .mc-back{
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  padding:0!important;
  line-height:1!important;
  text-align:center!important;
}
#ciao-miniapp-root.match-center-open .mc-shell,
#ciao-miniapp-root.match-center-open .mc-toolbar,
#ciao-miniapp-root.match-center-open [data-mc-tab-content]{
  outline:0!important;
  box-shadow:none!important;
}
`;

export function installRound30FeedbackFixes(documentRef = globalThis.document) {
  if (!documentRef?.head || !documentRef?.createElement) return null;
  if (!documentRef.getElementById(STYLE_ID)) {
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = ROUND30_CSS;
    documentRef.head.appendChild(style);
  }
  return Object.freeze({ disconnect(){} });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installRound30FeedbackFixes(document), { once:true });
  else installRound30FeedbackFixes(document);
}
