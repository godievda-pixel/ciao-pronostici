const SEASON_LABEL = 'SERIE A 2026/27';
const ALL_CALCIO_LABEL = 'ВСЁ О КАЛЬЧО';
const MARKER = 'cw233-home-multicompetition';
const EXTERNAL_MARKER = 'cw233-external-serie-a-legacy-runtime-r19';
const FINAL_REFRESH_MARKER = 'cw233-external-final-refresh-r19';
const FINAL_REFRESH_ANCHOR = '/* ===== /Ciao, Web! v20.15 stable match center live patch ===== */';

function replaceSeasonLabel(input) {
  return String(input).replaceAll(SEASON_LABEL, ALL_CALCIO_LABEL);
}

function applyHomePatch(input) {
  let source = String(input);
  if (source.includes(MARKER)) return source;

  const anchor = /predict\s*=\s*__cw231HomeHtml\s*;/;
  if (!anchor.test(source)) throw new Error('v23.3 Home anchor missing');

  const replacement = `/* ${MARKER} */
const __cw233LegacyHomeHtml = __cw231HomeHtml;
__cw231HomeHtml = function(){
  globalThis.CiaoV233Home?.ensure?.().catch?.(()=>{});
  const base = __cw233LegacyHomeHtml();
  const replacement = globalThis.CiaoV233Home?.html?.();
  if (!replacement) return base;
  try {
    const host = document.createElement('div');
    host.innerHTML = base;
    const today = host.querySelector('.cw231-today-head')?.closest?.('section') || host.querySelector('.cw231-today');
    if (!today) return base;
    today.outerHTML = replacement;
    return host.innerHTML;
  } catch (_error) {
    return base;
  }
};
const __cw233RefreshHome = ()=>{
  if (tab==='predict' && !matchViewId && !clubViewId) {
    const y = Number(main?.scrollTop) || 0;
    render();
    if (main) main.scrollTop = y;
    requestAnimationFrame?.(()=>{ if (main) main.scrollTop = y; });
  }
};
globalThis.addEventListener?.('ciao-v233-home-ready', ()=>{
  globalThis.CiaoV233Home?.ensure?.().catch?.(()=>{});
});
globalThis.addEventListener?.('ciao-v233-home-updated', __cw233RefreshHome);
globalThis.addEventListener?.('ciao-v233-open-serie-a-match', event => {
  const legacyId = Number(event?.detail?.legacyId) || 0;
  if (legacyId) openMatchCenter(legacyId);
});
predict = __cw231HomeHtml;`;

  source = source.replace(anchor, replacement);
  if (!source.includes(MARKER)) throw new Error('v23.3 Home source patch did not apply');
  return source;
}

