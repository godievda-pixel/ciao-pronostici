export const USER_FEEDBACK_ROUND7_BUILD = '2026-09-03-r7';

const STYLE_ID = 'cw233-round7-regression-style';
const BACK_CLASS = 'cw232-serie-a-back';
let serieABridgeActive = false;
let observer = null;

function rootNode(documentRef = globalThis.document) {
  return documentRef?.getElementById?.('ciao-miniapp-root') || null;
}

function contentNode(documentRef = globalThis.document) {
  return rootNode(documentRef)?.querySelector?.('.content') || null;
}

function ensureStyles(documentRef = globalThis.document) {
  if (!documentRef?.createElement || documentRef.getElementById?.(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #ciao-v232-matches-overlay,#ciao-v233-tables-overlay,#ciao-v233-match-center-overlay{inset:0!important;padding-bottom:calc(104px + env(safe-area-inset-bottom,0px))!important}
    #ciao-miniapp-root .nav{z-index:80!important}
    #ciao-v233-tables-overlay .cw233-standing-viewport{width:100%!important;max-width:100%!important;overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none!important}
    #ciao-v233-tables-overlay .cw233-standing-viewport::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}
    #ciao-v233-tables-overlay .cw233-standing-table{width:100%!important;min-width:0;table-layout:fixed!important}
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(1),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(1){width:40px!important}
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(2),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(2){width:190px!important}
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(3),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(3),
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(4),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(4),
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(5),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(5),
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(6),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(6),
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(7),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(7),
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(8),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(8),
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(9),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(9){display:table-cell!important}
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(3),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(3),
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(4),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(4),
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(5),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(5),
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(6),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(6),
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(9),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(9){width:46px!important}
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(7),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(7){width:64px!important}
    #ciao-v233-tables-overlay .cw233-standing-table th:nth-child(8),#ciao-v233-tables-overlay .cw233-standing-table td:nth-child(8){width:52px!important}
    .${BACK_CLASS}{display:flex;align-items:center;gap:8px;width:max-content;max-width:100%;margin:0 0 16px;padding:10px 13px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.07);color:#fff;font:800 12px/1 inherit;box-shadow:0 8px 24px rgba(0,0,0,.16);position:relative;z-index:4}
    .${BACK_CLASS}:active{transform:scale(.98)}
  `;
  documentRef.head?.appendChild?.(style);
}

function ensureSerieABack(documentRef = globalThis.document) {
  if (!serieABridgeActive) return null;
  const content = contentNode(documentRef);
  if (!content || !documentRef?.createElement) return null;
  let button = content.querySelector?.(`.${BACK_CLASS}`) || null;
  if (!button) {
    button = documentRef.createElement('button');
    button.type = 'button';
    button.className = BACK_CLASS;
    button.setAttribute?.('aria-label', 'Назад к турнирам');
    button.textContent = '← Назад к турнирам';
    content.insertBefore?.(button, content.firstChild || null);
  }
  return button;
}

function deactivateSerieABridge(documentRef = globalThis.document) {
  serieABridgeActive = false;
  contentNode(documentRef)?.querySelector?.(`.${BACK_CLASS}`)?.remove?.();
}

function activateSerieABridge(documentRef = globalThis.document) {
  serieABridgeActive = true;
  setTimeout(() => ensureSerieABack(documentRef), 0);
}

export function installRound7RegressionFixes(documentRef = globalThis.document) {
  if (!documentRef?.addEventListener || !documentRef?.createElement) return null;
  ensureStyles(documentRef);

  const observeTarget = contentNode(documentRef);
  if (!observer && observeTarget && typeof MutationObserver === 'function') {
    observer = new MutationObserver(() => {
      if (serieABridgeActive) ensureSerieABack(documentRef);
    });
    observer.observe(observeTarget, { childList:true });
  }

  documentRef.addEventListener('click', event => {
    const target = event?.target;
    if (!target?.closest) return;

    const back = target.closest(`.${BACK_CLASS}`);
    if (back) {
      event.preventDefault?.();
      event.stopPropagation?.();
      deactivateSerieABridge(documentRef);
      const matchesNav = rootNode(documentRef)?.querySelector?.('.nav button[data-tab="calendar"]');
      matchesNav?.click?.();
      return;
    }

    const tournament = target.closest('.cw232-tournament-card[data-cw232-competition]');
    if (tournament?.dataset?.cw232Competition === 'serie_a') {
      activateSerieABridge(documentRef);
      return;
    }
    if (tournament) {
      deactivateSerieABridge(documentRef);
      return;
    }

    const nav = target.closest('.nav button[data-tab]');
    if (nav && nav.dataset?.tab !== 'calendar') deactivateSerieABridge(documentRef);
  }, true);

  return Object.freeze({
    showSerieABack:() => activateSerieABridge(documentRef),
    hideSerieABack:() => deactivateSerieABridge(documentRef),
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installRound7RegressionFixes(document), { once:true });
  else installRound7RegressionFixes(document);
}
