export const USER_FEEDBACK_ROUND13_BUILD = '2026-09-03-r13';

const STYLE_ID = 'ciao-v233-round13-mobile-style';
const RANKING_LOADING_ID = 'ciao-v233-round13-ranking-loading';
const SERIE_A_NAV_CLASS = 'cw233-serie-a-round-nav-shell';
const SERIE_A_CACHE_TTL = 60_000;
const TABLE_LABELS = Object.freeze({
  serie_a:'Серия А',
  ucl:'ЛЧ',
  uel:'ЛЕ',
  uecl:'ЛК',
  coppa_italia:'Кубок Италии',
});

let serieAScheduleCache = null;
let serieAScheduleLoadedAt = 0;
let serieAScheduleInflight = null;
let serieARetryTimer = 0;
let rankingLoadingTimer = 0;
let applyQueued = false;

function text(value) {
  return String(value ?? '').trim();
}

function positiveRound(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function compactTableLabel(competition) {
  const key = text(competition);
  return TABLE_LABELS[key] || key;
}

export function buildSerieARoundNavModel({ currentRound, matches = [] } = {}) {
  const rounds = [...new Set((Array.isArray(matches) ? matches : [])
    .map(match => positiveRound(match?.round ?? match?.round_number))
    .filter(Boolean))]
    .sort((a, b) => a - b);
  const resolvedCurrent = positiveRound(currentRound) || rounds[0] || null;
  if (!resolvedCurrent) return Object.freeze([]);

  return Object.freeze(rounds
    .filter(round => round >= resolvedCurrent)
    .map(round => Object.freeze({
      round,
      active:round === resolvedCurrent,
      locked:round > resolvedCurrent,
      label:`Тур ${round}${round > resolvedCurrent ? ' 🔒' : ''}`,
    })));
}

const ROUND13_CSS = `
/* Round 13: one lock glyph only — the accessible inline glyph from predictions-ui wins. */
#ciao-miniapp-root .cw233-prediction-page [data-cw233-pred-locked='true']::after{content:none!important;display:none!important}

/* Serie A reserves the round navigation height before its full calendar arrives, avoiding CLS. */
#ciao-miniapp-root .${SERIE_A_NAV_CLASS}{min-height:47px;margin:0 0 12px;overflow:hidden;box-sizing:border-box}
#ciao-miniapp-root .${SERIE_A_NAV_CLASS} .cw233-pred-nav{min-height:47px;margin:0!important;padding:0 1px 4px!important;display:flex!important;align-items:center!important;gap:8px!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important}
#ciao-miniapp-root .${SERIE_A_NAV_CLASS} .cw233-pred-nav::-webkit-scrollbar{display:none!important}
#ciao-miniapp-root .${SERIE_A_NAV_CLASS} .cw233-pred-nav button{flex:0 0 auto!important;min-width:62px!important;height:39px!important;padding:0 12px!important;border-radius:12px!important;white-space:nowrap!important}
#ciao-miniapp-root .${SERIE_A_NAV_CLASS} .cw233-pred-nav button[disabled]{opacity:.48!important;cursor:default!important}
#ciao-miniapp-root .${SERIE_A_NAV_CLASS}.is-loading:before{content:'';display:block;width:100%;height:39px;border-radius:12px;background:linear-gradient(90deg,rgba(34,52,101,.36),rgba(47,70,132,.48),rgba(34,52,101,.36));background-size:220% 100%;animation:cw233-r13-pulse 1.25s ease-in-out infinite}
@keyframes cw233-r13-pulse{0%{background-position:100% 0}100%{background-position:-100% 0}}

/* Tables: four football competitions fit on one mobile line. */
#ciao-v233-tables-overlay .cw233-table-selectors{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:6px!important;overflow:hidden!important;width:100%!important;padding-right:0!important}
#ciao-v233-tables-overlay .cw233-table-selector{min-width:0!important;width:100%!important;padding:0 6px!important;white-space:nowrap!important;text-align:center!important}

/* Ranking loading is neutral: no synthetic participant, rank or points. */
#${RANKING_LOADING_ID}{position:fixed;z-index:74;inset:0 0 calc(72px + env(safe-area-inset-bottom,0px));padding:14px 10px 24px;box-sizing:border-box;overflow:hidden;background:radial-gradient(circle at 88% 3%,rgba(45,72,206,.20),transparent 34%),linear-gradient(180deg,#07101f 0%,#060d1a 100%)}
#${RANKING_LOADING_ID}[hidden]{display:none!important}
#${RANKING_LOADING_ID} .cw233-round13-loading-hero{height:96px;border:1px solid rgba(91,117,210,.24);border-radius:23px;background:linear-gradient(145deg,rgba(24,46,99,.82),rgba(13,25,58,.90));display:grid;grid-template-columns:52px 1fr 92px;align-items:center;gap:12px;padding:14px;box-sizing:border-box}
#${RANKING_LOADING_ID} .cw233-round13-loading-avatar{width:52px;height:52px;border-radius:17px;background:rgba(75,101,184,.28)}
#${RANKING_LOADING_ID} .cw233-round13-loading-lines{display:grid;gap:8px}
#${RANKING_LOADING_ID} .cw233-round13-loading-lines i,#${RANKING_LOADING_ID} .cw233-round13-loading-stat,#${RANKING_LOADING_ID} .cw233-round13-loading-tab,#${RANKING_LOADING_ID} .cw233-round13-loading-row{display:block;background:linear-gradient(90deg,rgba(43,61,108,.40),rgba(67,91,158,.55),rgba(43,61,108,.40));background-size:220% 100%;animation:cw233-r13-pulse 1.25s ease-in-out infinite}
#${RANKING_LOADING_ID} .cw233-round13-loading-lines i:first-child{width:72%;height:13px;border-radius:7px}
#${RANKING_LOADING_ID} .cw233-round13-loading-lines i:last-child{width:48%;height:9px;border-radius:6px}
#${RANKING_LOADING_ID} .cw233-round13-loading-stats{display:grid;grid-template-columns:1fr 1fr;gap:7px}
#${RANKING_LOADING_ID} .cw233-round13-loading-stat{height:46px;border-radius:13px}
#${RANKING_LOADING_ID} .cw233-round13-loading-tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:16px}
#${RANKING_LOADING_ID} .cw233-round13-loading-tab{height:39px;border-radius:12px}
#${RANKING_LOADING_ID} .cw233-round13-loading-list{display:grid;gap:10px;margin-top:78px}
#${RANKING_LOADING_ID} .cw233-round13-loading-row{height:61px;border-radius:17px;border:1px solid rgba(85,107,173,.10)}

/* Keep Matches opaque while the legacy deferred controller catches up. */
#ciao-v232-matches-overlay{background:#07101f!important;isolation:isolate!important}
`;

function telegramInitData() {
  return text(globalThis.Telegram?.WebApp?.initData);
}

async function fetchSerieASchedule() {
  if (serieAScheduleCache && Date.now() - serieAScheduleLoadedAt < SERIE_A_CACHE_TTL) {
    return serieAScheduleCache;
  }
  if (serieAScheduleInflight) return serieAScheduleInflight;
  const auth = telegramInitData();
  if (!auth || typeof globalThis.fetch !== 'function') return null;

  const url = new URL('/api/v23.2/matches', globalThis.location?.origin || 'https://ciao-web-app-test.ciao-web.workers.dev');
  url.searchParams.set('competition', 'serie_a');
  serieAScheduleInflight = globalThis.fetch(new Request(url, {
    headers:{ 'x-telegram-init-data':auth, accept:'application/json' },
  })).then(async response => {
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok === false || !payload?.data) return null;
    serieAScheduleCache = payload.data;
    serieAScheduleLoadedAt = Date.now();
    return serieAScheduleCache;
  }).catch(() => null).finally(() => {
    serieAScheduleInflight = null;
  });
  return serieAScheduleInflight;
}

