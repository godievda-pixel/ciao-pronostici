const STYLE_ID = 'cw233-round16-runtime-style';
const TABLE_LABELS = Object.freeze({ serie_a:'Серия А', ucl:'ЛЧ', uel:'ЛЕ', uecl:'ЛК', coppa_italia:'КИ' });
const TABLE_TITLES = Object.freeze({ serie_a:'Серия А', ucl:'Лига Чемпионов', uel:'Лига Европы', uecl:'Лига Конференций', coppa_italia:'Кубок Италии' });
const RANKING_LABELS = Object.freeze({ overall:'Общий', serie_a:'Серия А', coppa_italia:'КИ', ucl:'ЛЧ', uel:'ЛЕ', uecl:'ЛК' });
const RANKING_TITLES = Object.freeze({ overall:'Общий рейтинг', serie_a:'Серия А', coppa_italia:'Кубок Италии', ucl:'Лига Чемпионов', uel:'Лига Европы', uecl:'Лига Конференций' });

export function tableSelectorLabel(key) { return TABLE_LABELS[key] || key || ''; }
export function tableSectionTitle(key) { return TABLE_TITLES[key] || 'Таблицы'; }
export function rankingSectionTitle(key) { return RANKING_TITLES[key] || 'Рейтинг'; }
export function rankingSelectorLabel(key) { return RANKING_LABELS[key] || key || ''; }
export function profileStatsFromRankingRow(row = null) {
  return Object.freeze({
    points:Number(row?.points)||0,
    exactScores:Number(row?.exact_scores)||0,
    correctOutcomes:Number(row?.correct_outcomes)||0,
    scoredPredictions:Number(row?.scored_predictions)||0,
  });
}

function installStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style=documentRef.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    #ciao-v232-matches-overlay{transition:none!important;}
    #ciao-v233-tables-overlay .cw233-table-selectors-viewport{overflow:hidden!important;overscroll-behavior-x:none!important;}
    #ciao-v233-tables-overlay .cw233-table-selectors{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important;min-width:0!important;width:100%!important;overflow:hidden!important;}
    #ciao-v233-tables-overlay .cw233-table-selector{min-width:0!important;width:100%!important;padding:0 4px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:11px!important;}
    #ciao-miniapp-root .cw233-ranking-filters{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:6px!important;width:100%!important;min-width:0!important;overflow:hidden!important;}
    #ciao-miniapp-root .cw233-ranking-filters button{min-width:0!important;width:100%!important;padding:0 4px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
  `;
  documentRef.head?.appendChild(style);
}

function patchTableLabels(documentRef) {
  for (const button of documentRef.querySelectorAll?.('#ciao-v233-tables-overlay .cw233-table-selector') || []) {
    const key=button.dataset?.cw233TablesCompetition;
    const label=tableSelectorLabel(key);
    if (label && button.textContent !== label) button.textContent=label;
  }
  const hub=documentRef.querySelector?.('#ciao-v233-tables-overlay .cw233-tables-hub');
  const heading=hub?.querySelector?.('.cw233-tables-head p');
  const key=hub?.dataset?.cw233TablesSelected;
  const title=tableSectionTitle(key);
  if (heading && key && heading.textContent !== title) heading.textContent=title;
}

function patchRanking(documentRef) {
  const page=documentRef.querySelector?.('#ciao-miniapp-root .cw233-ranking-page');
  if (!page) return;
  for (const button of page.querySelectorAll?.('[data-cw233-rank-filter]') || []) {
    const key=button.dataset?.cw233RankFilter;
    const label=rankingSelectorLabel(key);
    if (label && button.textContent !== label) button.textContent=label;
  }
  const active=[...page.querySelectorAll?.('[data-cw233-rank-filter]') || []].find(b=>b.getAttribute?.('aria-selected')==='true')?.dataset?.cw233RankFilter || '';
  const heading=page.querySelector?.('.cw233-ranking-section-head h3');
  const title=rankingSectionTitle(active);
  if (heading && active && heading.textContent !== title) heading.textContent=title;
}

export function primeTablesOverlay(documentRef = globalThis.document) {
  const overlay=documentRef?.getElementById?.('ciao-v233-tables-overlay');
  if (!overlay) return false;
  overlay.hidden=false;
  overlay.style.visibility='visible';
  overlay.style.display='block';
  overlay.scrollTop=0;
  patchTableLabels(documentRef);
  return true;
}

function hideStaleOverlays(documentRef, activeTab) {
  if (activeTab !== 'calendar') documentRef.getElementById?.('ciao-v232-matches-overlay')?.setAttribute('hidden','');
  documentRef.getElementById?.('ciao-v233-match-center-overlay')?.setAttribute('hidden','');
}

function stabilizeTournamentBack(documentRef, event) {
  const target=event.target?.closest?.('[data-cw232-action="hub"], [data-cw233-serie-a-back]');
  if (!target) return false;
  const matches=documentRef.getElementById?.('ciao-v232-matches-overlay');
  if (matches) {
    matches.style.transition='none';
    matches.style.background='#07101f';
    matches.style.visibility='visible';
  }
  documentRef.getElementById?.('ciao-v233-match-center-overlay')?.setAttribute('hidden','');
  return true;
}

function patchProfile(documentRef) {
  const grid=documentRef.querySelector?.('#ciao-miniapp-root .content .stats-grid');
  if (!grid) return;
  const stats=globalThis.CiaoV233ProfileStats || { points:0, exactScores:0, correctOutcomes:0, scoredPredictions:0 };
  const values=[stats.points||0,stats.exactScores||0,stats.correctOutcomes||0,stats.scoredPredictions||0];
  [...grid.querySelectorAll?.('.stat') || []].slice(0,4).forEach((stat,i)=>{ const value=stat.querySelector?.('b,strong,[data-value]'); if(value)value.textContent=String(values[i]); });
}

export function installRound16Runtime(documentRef = globalThis.document) {
  if (!documentRef?.addEventListener) return null;
  installStyles(documentRef);
  const onPointerDown=event=>{
    const nav=event.target?.closest?.('button[data-tab]');
    if (nav) {
      const tab=nav.dataset?.tab;
      hideStaleOverlays(documentRef,tab);
      if (tab === 'seriea') primeTablesOverlay(documentRef);
    }
    stabilizeTournamentBack(documentRef,event);
    patchTableLabels(documentRef);
  };
  const onClick=event=>{
    stabilizeTournamentBack(documentRef,event);
    const run=()=>{ patchTableLabels(documentRef); patchRanking(documentRef); patchProfile(documentRef); };
    if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(run); else globalThis.setTimeout?.(run,0);
  };
  documentRef.addEventListener('pointerdown',onPointerDown,true);
  documentRef.addEventListener('click',onClick,true);
  patchTableLabels(documentRef); patchRanking(documentRef); patchProfile(documentRef);
  return Object.freeze({ refresh:()=>{patchTableLabels(documentRef);patchRanking(documentRef);patchProfile(documentRef);}, disconnect:()=>{documentRef.removeEventListener('pointerdown',onPointerDown,true);documentRef.removeEventListener('click',onClick,true);} });
}

if (typeof document !== 'undefined') installRound16Runtime(document);
