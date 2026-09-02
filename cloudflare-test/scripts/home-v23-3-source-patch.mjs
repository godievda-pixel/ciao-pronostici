const SEASON_LABEL = 'SERIE A 2026/27';
const MARKER = 'cw233-home-multicompetition';

function removeSeasonLabel(input) {
  return String(input).split(SEASON_LABEL).join('');
}

export function applyHomeV233SourcePatch(input) {
  let source = removeSeasonLabel(input);
  if (source.includes(MARKER)) return source;

  const anchor = /predict\s*=\s*__cw231HomeHtml\s*;/;
  if (!anchor.test(source)) {
    throw new Error('v23.3 Home anchor missing');
  }

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
