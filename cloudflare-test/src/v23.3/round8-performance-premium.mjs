export const USER_FEEDBACK_ROUND8_BUILD = '2026-09-03-r8';

const STYLE_ID = 'ciao-v233-round8-premium-style';
const THEME_BY_COMPETITION = Object.freeze({
  serie_a:'serie-a',
  coppa_italia:'coppa',
  ucl:'champions',
  uel:'europa',
  uecl:'conference',
});

export function round8ThemeForCompetition(competition) {
  return THEME_BY_COMPETITION[String(competition || '').trim()] || 'serie-a';
}

const ROUND8_CSS = `
/* Round 8: stable predictions */
#ciao-miniapp-root .cw231-prediction-tabs{min-height:52px}
#ciao-miniapp-root .cw233-pred-filters{min-height:45px}
#ciao-miniapp-root .cw233-prediction-loading{min-height:360px;display:grid;align-content:start;gap:12px;padding-top:8px}
#ciao-miniapp-root [data-cw233-pred-card]{contain:layout paint;content-visibility:auto;contain-intrinsic-size:auto 138px}
#ciao-miniapp-root [data-cw233-pred-card] .logo{width:30px!important;height:30px!important;min-width:30px!important;min-height:30px!important;object-fit:contain;display:block}
#ciao-miniapp-root [data-cw233-pred-card] span.logo{border-radius:50%;background:rgba(79,104,180,.12)}

/* Round 8: premium match surfaces, copied from the Serie A visual hierarchy */
#ciao-v232-matches-overlay .cw232-competition{
  --cw232-accent:#3150ff;--cw232-accent-2:#172bd7;--cw232-soft:rgba(49,80,255,.16);--cw232-border:rgba(104,130,255,.28);--cw232-glow:rgba(34,65,230,.22);--cw232-surface:rgba(16,31,76,.88)
}
#ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='serie-a']{--cw232-accent:#315bff;--cw232-accent-2:#173ad6;--cw232-soft:rgba(49,91,255,.16);--cw232-border:rgba(104,145,255,.3);--cw232-glow:rgba(38,78,235,.24);--cw232-surface:rgba(14,34,85,.9)}
#ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='coppa']{--cw232-accent:#e63946;--cw232-accent-2:#078c4b;--cw232-soft:rgba(230,57,70,.14);--cw232-border:rgba(236,92,102,.27);--cw232-glow:rgba(215,55,69,.18);--cw232-surface:rgba(34,27,43,.92)}
#ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='champions']{--cw232-accent:#445cff;--cw232-accent-2:#20289e;--cw232-soft:rgba(68,92,255,.17);--cw232-border:rgba(103,121,255,.3);--cw232-glow:rgba(54,69,222,.25);--cw232-surface:rgba(18,27,74,.92)}
#ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='europa']{--cw232-accent:#ff7500;--cw232-accent-2:#bf4200;--cw232-soft:rgba(255,117,0,.14);--cw232-border:rgba(255,139,45,.28);--cw232-glow:rgba(232,93,0,.2);--cw232-surface:rgba(48,27,15,.92)}
#ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='conference']{--cw232-accent:#24c873;--cw232-accent-2:#087844;--cw232-soft:rgba(36,200,115,.14);--cw232-border:rgba(73,216,139,.27);--cw232-glow:rgba(22,163,91,.2);--cw232-surface:rgba(13,48,35,.92)}
#ciao-v232-matches-overlay .cw232-competition__head{margin-bottom:2px}
#ciao-v232-matches-overlay .cw232-group-tabs{gap:9px;padding:3px 1px 17px;scroll-snap-type:x proximity}
#ciao-v232-matches-overlay .cw232-group-tabs button{min-width:54px;height:46px;padding:0 16px;border-radius:14px;border:1px solid rgba(121,145,212,.13);background:linear-gradient(180deg,rgba(28,43,87,.9),rgba(15,27,62,.9));color:#fff;font-size:12px;font-weight:850;scroll-snap-align:start;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}
#ciao-v232-matches-overlay .cw232-group-tabs button[aria-selected='true']{background:linear-gradient(145deg,var(--cw232-accent),var(--cw232-accent-2));border-color:rgba(255,255,255,.2);box-shadow:0 9px 24px var(--cw232-glow),inset 0 1px 0 rgba(255,255,255,.22)}
#ciao-v232-matches-overlay .cw232-stage__title{margin:2px 0 11px;align-items:baseline}
#ciao-v232-matches-overlay .cw232-stage__title h3{font-size:22px;line-height:1.05;letter-spacing:-.045em;font-weight:900}
#ciao-v232-matches-overlay .cw232-stage__title span{font-size:10px;color:#8ca5ef;opacity:1}
#ciao-v232-matches-overlay .cw232-match-list{gap:12px}
#ciao-v232-matches-overlay .cw232-match-card{position:relative;min-height:138px;padding:13px 14px 17px;border-radius:22px;border:1px solid var(--cw232-border);background:radial-gradient(circle at 50% -28%,var(--cw232-soft),transparent 58%),linear-gradient(145deg,var(--cw232-surface),rgba(7,16,42,.94));box-shadow:0 14px 32px rgba(0,0,0,.17),inset 0 1px 0 rgba(255,255,255,.025);overflow:hidden;backdrop-filter:blur(15px)}
#ciao-v232-matches-overlay .cw232-match-card:before{content:'';position:absolute;inset:0 auto 0 0;width:2px;background:linear-gradient(180deg,transparent,var(--cw232-accent),transparent);opacity:.7}
#ciao-v232-matches-overlay .cw232-match-card__topline{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:25px;margin-bottom:8px}
#ciao-v232-matches-overlay .cw232-match-card__status{display:inline-flex;align-items:center;min-height:24px;padding:0 9px;border:1px solid var(--cw232-border);border-radius:999px;background:var(--cw232-soft);font-size:9px;line-height:1;font-weight:900;letter-spacing:.035em;text-transform:uppercase;color:#d8e1ff;white-space:nowrap}
#ciao-v232-matches-overlay .cw232-match-card__kickoff{font-size:10px;font-weight:850;color:#a9bcff;font-variant-numeric:tabular-nums;white-space:nowrap}
#ciao-v232-matches-overlay .cw232-match-card__teams{grid-template-columns:minmax(0,1fr) 84px minmax(0,1fr);gap:8px;align-items:center}
#ciao-v232-matches-overlay .cw232-match-team,#ciao-v232-matches-overlay .cw232-match-team--away{flex-direction:column;justify-content:center;gap:6px;text-align:center}
#ciao-v232-matches-overlay .cw232-match-team strong{font-size:12px;line-height:1.15;font-weight:850;max-width:120px;overflow-wrap:anywhere}
#ciao-v232-matches-overlay .cw232-team-logo{width:47px;height:47px;flex:0 0 47px;filter:drop-shadow(0 6px 11px rgba(0,0,0,.2))}
#ciao-v232-matches-overlay .cw232-team-logo--empty{background:rgba(71,95,164,.12)}
#ciao-v232-matches-overlay .cw232-match-card__center{display:grid;place-items:center;align-content:center;gap:4px;min-height:64px}
#ciao-v232-matches-overlay .cw232-match-card__score{font-size:27px;line-height:1;font-weight:900;letter-spacing:.06em;color:#8ba6f3;font-variant-numeric:tabular-nums}
#ciao-v232-matches-overlay .cw232-match-card__score .cw232-score-colon{display:inline-block;margin:0 5px;color:#b8c8ff}
#ciao-v232-matches-overlay .cw232-match-card__center small{margin:0;font-size:8px;font-weight:850;letter-spacing:.035em;text-transform:uppercase;color:#6685dc}
#ciao-v232-matches-overlay .cw232-coppa-tabs{border-color:var(--cw232-border);background:rgba(9,18,42,.66)}
#ciao-v232-matches-overlay .cw232-coppa-tab.is-active{background:linear-gradient(145deg,var(--cw232-accent),var(--cw232-accent-2));box-shadow:0 8px 20px var(--cw232-glow)}

/* Round 8: tournament-aware premium Tables */
#ciao-v233-tables-overlay .cw233-tables-hub{--cw233-table-accent:#315bff;--cw233-table-accent-2:#173ad6;--cw233-table-soft:rgba(49,91,255,.14);--cw233-table-border:rgba(104,145,255,.25);--cw233-table-glow:rgba(38,78,235,.2)}
#ciao-v233-tables-overlay .cw233-tables-hub[data-cw233-theme='coppa']{--cw233-table-accent:#e63946;--cw233-table-accent-2:#078c4b;--cw233-table-soft:rgba(230,57,70,.13);--cw233-table-border:rgba(236,92,102,.25);--cw233-table-glow:rgba(215,55,69,.16)}
#ciao-v233-tables-overlay .cw233-tables-hub[data-cw233-theme='champions']{--cw233-table-accent:#445cff;--cw233-table-accent-2:#20289e;--cw233-table-soft:rgba(68,92,255,.14);--cw233-table-border:rgba(103,121,255,.27);--cw233-table-glow:rgba(54,69,222,.2)}
#ciao-v233-tables-overlay .cw233-tables-hub[data-cw233-theme='europa']{--cw233-table-accent:#ff7500;--cw233-table-accent-2:#bf4200;--cw233-table-soft:rgba(255,117,0,.12);--cw233-table-border:rgba(255,139,45,.25);--cw233-table-glow:rgba(232,93,0,.17)}
#ciao-v233-tables-overlay .cw233-tables-hub[data-cw233-theme='conference']{--cw233-table-accent:#24c873;--cw233-table-accent-2:#087844;--cw233-table-soft:rgba(36,200,115,.12);--cw233-table-border:rgba(73,216,139,.24);--cw233-table-glow:rgba(22,163,91,.17)}
#ciao-v233-tables-overlay .cw233-tables-head{position:relative;margin:1px 0 14px;padding:18px 17px;border:1px solid var(--cw233-table-border);border-radius:22px;background:radial-gradient(circle at 92% 0,var(--cw233-table-soft),transparent 44%),linear-gradient(145deg,rgba(19,36,82,.72),rgba(8,19,43,.84));box-shadow:0 13px 30px rgba(0,0,0,.15),inset 0 1px 0 rgba(255,255,255,.03);overflow:hidden}
#ciao-v233-tables-overlay .cw233-tables-head:after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,var(--cw233-table-accent),transparent);opacity:.7}
#ciao-v233-tables-overlay .cw233-table-selectors{gap:9px}
#ciao-v233-tables-overlay .cw233-table-selector{min-height:43px;border-radius:14px;border-color:rgba(124,145,205,.15);background:linear-gradient(180deg,rgba(24,38,78,.86),rgba(13,25,56,.88));color:#acb9df;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)}
#ciao-v233-tables-overlay .cw233-table-selector.is-active{background:linear-gradient(145deg,var(--cw233-table-accent),var(--cw233-table-accent-2));color:#fff;border-color:rgba(255,255,255,.18);box-shadow:0 8px 22px var(--cw233-table-glow),inset 0 1px 0 rgba(255,255,255,.18)}
#ciao-v233-tables-overlay .cw233-standing-table td{border-top-color:var(--cw233-table-border);border-bottom-color:var(--cw233-table-border);background:radial-gradient(circle at 0 50%,var(--cw233-table-soft),transparent 37%),linear-gradient(180deg,rgba(20,34,61,.98),rgba(12,23,43,.98))}
#ciao-v233-tables-overlay .cw233-standing-table td:first-child{border-left-color:var(--cw233-table-border)}
#ciao-v233-tables-overlay .cw233-standing-table td:last-child{border-right-color:var(--cw233-table-border)}
#ciao-v233-tables-overlay .cw233-standing-position{color:var(--cw233-table-accent);text-shadow:0 0 16px var(--cw233-table-glow)}
#ciao-v233-tables-overlay .cw233-standing-points{font-weight:950;color:#fff}
#ciao-v233-tables-overlay .cw233-table-logo{width:34px!important;height:34px!important;min-width:34px!important;min-height:34px!important;object-fit:contain;border-radius:10px;padding:3px;background:rgba(255,255,255,.035);box-shadow:inset 0 0 0 1px rgba(255,255,255,.035)}
#ciao-v233-tables-overlay .cw233-table-logo--empty{display:inline-grid;place-items:center;color:#879bd7;font-size:9px;font-weight:900;background:var(--cw233-table-soft)}
#ciao-v233-tables-overlay .cw233-standing-team strong{font-weight:850;letter-spacing:-.015em}
`;

