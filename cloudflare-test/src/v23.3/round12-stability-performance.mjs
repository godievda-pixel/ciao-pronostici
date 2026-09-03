export const USER_FEEDBACK_ROUND12_BUILD = '2026-09-03-r12';

const STYLE_ID = 'ciao-v233-round12-stability-style';
const HOME_TAB = 'predict';
const LEGACY_SUBTITLE = 'SERIE A 2026/27';
const ALL_CALCIO_LABEL = 'ВСЁ О КАЛЬЧО';
let observer = null;
let queued = false;

const CSS = `
/* The legacy Ciao brand belongs to Home only. Hiding the whole discovered header also removes its separator/space. */
#ciao-miniapp-root[data-cw233-active-tab]:not([data-cw233-active-tab='predict']) .cw233-app-brand-header,
#ciao-miniapp-root.cw233-nonhome .cw233-app-brand-header{display:none!important}

/* Tables: resolve the old 660px mobile rule. Phones around 420px+ get a true full-width table. */
#ciao-v233-tables-overlay .cw233-standing-wrap{width:100%!important;max-width:100%!important;overflow-x:auto!important;overscroll-behavior-inline:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none}
#ciao-v233-tables-overlay .cw233-standing-wrap::-webkit-scrollbar{display:none}
@media(min-width:420px){
  #ciao-v233-tables-overlay .cw233-standing-table,
  #ciao-v233-tables-overlay .cw233-standing-table--full{min-width:0!important;width:100%!important;max-width:100%!important;table-layout:fixed!important}
  #ciao-v233-tables-overlay .cw233-standing-table th,
  #ciao-v233-tables-overlay .cw233-standing-table td{padding-left:3px!important;padding-right:3px!important}
  #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(1),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(1){width:34px!important}
  #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(2),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(2){width:130px!important}
  #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(3),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(3),
  #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(4),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(4),
  #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(5),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(5),
  #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(6),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(6),
  #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(8),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(8),
  #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(9),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(9){width:32px!important}
  #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(7),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(7){width:42px!important}
  #ciao-v233-tables-overlay .cw233-standing-team{gap:5px!important}
  #ciao-v233-tables-overlay .cw233-standing-team img,#ciao-v233-tables-overlay .cw233-table-logo{width:24px!important;height:24px!important;min-width:24px!important;min-height:24px!important;flex-basis:24px!important}
  #ciao-v233-tables-overlay .cw233-standing-team strong{font-size:10px!important}
}
@media(max-width:419px){
  #ciao-v233-tables-overlay .cw233-standing-table,
  #ciao-v233-tables-overlay .cw233-standing-table--full{min-width:560px!important;width:560px!important;table-layout:fixed!important}
}

/* Reserve image geometry before crest decoding so standings do not hop vertically. */
#ciao-v233-tables-overlay .cw233-standing-logo,
#ciao-v233-tables-overlay .cw233-standing-team img{width:30px;height:30px;min-width:30px;min-height:30px;object-fit:contain}
`;

function clean(value) { return String(value ?? '').trim(); }

function installStyles(documentRef) {
  if (!documentRef?.createElement || documentRef.getElementById?.(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  documentRef.head?.appendChild?.(style);
}

function activeTab(root) {
  const selected = root?.querySelector?.('.nav button[data-tab][aria-selected="true"],.nav button[data-tab].active,.nav button[data-tab].is-active');
  return clean(selected?.dataset?.tab) || clean(root?.dataset?.cw233ActiveTab) || HOME_TAB;
}

function discoverBrandHeader(root) {
  const current = root?.querySelector?.('.cw233-app-brand-header');
  if (current) return current;
  const content = root?.querySelector?.('.content');
  const nav = root?.querySelector?.('.nav');
  const nodes = [...(root?.querySelectorAll?.('header,section,div') || [])]
    .filter(node => node !== root && !content?.contains?.(node) && !nav?.contains?.(node))
    .filter(node => /Ciao,\s*Web!/i.test(clean(node.textContent)));
  const node = nodes.sort((a, b) => (clean(a.textContent).length || 9999) - (clean(b.textContent).length || 9999))[0] || null;
  if (node) node.classList?.add?.('cw233-app-brand-header');
  return node;
}

function replaceBrandSubtitle(header) {
  if (!header) return;
  for (const node of header.querySelectorAll?.('*') || []) {
    if (clean(node.textContent) === LEGACY_SUBTITLE) node.textContent = ALL_CALCIO_LABEL;
  }
}

export function syncRound12Chrome(documentRef = globalThis.document, forcedTab = '') {
  const root = documentRef?.getElementById?.('ciao-miniapp-root');
  if (!root) return false;
  installStyles(documentRef);
  const header = discoverBrandHeader(root);
  replaceBrandSubtitle(header);
  const tab = clean(forcedTab) || activeTab(root);
  root.dataset.cw233ActiveTab = tab;
  root.classList?.toggle?.('cw233-nonhome', tab !== HOME_TAB);
  return Boolean(header);
}

function queueSync(documentRef) {
  if (queued) return;
  queued = true;
  const run = () => { queued = false; syncRound12Chrome(documentRef); };
  if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(run);
  else setTimeout(run, 0);
}

export function installRound12Stability(documentRef = globalThis.document) {
  if (!documentRef?.addEventListener) return null;
  installStyles(documentRef);
  syncRound12Chrome(documentRef);
  documentRef.addEventListener('click', event => {
    const nav = event?.target?.closest?.('#ciao-miniapp-root .nav button[data-tab]');
    if (nav) syncRound12Chrome(documentRef, clean(nav.dataset?.tab));
  }, true);
  documentRef.addEventListener('ciao-v233-round11-theme', () => queueSync(documentRef));
  if (!observer && typeof MutationObserver === 'function') {
    const root = documentRef.getElementById?.('ciao-miniapp-root');
    if (root) {
      observer = new MutationObserver(() => queueSync(documentRef));
      observer.observe(root, { childList:true, subtree:true, attributes:true, attributeFilter:['class','aria-selected'] });
    }
  }
  return Object.freeze({ sync:tab => syncRound12Chrome(documentRef, tab) });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installRound12Stability(document), { once:true });
  else installRound12Stability(document);
}
