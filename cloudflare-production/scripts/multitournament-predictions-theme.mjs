export const MULTITOURNAMENT_PREDICTIONS_THEME_MARKER = 'ciao-prod-multitournament-predictions-theme-20260907';
const PREDICTIONS_MARKER = 'ciao-prod-multitournament-predictions-20260907';
const FINAL_IIFE_MARKER = '  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script>';

export function multitournamentPredictionsThemeSource() {
  return `
  /* ${MULTITOURNAMENT_PREDICTIONS_THEME_MARKER} */
  try{const styleId='cwpred-theme-style';if(!document.getElementById(styleId)){const style=document.createElement('style');style.id=styleId;style.textContent='\
#ciao-miniapp-root{overflow-x:hidden}\
#ciao-miniapp-root .content{overflow-x:hidden!important}\
#ciao-miniapp-root .cwpred-mode{position:sticky;top:0;z-index:18;display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:0 0 14px;padding:5px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(6,11,25,.94);box-shadow:0 10px 30px rgba(0,0,0,.20)}\
#ciao-miniapp-root .cwpred-mode button{min-width:0;height:42px;border:0;border-radius:12px;background:transparent;color:rgba(255,255,255,.62);font:800 13px/1 inherit;letter-spacing:.01em;transition:transform .16s ease,background .16s ease,color .16s ease,box-shadow .16s ease}\
#ciao-miniapp-root .cwpred-mode button.active{color:#fff;background:linear-gradient(135deg,var(--cwpred-a,#3150ff),var(--cwpred-b,#0b2f88));box-shadow:0 8px 22px rgba(var(--cwpred-a-rgb,49,80,255),.22)}\
#ciao-miniapp-root .cwpred-mode button:active{transform:scale(.98)}\
#ciao-miniapp-root .cwpred-hub{padding-top:2px}\
#ciao-miniapp-root .cwpred-hub-title{margin-bottom:12px}\
#ciao-miniapp-root .cwpred-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}\
#ciao-miniapp-root .cwpred-tournament-card{position:relative;min-width:0;min-height:116px;padding:18px 16px;border:1px solid rgba(255,255,255,.10);border-radius:20px;overflow:hidden;text-align:left;color:#fff;background:#10182b;box-shadow:0 14px 34px rgba(0,0,0,.22);isolation:isolate}\
#ciao-miniapp-root .cwpred-tournament-card::before{content:"";position:absolute;inset:0;z-index:-2;background:radial-gradient(circle at 88% 12%,rgba(255,255,255,.15),transparent 34%)}\
#ciao-miniapp-root .cwpred-tournament-card::after{content:"";position:absolute;left:16px;right:16px;bottom:0;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.66),transparent);opacity:.65}\
#ciao-miniapp-root .cwpred-tournament-card span{display:block;max-width:86%;font-size:17px;font-weight:900;line-height:1.08;letter-spacing:-.02em}\
#ciao-miniapp-root .cwpred-tournament-card i{position:absolute;right:15px;bottom:14px;font:900 22px/1 inherit;font-style:normal;opacity:.82}\
#ciao-miniapp-root .cwpred-tournament-card--wide{grid-column:1/-1;min-height:126px}\
#ciao-miniapp-root .cwpred-tournament-card[data-cwpred-theme="serie-a"]{background:radial-gradient(circle at 78% 5%,rgba(90,119,255,.38),transparent 38%),linear-gradient(145deg,#122b84,#071331)}\
#ciao-miniapp-root .cwpred-tournament-card[data-cwpred-theme="coppa"]{background:radial-gradient(circle at 15% 5%,rgba(21,148,87,.33),transparent 36%),radial-gradient(circle at 95% 90%,rgba(159,36,53,.30),transparent 38%),linear-gradient(145deg,#13231d,#101313)}\
#ciao-miniapp-root .cwpred-tournament-card[data-cwpred-theme="champions"]{background:radial-gradient(circle at 78% 4%,rgba(83,103,230,.42),transparent 40%),linear-gradient(145deg,#171c56,#080d2c)}\
#ciao-miniapp-root .cwpred-tournament-card[data-cwpred-theme="europa"]{background:radial-gradient(circle at 82% 5%,rgba(230,106,19,.40),transparent 42%),linear-gradient(145deg,#291207,#100905)}\
#ciao-miniapp-root .cwpred-tournament-card[data-cwpred-theme="conference"]{background:radial-gradient(circle at 82% 5%,rgba(40,169,104,.38),transparent 42%),linear-gradient(145deg,#0c2d1d,#06130d)}\
#ciao-miniapp-root .cwpred-rules-note{margin:13px 2px 0;padding:11px 12px;border-radius:14px;background:rgba(255,255,255,.045);color:rgba(255,255,255,.58);font-size:11px;font-weight:700;line-height:1.4}\
#ciao-miniapp-root .cwpred-cover{margin:0 0 10px}\
#ciao-miniapp-root .cwpred-cover-row{display:flex;align-items:center;gap:10px;min-width:0}\
#ciao-miniapp-root .cwpred-cover-row h2{min-width:0;margin:0;font-size:22px;line-height:1.08;letter-spacing:-.025em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
#ciao-miniapp-root .cwpred-back{flex:0 0 40px;width:40px;height:40px;border-radius:13px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:#fff;font:900 21px/1 inherit}\
#ciao-miniapp-root .cwpred-rounds{display:flex!important;gap:7px!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none;padding:2px 1px 5px!important;margin:0 0 7px!important;overscroll-behavior-inline:contain}\
#ciao-miniapp-root .cwpred-rounds::-webkit-scrollbar{display:none}\
#ciao-miniapp-root .cwpred-rounds .round-chip{flex:0 0 auto!important;min-width:42px!important;height:40px!important;padding:0 12px!important;border-radius:14px!important;white-space:nowrap!important}\
#ciao-miniapp-root .cwpred-stage-title{margin-top:4px;margin-bottom:10px}\
#ciao-miniapp-root .cwpred-stage-title h3{font-size:17px}\
#ciao-miniapp-root .cwpred-stage-title span{font-size:11px}\
#ciao-miniapp-root .cwpred-cards{display:grid;gap:10px;min-width:0}\
#ciao-miniapp-root .cwpred-card{position:relative;min-width:0;padding:13px 12px 12px;border:1px solid rgba(var(--cwpred-a-rgb,49,80,255),.21);border-radius:20px;overflow:hidden;background:radial-gradient(circle at 50% -24%,rgba(var(--cwpred-a-rgb,49,80,255),.17),transparent 48%),radial-gradient(circle at 100% 0%,rgba(var(--cwpred-b-rgb,11,47,136),.10),transparent 34%),linear-gradient(180deg,var(--cwpred-card-top,#0d173a),var(--cwpred-card-bottom,#070e26));box-shadow:0 13px 30px rgba(0,0,0,.19)}\
#ciao-miniapp-root .cwpred-card::after{content:"";position:absolute;left:20px;right:20px;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(var(--cwpred-a-rgb,49,80,255),.62),transparent)}\
#ciao-miniapp-root .cwpred-card.closed{opacity:.84}\
#ciao-miniapp-root .cwpred-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:23px;margin-bottom:9px}\
#ciao-miniapp-root .cwpred-status{max-width:60%;padding:5px 8px;border:1px solid rgba(var(--cwpred-a-rgb,49,80,255),.22);border-radius:999px;background:rgba(var(--cwpred-a-rgb,49,80,255),.10);color:rgba(255,255,255,.88);font-size:9px;font-weight:900;letter-spacing:.045em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
#ciao-miniapp-root .cwpred-kickoff{flex:0 0 auto;color:rgba(255,255,255,.56);font-size:10px;font-weight:800;white-space:nowrap}\
#ciao-miniapp-root .cwpred-card-main{display:grid;grid-template-columns:minmax(0,1fr) minmax(96px,auto) minmax(0,1fr);align-items:center;gap:7px;min-width:0}\
#ciao-miniapp-root .cwpred-team{appearance:none;border:0;background:transparent;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-width:0;padding:2px;text-align:center}\
#ciao-miniapp-root button.cwpred-team--link{cursor:pointer}\
#ciao-miniapp-root .cwpred-team-logo,#ciao-miniapp-root .cwpred-team .logo{display:block;width:44px!important;height:44px!important;max-width:44px!important;flex:0 0 44px!important;object-fit:contain}\
#ciao-miniapp-root .cwpred-team-logo--empty{border-radius:50%;background:rgba(255,255,255,.05)}\
#ciao-miniapp-root .cwpred-team-name{display:-webkit-box;max-width:100%;overflow:hidden;color:#fff;font-size:11px;font-weight:850;line-height:1.15;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}\
#ciao-miniapp-root .cwpred-score-zone,#ciao-miniapp-root .cwpred-mine-zone{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;gap:6px}\
#ciao-miniapp-root .cwpred-score{display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;margin:0!important}\
#ciao-miniapp-root .cwpred-score>span,#ciao-miniapp-root .cwpred-score .colon{font-size:17px;font-weight:900;color:rgba(255,255,255,.66)}\
#ciao-miniapp-root .cwpred-score-side{display:grid!important;grid-template-columns:38px minmax(28px,auto) 38px!important;align-items:center!important;gap:3px!important}\
#ciao-miniapp-root .cwpred-score-side button{min-width:38px!important;width:38px!important;height:38px!important;padding:0!important;border-radius:12px!important;border:1px solid rgba(255,255,255,.10)!important;background:rgba(255,255,255,.065)!important;color:#fff!important;font-size:21px!important;font-weight:700!important}\
#ciao-miniapp-root .cwpred-score-side b,#ciao-miniapp-root .cwpred-score-side .score-value{min-width:28px!important;text-align:center!important;color:#fff!important;font-size:20px!important;font-weight:950!important}\
#ciao-miniapp-root .cwpred-save-state{min-height:14px;color:rgba(255,255,255,.42);font-size:9px;font-weight:800;text-align:center}\
#ciao-miniapp-root .cwpred-save-state.saved{color:#8be3b4}\
#ciao-miniapp-root .cwpred-save-state.dirty{color:#ffd28a}\
#ciao-miniapp-root .cwpred-locked-prediction{font-size:19px;font-weight:950;letter-spacing:.02em;white-space:nowrap}\
#ciao-miniapp-root .cwpred-card-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.055);color:rgba(255,255,255,.49);font-size:9px;font-weight:700}\
#ciao-miniapp-root .cwpred-card-bottom span:last-child{color:rgba(255,255,255,.78);font-weight:900}\
#ciao-miniapp-root .cwpred-mine-zone{gap:5px}\
#ciao-miniapp-root .cwpred-mine-prediction,#ciao-miniapp-root .cwpred-real-score{display:flex;flex-direction:column;align-items:center;gap:1px}\
#ciao-miniapp-root .cwpred-mine-prediction small,#ciao-miniapp-root .cwpred-real-score small{color:rgba(255,255,255,.42);font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.045em}\
#ciao-miniapp-root .cwpred-mine-prediction b{font-size:19px;font-weight:950;white-space:nowrap}\
#ciao-miniapp-root .cwpred-real-score b{font-size:14px;font-weight:900;white-space:nowrap}\
#ciao-miniapp-root .cwpred-points{padding:5px 8px;border-radius:10px;background:rgba(var(--cwpred-a-rgb,49,80,255),.15);color:#fff;font-size:10px;font-weight:950;white-space:nowrap}\
#ciao-miniapp-root .cwpred-savebar{position:sticky;bottom:calc(var(--ciao-nav-h,72px) + var(--ciao-safe-bottom,0px) + 6px);z-index:16;margin:12px -2px 0;padding:8px 2px 4px;background:linear-gradient(180deg,transparent,rgba(3,8,22,.94) 32%)}\
#ciao-miniapp-root .cwpred-save{width:100%;min-height:48px;border:1px solid rgba(255,255,255,.13)!important;border-radius:16px!important;background:linear-gradient(135deg,var(--cwpred-a,#3150ff),var(--cwpred-b,#0b2f88))!important;color:#fff!important;font-size:13px!important;font-weight:950!important;box-shadow:0 12px 28px rgba(var(--cwpred-a-rgb,49,80,255),.25)!important}\
#ciao-miniapp-root .cwpred-save:disabled{opacity:.62}\
#ciao-miniapp-root .cwpred-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:180px;padding:22px;border:1px solid rgba(255,255,255,.07);border-radius:18px;background:rgba(255,255,255,.035);color:rgba(255,255,255,.62);font-size:13px;text-align:center}\
#ciao-miniapp-root .cwpred-state button{min-height:40px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.07);color:#fff;font-weight:850}\
#ciao-miniapp-root .cwpred-state--error b{color:#fff}\
#ciao-miniapp-root[data-cwpred-screen-theme="serie-a"]{--cwpred-a:#3150ff;--cwpred-b:#0b2f88;--cwpred-a-rgb:49,80,255;--cwpred-b-rgb:11,47,136;--cwpred-card-top:#0d173a;--cwpred-card-bottom:#070e26;background:radial-gradient(circle at 50% -10%,rgba(49,80,255,.34),transparent 34%),radial-gradient(circle at 100% 12%,rgba(11,47,136,.18),transparent 30%),linear-gradient(180deg,#040919 0%,#050b1d 46%,#030817 100%)!important}\
#ciao-miniapp-root[data-cwpred-screen-theme="coppa"]{--cwpred-a:#159457;--cwpred-b:#9f2435;--cwpred-a-rgb:21,148,87;--cwpred-b-rgb:159,36,53;--cwpred-card-top:#10231b;--cwpred-card-bottom:#090f0d;background:radial-gradient(circle at 18% -8%,rgba(21,148,87,.30),transparent 34%),radial-gradient(circle at 92% 4%,rgba(159,36,53,.22),transparent 32%),linear-gradient(180deg,#07100d 0%,#090d0d 48%,#050908 100%)!important}\
#ciao-miniapp-root[data-cwpred-screen-theme="champions"]{--cwpred-a:#5367e6;--cwpred-b:#49318f;--cwpred-a-rgb:83,103,230;--cwpred-b-rgb:73,49,143;--cwpred-card-top:#151a4a;--cwpred-card-bottom:#090d25;background:radial-gradient(circle at 50% -8%,rgba(83,103,230,.34),transparent 35%),radial-gradient(circle at 96% 12%,rgba(73,49,143,.24),transparent 30%),linear-gradient(180deg,#070a20 0%,#090c25 48%,#050718 100%)!important}\
#ciao-miniapp-root[data-cwpred-screen-theme="europa"]{--cwpred-a:#e66a13;--cwpred-b:#7a2c05;--cwpred-a-rgb:230,106,19;--cwpred-b-rgb:122,44,5;--cwpred-card-top:#261207;--cwpred-card-bottom:#100a07;background:radial-gradient(circle at 50% -8%,rgba(230,106,19,.30),transparent 35%),radial-gradient(circle at 100% 10%,rgba(122,44,5,.24),transparent 30%),linear-gradient(180deg,#130904 0%,#120a06 48%,#090604 100%)!important}\
#ciao-miniapp-root[data-cwpred-screen-theme="conference"]{--cwpred-a:#28a968;--cwpred-b:#0b3b28;--cwpred-a-rgb:40,169,104;--cwpred-b-rgb:11,59,40;--cwpred-card-top:#0d281b;--cwpred-card-bottom:#07120d;background:radial-gradient(circle at 50% -8%,rgba(40,169,104,.30),transparent 35%),radial-gradient(circle at 100% 12%,rgba(11,59,40,.24),transparent 30%),linear-gradient(180deg,#06120c 0%,#07150f 48%,#040b08 100%)!important}\
#ciao-miniapp-root[data-cwpred-screen-theme] .header{background:linear-gradient(180deg,rgba(var(--cwpred-a-rgb),.14),rgba(3,8,23,.84) 78%,transparent)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}\
#ciao-miniapp-root[data-cwpred-screen-theme] .cwpred-mode{border-color:rgba(var(--cwpred-a-rgb),.18);background:rgba(5,9,20,.96)}\
#ciao-miniapp-root[data-cwpred-screen-theme] .cwpred-rounds .round-chip.active{background:linear-gradient(135deg,var(--cwpred-a),var(--cwpred-b))!important;border-color:rgba(255,255,255,.20)!important;box-shadow:0 8px 22px rgba(var(--cwpred-a-rgb),.20)}\
@media(max-width:390px){#ciao-miniapp-root .cwpred-mode{margin-bottom:11px;padding:4px;border-radius:14px}#ciao-miniapp-root .cwpred-mode button{height:39px;font-size:12px}#ciao-miniapp-root .cwpred-grid{gap:8px}#ciao-miniapp-root .cwpred-tournament-card{min-height:104px;padding:15px 13px;border-radius:18px}#ciao-miniapp-root .cwpred-tournament-card--wide{min-height:112px}#ciao-miniapp-root .cwpred-tournament-card span{font-size:15px}#ciao-miniapp-root .cwpred-card{padding:11px 9px 10px;border-radius:18px}#ciao-miniapp-root .cwpred-card-main{grid-template-columns:minmax(0,1fr) 90px minmax(0,1fr);gap:4px}#ciao-miniapp-root .cwpred-team-logo,#ciao-miniapp-root .cwpred-team .logo{width:38px!important;height:38px!important;max-width:38px!important;flex-basis:38px!important}#ciao-miniapp-root .cwpred-team-name{font-size:10px}#ciao-miniapp-root .cwpred-score{gap:3px!important}#ciao-miniapp-root .cwpred-score-side{grid-template-columns:32px 24px 32px!important;gap:1px!important}#ciao-miniapp-root .cwpred-score-side button{min-width:32px!important;width:32px!important;height:36px!important;border-radius:11px!important;font-size:19px!important}#ciao-miniapp-root .cwpred-score-side b,#ciao-miniapp-root .cwpred-score-side .score-value{min-width:24px!important;font-size:18px!important}#ciao-miniapp-root .cwpred-card-bottom{font-size:8px}#ciao-miniapp-root .cwpred-savebar{bottom:calc(var(--ciao-nav-h,68px) + var(--ciao-safe-bottom,0px) + 4px)}}\
';document.head.appendChild(style)}}catch(_e){}
  /* /${MULTITOURNAMENT_PREDICTIONS_THEME_MARKER} */
`;
}

