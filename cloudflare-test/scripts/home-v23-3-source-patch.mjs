const SEASON_LABEL = 'SERIE A 2026/27';
const ALL_CALCIO_LABEL = 'ВСЁ О КАЛЬЧО';
const MARKER = 'cw233-home-multicompetition';
const EXTERNAL_MARKER = 'cw233-single-legacy-match-center-r20';
const OVERLAY_LIFECYCLE_MARKER = 'cw233-external-match-overlay-lifecycle-r21';
const LOGO_PATCH_MARKER = 'cw233-legacy-direct-crest-r22';
const ROUND23_UNIFIED_STATE_MARKER = 'cw233-round23-unified-state-fixes';
const LATE_MATCH_CENTER_MARKER = '/* ===== /Ciao, Web! v20.15 stable match center live patch ===== */';

function replaceSeasonLabel(input) {
  return String(input).replaceAll(SEASON_LABEL, ALL_CALCIO_LABEL);
}

function applyLegacyLogoPatch(input) {
  let source = String(input);
  if (source.includes(LOGO_PATCH_MARKER)) return source;

  const startNeedle = 'const logo = t => t?.custom_emoji_id ?';
  const endNeedle = `'<span class="logo">⚽</span>';`;
  const start = source.indexOf(startNeedle);
  if (start < 0) return source;
  const endStart = source.indexOf(endNeedle, start);
  if (endStart < 0) return source;
  const end = endStart + endNeedle.length;

  const replacement = `/* ${LOGO_PATCH_MARKER} */
const logo = t => {
  const directLogo = String(t?.logo_url || t?.logoUrl || t?.crestUrl || '').trim();
  if (directLogo) return \`<img class="logo" width="48" height="48" loading="eager" decoding="sync" fetchpriority="auto" data-cw231-stable-logo-load="1" src="\${esc(directLogo)}" alt="">\`;
  return t?.custom_emoji_id
    ? \`<img class="logo" width="48" height="48" loading="eager" decoding="sync" fetchpriority="auto" data-cw231-stable-logo-load="1" src="\${API_BASE}?asset=emoji&id=\${encodeURIComponent(t.custom_emoji_id)}" alt="">\`
    : '<span class="logo">⚽</span>';
};`;

  source = source.slice(0, start) + replacement + source.slice(end);
  if (!source.includes(LOGO_PATCH_MARKER)) throw new Error('v23.3 legacy crest source patch did not apply');
  return source;
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

function applyExternalOverlayLifecyclePatch(input) {
  let source = String(input);
  if (source.includes(OVERLAY_LIFECYCLE_MARKER)) return source;

  const externalAt = source.lastIndexOf(EXTERNAL_MARKER);
  if (externalAt < 0) throw new Error('v23.3 external Match Center lifecycle anchor missing');

  const externalTail = 'main.scrollTop = 0;\n});';
  const tailAt = source.indexOf(externalTail, externalAt);
  if (tailAt < 0) throw new Error('v23.3 external Match Center lifecycle tail missing');
  const insertionAt = tailAt + externalTail.length;

  const lifecycle = `

/* ${OVERLAY_LIFECYCLE_MARKER} */
let __cw233R21MatchesOverlayState = null;

function __cw233SuspendMatchesOverlay(){
  const matchesOverlay = document.getElementById?.('ciao-v232-matches-overlay');
  if (!matchesOverlay || matchesOverlay.hidden) {
    __cw233R21MatchesOverlayState = null;
    return;
  }
  __cw233R21MatchesOverlayState = {
    matchesOverlayScrollTop:Number(matchesOverlay.scrollTop) || 0,
  };
  matchesOverlay.hidden = true;
}

function __cw233RestoreMatchesOverlay(context){
  if (!context) return;
  const matchesOverlay = document.getElementById?.('ciao-v232-matches-overlay');
  if (!matchesOverlay) return;
  matchesOverlay.hidden = false;
  matchesOverlay.scrollTop = context.matchesOverlayScrollTop;
  requestAnimationFrame?.(()=>{
    matchesOverlay.scrollTop = context.matchesOverlayScrollTop;
  });
}

globalThis.addEventListener?.('ciao-v233-open-external-legacy-match', __cw233SuspendMatchesOverlay);
globalThis.addEventListener?.('ciao-v233-open-serie-a-match', __cw233SuspendMatchesOverlay);

const __cw233R21FinalClose = closeMatchCenter;
closeMatchCenter = function(){
  const context = __cw233R21MatchesOverlayState;
  __cw233R21MatchesOverlayState = null;
  const result = __cw233R21FinalClose();
  __cw233RestoreMatchesOverlay(context);
  return result;
};
`;

  source = source.slice(0, insertionAt) + lifecycle + source.slice(insertionAt);
  if (!source.includes(OVERLAY_LIFECYCLE_MARKER)) throw new Error('v23.3 external Match Center overlay lifecycle patch did not apply');
  return source;
}

function applyRound23UnifiedStateFixes(input) {
  let source = String(input);
  if (source.includes(ROUND23_UNIFIED_STATE_MARKER)) return source;
  if (!source.includes(OVERLAY_LIFECYCLE_MARKER)) throw new Error('v23.3 round23 lifecycle anchor missing');

  const patch = `

/* ${ROUND23_UNIFIED_STATE_MARKER} */
const __cw233Round23RestoreMatchesOverlay = __cw233RestoreMatchesOverlay;
__cw233RestoreMatchesOverlay = function(context){
  if (tab !== 'calendar') return;
  return __cw233Round23RestoreMatchesOverlay(context);
};

document.addEventListener?.('click', event => {
  const button = event?.target?.closest?.('button[data-tab]');
  if (!button) return;
  __cw233R21MatchesOverlayState = null;
}, true);

const __cw233Round23LegacyBindMatchCenter = bindMatchCenter;
bindMatchCenter = function(){
  __cw233Round23LegacyBindMatchCenter();
  if (!__cw233ExternalMatchContext) return;
  for (const button of root.querySelectorAll?.('[data-mc-tab]') || []) {
    if (button.dataset?.cw233Round23TabBound === '1') continue;
    button.dataset.cw233Round23TabBound = '1';
    button.addEventListener?.('click', event => {
      if (!__cw233ExternalMatchContext || !matchData) return;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      const nextTab = String(event.currentTarget?.dataset?.mcTab || '').trim();
      if (!nextTab) return;
      matchCenterTab = nextTab;
      for (const node of root.querySelectorAll?.('[data-mc-tab]') || []) {
        const active = node === event.currentTarget;
        node.classList?.toggle?.('active', active);
        node.setAttribute?.('aria-selected', active ? 'true' : 'false');
      }
      const host = main?.querySelector?.('[data-mc-tab-content]');
      if (host) {
        host.dataset.mcTabContent = nextTab;
        host.innerHTML = matchTabContent(matchData, nextTab);
      }
    }, true);
  }
};
`;

  source += patch;
  if (!source.includes(ROUND23_UNIFIED_STATE_MARKER)) throw new Error('v23.3 round23 unified state patch did not apply');
  return source;
}

export function applyHomeV233SourcePatch(input) {
  let source = replaceSeasonLabel(input);
  source = applyLegacyLogoPatch(source);
  source = applyHomePatch(source);
  source = applyExternalLegacyPatch(source);
  source = applyExternalOverlayLifecyclePatch(source);
  source = applyRound23UnifiedStateFixes(source);
  return source;
}
