export const USER_FEEDBACK_ROUND11_BUILD = '2026-09-03-r11';

const STYLE_ID = 'ciao-v233-round11-performance-themes';
const THEME_BY_COMPETITION = Object.freeze({
  all:'serie-a', overall:'serie-a', serie_a:'serie-a', coppa_italia:'coppa',
  ucl:'champions', uel:'europa', uecl:'conference',
});

export function round11ThemeForCompetition(value) {
  return THEME_BY_COMPETITION[String(value || '').trim()] || 'serie-a';
}

const CSS = `
/* Round 11 deliberately removes the colored under-glow left by earlier premium layers. */
#ciao-v232-matches-overlay .cw232-group-tabs button[aria-selected='true'],
#ciao-v232-matches-overlay .cw232-coppa-tab.is-active,
#ciao-v232-matches-overlay .cw232-match-card{
  box-shadow:0 8px 18px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.08)!important
}
#ciao-v232-matches-overlay .cw232-match-card:after{display:none!important}

/* One tournament ambience across Matches, Predictions, Ranking and Tables. */
.cw233-prediction-page,.cw233-ranking-page,.cw233-tables-hub{
  --r11a:#315bff;--r11b:#183bd8;--r11soft:rgba(49,91,255,.15);--r11line:rgba(103,142,255,.28)
}
[data-cw233-round11-theme='coppa'],.cw233-tables-hub[data-cw233-theme='coppa']{
  --r11a:#e53b49;--r11b:#087e46;--r11soft:rgba(229,59,73,.13);--r11line:rgba(236,92,104,.26)
}
[data-cw233-round11-theme='champions'],.cw233-tables-hub[data-cw233-theme='champions']{
  --r11a:#4b63ff;--r11b:#222b9d;--r11soft:rgba(75,99,255,.15);--r11line:rgba(112,130,255,.28)
}
[data-cw233-round11-theme='europa'],.cw233-tables-hub[data-cw233-theme='europa']{
  --r11a:#ff790d;--r11b:#b84000;--r11soft:rgba(255,121,13,.13);--r11line:rgba(255,145,58,.27)
}
[data-cw233-round11-theme='conference'],.cw233-tables-hub[data-cw233-theme='conference']{
  --r11a:#22c875;--r11b:#087b46;--r11soft:rgba(34,200,117,.13);--r11line:rgba(73,218,141,.26)
}

#ciao-miniapp-root .content:has(.cw233-prediction-page[data-cw233-round11-theme='serie-a']),
#ciao-miniapp-root .content:has(.cw233-ranking-page[data-cw233-round11-theme='serie-a']),
#ciao-v233-tables-overlay:has(.cw233-tables-hub[data-cw233-round11-theme='serie-a']){
  background:radial-gradient(circle at 82% 4%,rgba(49,91,255,.22),transparent 36%),radial-gradient(circle at 4% 72%,rgba(16,68,164,.16),transparent 43%),linear-gradient(165deg,#081632 0%,#061027 48%,#050b1b 100%)!important
}
#ciao-miniapp-root .content:has(.cw233-prediction-page[data-cw233-round11-theme='coppa']),
#ciao-miniapp-root .content:has(.cw233-ranking-page[data-cw233-round11-theme='coppa']),
#ciao-v233-tables-overlay:has(.cw233-tables-hub[data-cw233-round11-theme='coppa']){
  background:radial-gradient(circle at 86% 6%,rgba(202,45,58,.17),transparent 35%),radial-gradient(circle at 4% 69%,rgba(0,143,72,.14),transparent 42%),linear-gradient(165deg,#171218 0%,#0d1215 48%,#07100d 100%)!important
}
#ciao-miniapp-root .content:has(.cw233-prediction-page[data-cw233-round11-theme='champions']),
#ciao-miniapp-root .content:has(.cw233-ranking-page[data-cw233-round11-theme='champions']),
#ciao-v233-tables-overlay:has(.cw233-tables-hub[data-cw233-round11-theme='champions']){
  background:radial-gradient(circle at 82% 5%,rgba(83,100,255,.24),transparent 37%),radial-gradient(circle at 5% 70%,rgba(44,31,141,.17),transparent 43%),linear-gradient(165deg,#0b1236 0%,#070d27 48%,#040817 100%)!important
}
#ciao-miniapp-root .content:has(.cw233-prediction-page[data-cw233-round11-theme='europa']),
#ciao-miniapp-root .content:has(.cw233-ranking-page[data-cw233-round11-theme='europa']),
#ciao-v233-tables-overlay:has(.cw233-tables-hub[data-cw233-round11-theme='europa']){
  background:radial-gradient(circle at 84% 6%,rgba(255,119,0,.20),transparent 36%),radial-gradient(circle at 4% 72%,rgba(129,48,0,.17),transparent 43%),linear-gradient(165deg,#201207 0%,#120d09 48%,#090909 100%)!important
}
#ciao-miniapp-root .content:has(.cw233-prediction-page[data-cw233-round11-theme='conference']),
#ciao-miniapp-root .content:has(.cw233-ranking-page[data-cw233-round11-theme='conference']),
#ciao-v233-tables-overlay:has(.cw233-tables-hub[data-cw233-round11-theme='conference']){
  background:radial-gradient(circle at 84% 6%,rgba(33,199,112,.19),transparent 36%),radial-gradient(circle at 5% 73%,rgba(8,103,57,.17),transparent 43%),linear-gradient(165deg,#081d14 0%,#07140f 48%,#050c09 100%)!important
}

.cw233-prediction-page .hero,.cw233-ranking-page .hero,
#ciao-v233-tables-overlay .cw233-tables-head{
  border-color:var(--r11line)!important;
  background:radial-gradient(circle at 92% 6%,var(--r11soft),transparent 46%),linear-gradient(145deg,rgba(20,36,78,.83),rgba(8,18,40,.90))!important;
  box-shadow:0 8px 18px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.04)!important
}
.cw233-prediction-page .cw233-pred-filters button[aria-selected='true'],
.cw233-prediction-page .cw231-prediction-tabs button[aria-selected='true'],
.cw233-prediction-page .cw233-pred-nav button[aria-selected='true'],
.cw233-ranking-page .cw233-ranking-filters button[aria-selected='true'],
#ciao-v233-tables-overlay .cw233-table-selector.is-active{
  background:linear-gradient(145deg,var(--r11a),var(--r11b))!important;
  border-color:rgba(255,255,255,.16)!important;
  box-shadow:0 8px 18px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.16)!important
}
.cw233-prediction-page [data-cw233-delta]{
  border-color:var(--r11line)!important;
  background:linear-gradient(145deg,color-mix(in srgb,var(--r11a) 24%,#172650),color-mix(in srgb,var(--r11b) 18%,#101a38))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important
}
.cw233-prediction-page .savebar .save{
  background:linear-gradient(145deg,var(--r11a),var(--r11b))!important;
  border-color:rgba(255,255,255,.14)!important;
  box-shadow:0 10px 22px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.15)!important
}
.cw233-prediction-page .match,.cw233-prediction-page .mine-card,
.cw233-ranking-page .card,#ciao-v233-tables-overlay .cw233-standing-table tbody td{
  border-color:var(--r11line)!important;
  box-shadow:0 8px 18px rgba(0,0,0,.13)!important
}
.cw233-prediction-page .match{
  background:radial-gradient(circle at 92% 8%,var(--r11soft),transparent 48%),linear-gradient(145deg,rgba(24,42,91,.90),rgba(12,24,55,.94))!important
}

/* Stable geometry prevents the header/filters/savebar from shifting while data refreshes. */
.cw233-prediction-page{min-height:calc(100dvh - 76px);padding-bottom:92px}
.cw233-prediction-page>.cw233-prediction-hero-slot>.hero,.cw233-prediction-page>.hero{min-height:89px;box-sizing:border-box}
.cw233-prediction-page .cw231-prediction-tabs{min-height:52px}
.cw233-prediction-page .cw233-pred-filters{min-height:45px}
.cw233-prediction-page .cw233-prediction-body-slot{min-height:320px}
.cw233-prediction-page .match{min-height:138px;contain:layout paint}
.cw233-prediction-page [data-cw233-pred-card] .logo{width:30px!important;height:30px!important;min-width:30px!important;min-height:30px!important;object-fit:contain}
.cw233-prediction-page .cw233-prediction-save-slot{min-height:66px}
.cw233-prediction-page .savebar{min-height:66px}
.cw233-ranking-page{min-height:calc(100dvh - 76px);padding-bottom:86px}
.cw233-ranking-page>.hero{min-height:101px;box-sizing:border-box}
.cw233-ranking-page .cw233-ranking-filters-wrap{min-height:54px}
.cw233-ranking-content{min-height:220px}

/* Future UEFA rounds stay visible but unmistakably locked. */
.cw233-prediction-page [data-cw233-pred-locked='true']{opacity:.48;filter:saturate(.55)}
.cw233-prediction-page [data-cw233-pred-locked='true']::after{content:' 🔒';font-size:10px}
.cw233-prediction-page .cw233-pred-round-locked{min-height:132px;display:grid;place-items:center;text-align:center;padding:22px;border:1px solid var(--r11line);border-radius:18px;background:rgba(7,14,34,.72);color:#9eb0df;font-size:12px;font-weight:750}
`;

