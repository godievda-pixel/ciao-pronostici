export const USER_FEEDBACK_ROUND13_BUILD = '2026-09-03-r13';

const STYLE_ID = 'ciao-v233-round13-mobile-style';
const SERIE_A_NAV_CLASS = 'cw233-serie-a-round-nav-shell';
const SERIE_A_CACHE_TTL = 60_000;
const TABLE_LABELS = Object.freeze({
  serie_a:'Серия А',
  ucl:'ЛЧ',
  uel:'ЛЕ',
  uecl:'ЛК',
  coppa_italia:'КИ',
});

let serieAScheduleCache = null;
let serieAScheduleLoadedAt = 0;
let serieAScheduleInflight = null;
let serieARetryTimer = 0;
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

/* Tables: all five competitions fit one mobile line with no selector scroll. */
#ciao-v233-tables-overlay .cw233-table-selectors-viewport{overflow-x:hidden!important;overscroll-behavior-x:none!important}
#ciao-v233-tables-overlay .cw233-table-selectors{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important;min-width:0!important;overflow:hidden!important;width:100%!important;padding-right:0!important}
#ciao-v233-tables-overlay .cw233-table-selector{min-width:0!important;width:100%!important;padding:0 3px!important;white-space:nowrap!important;text-align:center!important;font-size:10px!important}

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
}

function applyDom(documentRef) {
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
  const onPointerdown = event => handleBottomNavPointerdown(event, documentRef);
  const onClick = event => {
    const filter = event.target?.closest?.('[data-cw233-filter], [data-cw233-mode]');
    if (filter) queueApply(documentRef);
    const nav = event.target?.closest?.('#ciao-miniapp-root .nav button[data-tab]');
    if (nav?.dataset?.tab === 'seriea') globalThis.setTimeout?.(() => queueApply(documentRef), 0);
  };
  const onThemeRefresh = () => queueApply(documentRef);
  documentRef.addEventListener?.('pointerdown', onPointerdown, true);
  documentRef.addEventListener?.('click', onClick, true);
  documentRef.addEventListener?.('ciao-v233-round11-theme', onThemeRefresh);
  applyDom(documentRef);
  return Object.freeze({
    refresh:() => applyDom(documentRef),
    disconnect:() => {
      documentRef.removeEventListener?.('pointerdown', onPointerdown, true);
      documentRef.removeEventListener?.('click', onClick, true);
      documentRef.removeEventListener?.('ciao-v233-round11-theme', onThemeRefresh);
    },
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installRound13MobileRegressions(document), { once:true });
  } else {
    installRound13MobileRegressions(document);
  }
}