function predictionPage(documentRef) {
  return documentRef.querySelector?.('#ciao-miniapp-root .cw233-prediction-page') || null;
}

function shouldShowSerieARounds(page) {
  if (!page) return false;
  const filter = page.querySelector?.('[data-cw233-filter="serie_a"]');
  const make = page.querySelector?.('[data-cw233-mode="make"]');
  return filter?.getAttribute?.('aria-selected') === 'true' && make?.getAttribute?.('aria-selected') === 'true';
}

function ensureSerieAShell(page) {
  let shell = page.querySelector?.(`.${SERIE_A_NAV_CLASS}`);
  if (shell) return shell;
  const filters = page.querySelector?.('.cw233-pred-filters');
  if (!filters?.parentNode) return null;
  shell = page.ownerDocument.createElement('div');
  shell.className = `${SERIE_A_NAV_CLASS} is-loading`;
  filters.insertAdjacentElement('afterend', shell);
  return shell;
}

function renderSerieARounds(shell, schedule) {
  const model = buildSerieARoundNavModel({
    currentRound:schedule?.currentRound ?? schedule?.current_round,
    matches:schedule?.matches,
  });
  shell.classList.remove('is-loading');
  if (!model.length) {
    shell.hidden = true;
    return;
  }
  shell.hidden = false;
  shell.innerHTML = `<div class="cw233-pred-nav" role="tablist" aria-label="Туры Серии А">${model.map(item => (
    `<button type="button" aria-selected="${item.active}"${item.locked ? ' data-cw233-pred-locked="true" disabled aria-disabled="true"' : ''}>${item.label}</button>`
  )).join('')}</div>`;
  shell.querySelector?.('[aria-selected="true"]')?.scrollIntoView?.({ block:'nearest', inline:'nearest' });
}