function currentPredictionTheme(documentRef) {
  const selected = documentRef.querySelector?.('.cw233-prediction-page [data-cw233-filter][aria-selected="true"]');
  return round11ThemeForCompetition(selected?.dataset?.cw233Filter || 'all');
}

function currentRankingTheme(documentRef) {
  const selected = documentRef.querySelector?.('.cw233-ranking-page [data-cw233-rank-filter][aria-selected="true"]');
  return round11ThemeForCompetition(selected?.dataset?.cw233RankFilter || 'overall');
}

export function applyRound11Themes(documentRef = globalThis.document) {
  if (!documentRef?.querySelector) return false;
  const prediction = documentRef.querySelector('.cw233-prediction-page');
  if (prediction) prediction.dataset.cw233Round11Theme = currentPredictionTheme(documentRef);
  const ranking = documentRef.querySelector('.cw233-ranking-page');
  if (ranking) ranking.dataset.cw233Round11Theme = currentRankingTheme(documentRef);
  const tables = documentRef.querySelector('#ciao-v233-tables-overlay .cw233-tables-hub');
  if (tables) {
    const theme = round11ThemeForCompetition(tables.dataset?.cw233TablesSelected || 'serie_a');
    tables.dataset.cw233Theme = theme;
    tables.dataset.cw233Round11Theme = theme;
  }
  return Boolean(prediction || ranking || tables);
}

export function installRound11PerformanceThemes(documentRef = globalThis.document) {
  if (!documentRef?.head || !documentRef?.createElement) return null;
  if (!documentRef.getElementById(STYLE_ID)) {
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    documentRef.head.appendChild(style);
  }
  const refresh = () => queueMicrotask(() => applyRound11Themes(documentRef));
  documentRef.addEventListener?.('click', event => {
    if (event.target?.closest?.('[data-cw233-filter],[data-cw233-rank-filter],[data-cw233-tables-competition]')) refresh();
  });
  documentRef.addEventListener?.('ciao-v233-round11-theme', refresh);
  applyRound11Themes(documentRef);
  return Object.freeze({ refresh });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installRound11PerformanceThemes(document), { once:true });
  else installRound11PerformanceThemes(document);
}