function matchStatusLabel(card) {
  const score = String(card.querySelector?.('.cw232-match-card__score')?.textContent || '').trim();
  const meta = String(card.querySelector?.('.cw232-match-card__center small')?.textContent || '').trim();
  if (/live/i.test(meta)) return 'LIVE';
  if (/заверш|\d+\s*:\s*\d+/.test(meta) && score !== '—') return 'МАТЧ ЗАВЕРШЁН';
  if (/перенес/i.test(meta)) return 'МАТЧ ПЕРЕНЕСЁН';
  if (/отмен/i.test(meta)) return 'МАТЧ ОТМЕНЁН';
  return 'МАТЧ НЕ НАЧАЛСЯ';
}

function decorateMatchCard(card) {
  if (!card || card.dataset?.cw233Round8 === '1') return;
  const center = card.querySelector?.('.cw232-match-card__center');
  const score = card.querySelector?.('.cw232-match-card__score');
  const meta = center?.querySelector?.('small');
  if (!center || !score || !meta) return;

  const status = matchStatusLabel(card);
  const scheduled = status === 'МАТЧ НЕ НАЧАЛСЯ';
  const kickoff = String(meta.textContent || '').trim();
  const top = card.ownerDocument.createElement('div');
  top.className = 'cw232-match-card__topline';
  top.innerHTML = `<span class="cw232-match-card__status">${status}</span><span class="cw232-match-card__kickoff">${scheduled ? kickoff : ''}</span>`;
  card.prepend(top);
  center.classList.add('cw232-match-card__versus');
  if (scheduled) {
    score.innerHTML = '<span>—</span><span class="cw232-score-colon">:</span><span>—</span>';
    meta.textContent = 'ОЖИДАЕМ НАЧАЛО';
  }
  card.dataset.cw233Round8 = '1';
}