export function injectMultitournamentPredictionsThemePatch(input) {
  const html = String(input || '');
  if (html.includes(MULTITOURNAMENT_PREDICTIONS_THEME_MARKER)) return html;
  if (!html.includes(PREDICTIONS_MARKER)) throw new Error('production Predictions runtime missing before Predictions theme');
  const index = html.lastIndexOf(FINAL_IIFE_MARKER);
  if (index < 0) throw new Error('production v22.5 final IIFE marker missing');
  return `${html.slice(0, index)}${multitournamentPredictionsThemeSource()}${html.slice(index)}`;
}

export function validateMultitournamentPredictionsThemePatchedHtml(input) {
  const html = String(input || '');
  const count = html.split(MULTITOURNAMENT_PREDICTIONS_THEME_MARKER).length - 1;
  if (count !== 2) throw new Error(`production predictions theme marker count invalid: ${count}`);
  for (const theme of ['serie-a','coppa','champions','europa','conference']) {
    if (!html.includes(`data-cwpred-screen-theme="${theme}"`)) throw new Error(`prediction theme missing: ${theme}`);
  }
  if (!html.includes('.cwpred-mode') || !html.includes('.cwpred-card') || !html.includes('.cwpred-savebar')) throw new Error('prediction theme component geometry missing');
  if (!html.includes('backdrop-filter:none!important')) throw new Error('prediction themed header repaint protection missing');
  return true;
}