function scheduleSerieARetry(documentRef, attempt = 0) {
  if (serieARetryTimer || attempt > 6) return;
  const delay = [80,160,320,650,1100,1900,3200][attempt] || 3200;
  serieARetryTimer = globalThis.setTimeout?.(() => {
    serieARetryTimer = 0;
    void syncSerieARounds(documentRef, attempt + 1);
  }, delay) || 0;
}

async function syncSerieARounds(documentRef, attempt = 0) {
  const page = predictionPage(documentRef);
  if (!shouldShowSerieARounds(page)) {
    page?.querySelector?.(`.${SERIE_A_NAV_CLASS}`)?.remove?.();
    return;
  }
  const shell = ensureSerieAShell(page);
  if (!shell) return;
  const schedule = await fetchSerieASchedule();
  if (!schedule) {
    scheduleSerieARetry(documentRef, attempt);
    return;
  }
  if (!shouldShowSerieARounds(predictionPage(documentRef))) return;
  renderSerieARounds(shell, schedule);
}

function compactTableSelectors(documentRef) {
  for (const button of documentRef.querySelectorAll?.('#ciao-v233-tables-overlay .cw233-table-selector[data-cw233-table-select]') || []) {
    const label = compactTableLabel(button.dataset?.cw233TableSelect);
    if (label && button.textContent !== label) button.textContent = label;
  }
}

function rankingLoadingHtml() {
  return `<div class="cw233-round13-loading-hero"><span class="cw233-round13-loading-avatar"></span><span class="cw233-round13-loading-lines"><i></i><i></i></span><span class="cw233-round13-loading-stats"><i class="cw233-round13-loading-stat"></i><i class="cw233-round13-loading-stat"></i></span></div><div class="cw233-round13-loading-tabs">${'<i class="cw233-round13-loading-tab"></i>'.repeat(5)}</div><div class="cw233-round13-loading-list">${'<i class="cw233-round13-loading-row"></i>'.repeat(3)}</div>`;
}