function applyExternalLegacyPatch(input) {
  let source = String(input);
  if (!source.includes(EXTERNAL_MARKER)) {
    const anchor = /predict\s*=\s*__cw231HomeHtml\s*;/;
    if (!anchor.test(source)) throw new Error('v23.3 external legacy anchor missing');

    const bridge = `/* ${EXTERNAL_MARKER} */
let __cw233ExternalMatchContext = null;
const __cw233ExternalLegacyRefreshBase = refreshMatchCenter;
refreshMatchCenter = async function(){
  if (!__cw233ExternalMatchContext) return __cw233ExternalLegacyRefreshBase();
  if (!matchViewId || matchLoading || document.hidden || String(matchData?.status ?? '').toLowerCase() === 'finished') return;
  const y = main?.scrollTop ?? 0;
  const activeTab = matchCenterTab;
  try {
    const next = await globalThis.CiaoV233ExternalLegacyMatchCenter?.refresh?.(__cw233ExternalMatchContext);
    if (next) {
      patchMatchCenter(next);
      matchCenterTab = activeTab;
      const host = main?.querySelector?.('[data-mc-tab-content]');
      if (host && host.dataset.mcTabContent === activeTab) host.innerHTML = matchTabContent(next, activeTab);
    }
  } catch (_error) {
  } finally {
    matchCenterTab = activeTab;
    if (main) main.scrollTop = y;
    requestAnimationFrame?.(()=>{ if (main) main.scrollTop = y; });
  }
};
const __cw233ExternalLegacyCloseBase = closeMatchCenter;
closeMatchCenter = function(){
  __cw233ExternalMatchContext = null;
  return __cw233ExternalLegacyCloseBase();
};
globalThis.addEventListener?.('ciao-v233-open-external-legacy-match', event => {
  const detail = event?.detail || {};
  if (!detail?.data) return;
  __cw233ExternalMatchContext = {
    competition:String(detail.competition || ''),
    matchId:String(detail.matchId || ''),
  };
  matchReturnTab = tab;
  matchViewId = -1;
  matchCenterTab = 'overview';
  matchData = detail.data;
  root.classList.add('match-center-open');
  const canonicalOverlay = document.getElementById?.('ciao-v233-match-center-overlay');
  if (canonicalOverlay) canonicalOverlay.hidden = true;
  main.innerHTML = matchCenterHtml(matchData);
  const compactStatsTab = root.querySelector?.('[data-mc-tab="stats"]');
  if (compactStatsTab) compactStatsTab.textContent = 'Статы';
  bindMatchCenter();
  main.scrollTop = 0;
});
predict = __cw231HomeHtml;`;
    source = source.replace(anchor, bridge);

    const closeBefore = "function closeMatchCenter(){matchViewId=null;matchData=null;matchCenterTab='overview';root.classList.remove('match-center-open');tab=matchReturnTab;render()}";
    const closeAfter = "function closeMatchCenter(){__cw233ExternalMatchContext=null;matchViewId=null;matchData=null;matchCenterTab='overview';root.classList.remove('match-center-open');tab=matchReturnTab;render()}";
    if (source.includes(closeBefore)) source = source.replace(closeBefore, closeAfter);

    const refreshBefore = "async function refreshMatchCenter(){if(!matchViewId||matchLoading||document.hidden||String(matchData?.status??'').toLowerCase()==='finished')return;try{const next=await matchApi(matchViewId);patchMatchCenter(next)}catch(e){}}";
    const refreshAfter = "async function refreshMatchCenter(){if(!matchViewId||matchLoading||document.hidden||String(matchData?.status??'').toLowerCase()==='finished')return;try{const next=__cw233ExternalMatchContext?await globalThis.CiaoV233ExternalLegacyMatchCenter?.refresh?.(__cw233ExternalMatchContext):await matchApi(matchViewId);if(next)patchMatchCenter(next)}catch(e){}}";
    if (source.includes(refreshBefore)) source = source.replace(refreshBefore, refreshAfter);
  }

  if (!source.includes(EXTERNAL_MARKER)) throw new Error('v23.3 external legacy source patch did not apply');
  return source;
}

function applyFinalExternalRefreshPatch(input) {
  let source = String(input);
  if (source.includes(FINAL_REFRESH_MARKER)) return source;
  if (!source.includes(FINAL_REFRESH_ANCHOR)) return source;

  const patch = `${FINAL_REFRESH_ANCHOR}
  /* ${FINAL_REFRESH_MARKER} */
  const __cw233ExternalFinalRefreshBase = refreshMatchCenter;
  refreshMatchCenter = async function(){
    if (!__cw233ExternalMatchContext) return __cw233ExternalFinalRefreshBase();
    if (!matchViewId || matchLoading || document.hidden || String(matchData?.status ?? '').toLowerCase() === 'finished') return;
    const y = main?.scrollTop ?? 0;
    const activeTab = matchCenterTab;
    try {
      const next = await globalThis.CiaoV233ExternalLegacyMatchCenter?.refresh?.(__cw233ExternalMatchContext);
      if (next) {
        patchMatchCenter(next);
        matchCenterTab = activeTab;
        const host = main?.querySelector?.('[data-mc-tab-content]');
        if (host && host.dataset.mcTabContent === activeTab) host.innerHTML = matchTabContent(next, activeTab);
      }
    } catch (_error) {
    } finally {
      matchCenterTab = activeTab;
      if (main) main.scrollTop = y;
      requestAnimationFrame?.(()=>{ if (main) main.scrollTop = y; });
    }
  };`;

  source = source.replace(FINAL_REFRESH_ANCHOR, patch);
  if (!source.includes(FINAL_REFRESH_MARKER)) throw new Error('v23.3 final external refresh patch did not apply');
  return source;
}

export function applyHomeV233SourcePatch(input) {
  let source = replaceSeasonLabel(input);
  source = applyHomePatch(source);
  source = applyExternalLegacyPatch(source);
  source = applyFinalExternalRefreshPatch(source);
  return source;
}
