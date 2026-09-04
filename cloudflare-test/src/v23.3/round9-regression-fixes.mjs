export const USER_FEEDBACK_ROUND9_BUILD = '2026-09-03-r9';

const STYLE_ID = 'ciao-v233-round9-regression-style';
const SERIE_A_ACTIVE = 'cw233-serie-a-active';
const SERIE_A_HEAD = 'cw233-serie-a-competition-head';
const SERIE_A_LEGACY_HERO = 'cw233-serie-a-legacy-hero';

let observer = null;
let serieAActive = false;
let rafQueued = false;

const CSS = `
/* Round 9 retained behavior: normalize the legacy Serie A header only.
   Favorite-card visibility, UEFA round layout, full tournament backgrounds and
   table/crest polish are owned by Round 10 so older runtime code cannot undo them. */
html.${SERIE_A_ACTIVE} #ciao-miniapp-root .${SERIE_A_LEGACY_HERO}{display:none!important}
html.${SERIE_A_ACTIVE} #ciao-miniapp-root .cw232-serie-a-back{display:none!important}
#ciao-miniapp-root.match-center-open .cw233-serie-a-competition-head{display:none!important}
.${SERIE_A_HEAD}{display:grid;grid-template-columns:44px minmax(0,1fr);gap:13px;align-items:center;margin:0 0 20px;padding:4px 0 0;color:#fff}
.${SERIE_A_HEAD}__back{width:44px;height:44px;border:1px solid rgba(132,150,205,.22);border-radius:15px;background:linear-gradient(180deg,rgba(30,43,70,.92),rgba(16,27,47,.94));color:#fff;font:900 18px/1 inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
.${SERIE_A_HEAD}__copy{min-width:0}
.${SERIE_A_HEAD}__copy>span{display:block;margin-bottom:5px;color:rgba(174,188,224,.58);font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
.${SERIE_A_HEAD}__copy h2{margin:0;color:#fff;font-size:31px;line-height:1.02;letter-spacing:-.045em;font-weight:950}
.${SERIE_A_HEAD}__copy p{margin:7px 0 0;color:#aeb9d7;font-size:13px;font-weight:600}
`;

function rootNode(documentRef = globalThis.document) {
  return documentRef?.getElementById?.('ciao-miniapp-root') || null;
}
function contentNode(documentRef = globalThis.document) {
  return rootNode(documentRef)?.querySelector?.('.content') || null;
}
function clean(value) { return String(value ?? '').trim(); }

function installStyles(documentRef) {
  if (documentRef.getElementById?.(STYLE_ID)) return;
  const style = documentRef.createElement?.('style');
  if (!style) return;
  style.id = STYLE_ID;
  style.textContent = CSS;
  documentRef.head?.appendChild?.(style);
}

function findSerieALegacyHero(documentRef) {
  const root = rootNode(documentRef);
  if (!root) return null;
  const explicit = [...(root.querySelectorAll?.('.hero,header,.header,.top,.brand') || [])]
    .find(node => /Ciao,\s*Web!/i.test(clean(node.textContent)) && /SERIE\s*A\s*2026\/27/i.test(clean(node.textContent)));
  if (explicit) return explicit;
  return [...(root.querySelectorAll?.('*') || [])]
    .filter(node => node.children?.length && node.children.length <= 6)
    .find(node => {
      const value = clean(node.textContent);
      return value.length < 120 && /Ciao,\s*Web!/i.test(value) && /SERIE\s*A\s*2026\/27/i.test(value);
    }) || null;
}

function ensureSerieAHeader(documentRef = globalThis.document) {
  if (!serieAActive) return null;
  documentRef.documentElement?.classList?.add?.(SERIE_A_ACTIVE);
  const content = contentNode(documentRef);
  if (!content || !documentRef.createElement) return null;

  const legacyHero = findSerieALegacyHero(documentRef);
  legacyHero?.classList?.add?.(SERIE_A_LEGACY_HERO);

  let header = content.querySelector?.(`.${SERIE_A_HEAD}`) || null;
  if (!header) {
    header = documentRef.createElement('header');
    header.className = SERIE_A_HEAD;
    header.innerHTML = `<button type="button" class="${SERIE_A_HEAD}__back" data-cw233-serie-a-back aria-label="Назад к турнирам">←</button><div class="${SERIE_A_HEAD}__copy"><span>Матчи</span><h2>Серия А</h2><p>Италия</p></div>`;
    content.insertBefore(header, content.firstChild || null);
  }
  return header;
}

function activateSerieA(documentRef = globalThis.document) {
  serieAActive = true;
  documentRef.documentElement?.classList?.add?.(SERIE_A_ACTIVE);
  for (const delay of [0, 40, 120, 260]) setTimeout(() => ensureSerieAHeader(documentRef), delay);
}

function deactivateSerieA(documentRef = globalThis.document) {
  serieAActive = false;
  documentRef.documentElement?.classList?.remove?.(SERIE_A_ACTIVE);
  contentNode(documentRef)?.querySelector?.(`.${SERIE_A_HEAD}`)?.remove?.();
  for (const node of documentRef.querySelectorAll?.(`.${SERIE_A_LEGACY_HERO}`) || []) node.classList?.remove?.(SERIE_A_LEGACY_HERO);
}

function apply(documentRef = globalThis.document) {
  if (serieAActive) ensureSerieAHeader(documentRef);
}

function queueApply(documentRef) {
  if (rafQueued) return;
  rafQueued = true;
  const run = () => { rafQueued = false; apply(documentRef); };
  if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(run);
  else setTimeout(run, 0);
}

export function installRound9RegressionFixes(documentRef = globalThis.document) {
  if (!documentRef?.addEventListener || !documentRef?.createElement) return null;
  installStyles(documentRef);
  apply(documentRef);

  documentRef.addEventListener('click', event => {
    const target = event?.target;
    if (!target?.closest) return;

    const serieATournament = target.closest('.cw232-tournament-card[data-cw232-competition="serie_a"]');
    if (serieATournament) {
      activateSerieA(documentRef);
      return;
    }

    const back = target.closest('[data-cw233-serie-a-back]');
    if (back) {
      event.preventDefault?.();
      event.stopPropagation?.();
      const legacyBack = contentNode(documentRef)?.querySelector?.('.cw232-serie-a-back');
      deactivateSerieA(documentRef);
      if (legacyBack?.click) legacyBack.click();
      else rootNode(documentRef)?.querySelector?.('.nav button[data-tab="calendar"]')?.click?.();
      return;
    }

    const nav = target.closest('.nav button[data-tab]');
    if (nav && nav.dataset?.tab !== 'calendar') deactivateSerieA(documentRef);
  }, true);

  if (!observer && typeof MutationObserver === 'function') {
    observer = new MutationObserver(() => queueApply(documentRef));
    observer.observe(documentRef.documentElement || documentRef.body, {
      childList:true,
      subtree:true,
    });
  }

  return Object.freeze({
    apply:() => apply(documentRef),
    activateSerieA:() => activateSerieA(documentRef),
    deactivateSerieA:() => deactivateSerieA(documentRef),
    disconnect:() => observer?.disconnect?.(),
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installRound9RegressionFixes(document), { once:true });
  else installRound9RegressionFixes(document);
}
