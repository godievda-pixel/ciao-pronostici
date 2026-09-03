const SEASON_LABEL = 'SERIE A 2026/27';
const ALL_CALCIO_LABEL = 'ВСЁ О КАЛЬЧО';
const MARKER = 'cw233-home-multicompetition';
const EXTERNAL_MARKER = 'cw233-single-legacy-match-center-r20';
const LATE_MATCH_CENTER_MARKER = '/* ===== /Ciao, Web! v20.15 stable match center live patch ===== */';

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

function lastPredictAnchorEnd(source) {
  const regex = /predict\s*=\s*__cw231HomeHtml\s*;/g;
  let match = null;
  let last = null;
  while ((match = regex.exec(source))) last = match;
  return last ? last.index + last[0].length : -1;
}

function applyExternalLegacyPatch(input) {
  let source = String(input);
  if (source.includes(EXTERNAL_MARKER)) return source;

  const predictEnd = lastPredictAnchorEnd(source);
  if (predictEnd < 0) throw new Error('v23.3 external legacy anchor missing');

  const lateAt = source.lastIndexOf(LATE_MATCH_CENTER_MARKER);
  const lateEnd = lateAt >= 0 ? lateAt + LATE_MATCH_CENTER_MARKER.length : -1;
  const insertionAt = Math.max(predictEnd, lateEnd);

  const bridge = `
/* ${EXTERNAL_MARKER} */
let __cw233ExternalMatchContext = null;
const __cw233LegacyFinalRefresh = refreshMatchCenter;
const __cw233LegacyFinalClose = closeMatchCenter;

refreshMatchCenter = async function(){
  if (!__cw233ExternalMatchContext) return __cw233LegacyFinalRefresh();
  if (!matchViewId || matchLoading || document.hidden || String(matchData?.status ?? '').toLowerCase() === 'finished') return;
  const y = main?.scrollTop ?? 0;
  const activeTab = matchCenterTab;
  try {
    const next = await globalThis.CiaoV233ExternalLegacyMatchCenter?.refresh?.(__cw233ExternalMatchContext);
    if (next) {
      matchData = next;
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

closeMatchCenter = function(){
  __cw233ExternalMatchContext = null;
  delete root.dataset.cw233McCompetition;
  return __cw233LegacyFinalClose();
};

globalThis.addEventListener?.('ciao-v233-open-external-legacy-match', event => {
  const detail = event?.detail || {};
  if (!detail?.data) return;
  __cw233ExternalMatchContext = {
    competition:String(detail.competition || ''),
    matchId:String(detail.matchId || ''),
  };
  root.dataset.cw233McCompetition = __cw233ExternalMatchContext.competition;
  matchReturnTab = tab;
  matchViewId = -1;
  matchCenterTab = 'overview';
  matchData = detail.data;
  root.classList.add('match-center-open');
  main.innerHTML = matchCenterHtml(matchData);
  const compactStatsTab = root.querySelector?.('[data-mc-tab="stats"]');
  if (compactStatsTab) compactStatsTab.textContent = 'Статы';
  bindMatchCenter();
  main.scrollTop = 0;
});
`;

  source = source.slice(0, insertionAt) + bridge + source.slice(insertionAt);
  if (!source.includes(EXTERNAL_MARKER)) throw new Error('v23.3 single legacy Match Center patch did not apply');
  return source;
}

export function applyHomeV233SourcePatch(input) {
  let source = replaceSeasonLabel(input);
  source = applyHomePatch(source);
  source = applyExternalLegacyPatch(source);
  return source;
}