function rankingLoadingOverlay(documentRef) {
  let overlay = documentRef.getElementById?.(RANKING_LOADING_ID);
  if (overlay) return overlay;
  overlay = documentRef.createElement('div');
  overlay.id = RANKING_LOADING_ID;
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = rankingLoadingHtml();
  (documentRef.body || documentRef.documentElement)?.appendChild?.(overlay);
  return overlay;
}

function hideRankingLoading(documentRef) {
  const overlay = documentRef.getElementById?.(RANKING_LOADING_ID);
  if (!overlay) return;
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  if (rankingLoadingTimer) {
    globalThis.clearTimeout?.(rankingLoadingTimer);
    rankingLoadingTimer = 0;
  }
}

function showRankingLoading(documentRef) {
  const overlay = rankingLoadingOverlay(documentRef);
  overlay.hidden = false;
  overlay.setAttribute('aria-hidden', 'false');
  if (rankingLoadingTimer) globalThis.clearTimeout?.(rankingLoadingTimer);
  rankingLoadingTimer = globalThis.setTimeout?.(() => hideRankingLoading(documentRef), 8000) || 0;
}

function syncRankingLoading(documentRef) {
  const overlay = documentRef.getElementById?.(RANKING_LOADING_ID);
  if (!overlay || overlay.hidden) return;
  const page = documentRef.querySelector?.('#ciao-miniapp-root .cw233-ranking-page');
  if (!page) return;
  const isSkeleton = Boolean(page.querySelector?.('.cw233-ranking-skeleton'));
  if (!isSkeleton) {
    globalThis.requestAnimationFrame?.(() => hideRankingLoading(documentRef));
  }
}

function hideOverlay(documentRef, id) {
  const overlay = documentRef.getElementById?.(id);
  if (!overlay) return;
  overlay.hidden = true;
  overlay.setAttribute?.('aria-hidden', 'true');
}

function handleBottomNavPointerdown(event, documentRef) {
  const nav = event.target?.closest?.('#ciao-miniapp-root .nav button[data-tab]');
  if (!nav) return;
  const tab = text(nav.dataset?.tab);
  if (tab !== 'calendar') hideOverlay(documentRef, 'ciao-v232-matches-overlay');
  hideOverlay(documentRef, 'ciao-v233-match-center-overlay');
  if (tab === 'table') showRankingLoading(documentRef);
  else hideRankingLoading(documentRef);
}

function applyDom(documentRef) {
  compactTableSelectors(documentRef);
  syncRankingLoading(documentRef);
  void syncSerieARounds(documentRef);
}

function queueApply(documentRef) {
  if (applyQueued) return;
  applyQueued = true;
  const run = () => {
    applyQueued = false;
    applyDom(documentRef);
  };
  if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(run);
  else globalThis.setTimeout?.(run, 0);
}

export function installRound13MobileRegressions(documentRef = globalThis.document) {
  if (!documentRef?.head || !documentRef?.createElement) return null;
  if (!documentRef.getElementById(STYLE_ID)) {
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = ROUND13_CSS;
    documentRef.head.appendChild(style);
  }
  rankingLoadingOverlay(documentRef);
  documentRef.addEventListener?.('pointerdown', event => handleBottomNavPointerdown(event, documentRef), true);
  documentRef.addEventListener?.('click', event => {
    const filter = event.target?.closest?.('[data-cw233-filter], [data-cw233-mode]');
    if (filter) queueApply(documentRef);
  }, true);
  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(() => queueApply(documentRef))
    : null;
  observer?.observe?.(documentRef.documentElement || documentRef.body, {
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['aria-selected','hidden'],
  });
  applyDom(documentRef);
  return Object.freeze({
    refresh:() => applyDom(documentRef),
    disconnect:() => observer?.disconnect?.(),
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installRound13MobileRegressions(document), { once:true });
  } else {
    installRound13MobileRegressions(document);
  }
}