function decorateMatchPanels(root) {
  const competition = root.querySelector?.('#ciao-v232-matches-overlay .cw232-competition');
  if (!competition) return;
  for (const tab of competition.querySelectorAll?.('.cw232-group-tabs [data-cw232-group-key]') || []) {
    const key = String(tab.dataset?.cw232GroupKey || '');
    const round = key.match(/^round:(\d+)$/)?.[1];
    if (round && tab.dataset?.cw233Round8 !== '1') {
      tab.textContent = round;
      tab.dataset.cw233Round8 = '1';
    }
  }
  for (const panel of competition.querySelectorAll?.('.cw232-group-panel') || []) {
    const heading = panel.querySelector?.('.cw232-stage__title h3');
    const count = panel.querySelector?.('.cw232-stage__title span');
    if (heading && heading.dataset?.cw233Round8 !== '1') {
      const round = String(panel.dataset?.cw232GroupPanel || '').match(/^round:(\d+)$/)?.[1];
      if (round) heading.textContent = `Матчи · ${round}-й тур`;
      heading.dataset.cw233Round8 = '1';
    }
    if (count && !/матч/i.test(String(count.textContent || ''))) count.textContent = `${count.textContent} матчей`;
  }
  for (const card of competition.querySelectorAll?.('.cw232-match-card') || []) decorateMatchCard(card);
}

export function applyRound8PremiumDom(root = globalThis.document) {
  if (!root?.querySelector) return false;
  decorateMatchPanels(root);
  return true;
}

export function installRound8PerformancePremium(documentRef = globalThis.document) {
  if (!documentRef?.head || !documentRef?.createElement) return null;
  if (!documentRef.getElementById(STYLE_ID)) {
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = ROUND8_CSS;
    documentRef.head.appendChild(style);
  }

  let queued = false;
  const refresh = () => {
    if (queued) return;
    queued = true;
    const run = () => {
      queued = false;
      applyRound8PremiumDom(documentRef);
    };
    if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(run);
    else setTimeout(run, 0);
  };

  applyRound8PremiumDom(documentRef);
  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(refresh)
    : null;
  observer?.observe?.(documentRef.body || documentRef.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden','aria-selected'] });
  return Object.freeze({ refresh, disconnect:() => observer?.disconnect?.() });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installRound8PerformancePremium(document), { once:true });
  else installRound8PerformancePremium(document);
}
