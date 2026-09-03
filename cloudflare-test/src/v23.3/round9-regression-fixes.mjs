import { normalizeTeamAlias, russianTeamName } from '../v23.2/team-registry.mjs';

export const USER_FEEDBACK_ROUND9_BUILD = '2026-09-03-r9';

const STYLE_ID = 'ciao-v233-round9-regression-style';
const SERIE_A_ACTIVE = 'cw233-serie-a-active';
const SERIE_A_HEAD = 'cw233-serie-a-competition-head';
const SERIE_A_LEGACY_HERO = 'cw233-serie-a-legacy-hero';
const THEME_BY_COMPETITION = Object.freeze({
  serie_a:'serie-a', coppa_italia:'coppa', ucl:'champions', uel:'europa', uecl:'conference',
});

let observer = null;
let serieAActive = false;
let crestMapPromise = null;
let rafQueued = false;

const CSS = `
/* Favorite club: remove the obsolete nearest-match mini-card completely. */
#ciao-miniapp-root .cw211-favorite-body .cw231-favorite-shell,
#ciao-miniapp-root .cw211-favorite-body .cw211-info-card:nth-child(2){display:none!important}
#ciao-miniapp-root .cw211-favorite-body{grid-template-columns:minmax(0,1fr)!important}
#ciao-miniapp-root .cw211-favorite-body .cw211-info-card:first-child{width:100%!important;max-width:none!important}

/* UEFA round navigation: enough trailing room + active tab is scrolled into view by runtime. */
#ciao-v232-matches-overlay .cw232-group-tabs{scroll-padding-inline:16px!important;padding-right:max(20px,env(safe-area-inset-right,0px))!important;padding-left:1px!important}
#ciao-v232-matches-overlay .cw232-group-tabs button:last-child{margin-right:6px!important}

/* Serie A legacy view: replace the old Ciao hero with the same compact tournament header used elsewhere. */
html.${SERIE_A_ACTIVE} #ciao-miniapp-root .${SERIE_A_LEGACY_HERO}{display:none!important}
html.${SERIE_A_ACTIVE} #ciao-miniapp-root .cw232-serie-a-back{display:none!important}
.${SERIE_A_HEAD}{display:grid;grid-template-columns:44px minmax(0,1fr);gap:13px;align-items:center;margin:0 0 20px;padding:4px 0 0;color:#fff}
.${SERIE_A_HEAD}__back{width:44px;height:44px;border:1px solid rgba(132,150,205,.22);border-radius:15px;background:linear-gradient(180deg,rgba(30,43,70,.92),rgba(16,27,47,.94));color:#fff;font:900 18px/1 inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
.${SERIE_A_HEAD}__copy{min-width:0}
.${SERIE_A_HEAD}__copy>span{display:block;margin-bottom:5px;color:rgba(174,188,224,.58);font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
.${SERIE_A_HEAD}__copy h2{margin:0;color:#fff;font-size:31px;line-height:1.02;letter-spacing:-.045em;font-weight:950}
.${SERIE_A_HEAD}__copy p{margin:7px 0 0;color:#aeb9d7;font-size:13px;font-weight:600}

/* Tables: explicit tournament-aware premium shell. These override the old fixed-blue polish. */
#ciao-v233-tables-overlay .cw233-tables-hub{--r9a:#315bff;--r9b:#183bd8;--r9soft:rgba(49,91,255,.15);--r9line:rgba(103,142,255,.30);--r9glow:rgba(45,79,228,.22)}
#ciao-v233-tables-overlay .cw233-tables-hub[data-cw233-theme='serie-a']{--r9a:#315bff;--r9b:#183bd8;--r9soft:rgba(49,91,255,.15);--r9line:rgba(103,142,255,.30);--r9glow:rgba(45,79,228,.22)}
#ciao-v233-tables-overlay .cw233-tables-hub[data-cw233-theme='coppa']{--r9a:#e53b49;--r9b:#087e46;--r9soft:rgba(229,59,73,.13);--r9line:rgba(236,92,104,.27);--r9glow:rgba(203,51,65,.18)}
#ciao-v233-tables-overlay .cw233-tables-hub[data-cw233-theme='champions']{--r9a:#4b63ff;--r9b:#222b9d;--r9soft:rgba(75,99,255,.15);--r9line:rgba(112,130,255,.29);--r9glow:rgba(67,82,220,.22)}
#ciao-v233-tables-overlay .cw233-tables-hub[data-cw233-theme='europa']{--r9a:#ff790d;--r9b:#b84000;--r9soft:rgba(255,121,13,.13);--r9line:rgba(255,145,58,.28);--r9glow:rgba(222,93,0,.19)}
#ciao-v233-tables-overlay .cw233-tables-hub[data-cw233-theme='conference']{--r9a:#22c875;--r9b:#087b46;--r9soft:rgba(34,200,117,.13);--r9line:rgba(73,218,141,.27);--r9glow:rgba(17,157,87,.19)}
#ciao-v233-tables-overlay .cw233-tables-head{position:relative!important;margin:0 0 14px!important;padding:18px 18px 17px!important;border:1px solid var(--r9line)!important;border-radius:23px!important;background:radial-gradient(circle at 92% 5%,var(--r9soft),transparent 43%),linear-gradient(145deg,rgba(20,36,78,.88),rgba(8,18,40,.93))!important;box-shadow:0 14px 34px rgba(0,0,0,.17),inset 0 1px 0 rgba(255,255,255,.045)!important;overflow:hidden}
#ciao-v233-tables-overlay .cw233-tables-head:after{content:'';position:absolute;left:18px;right:18px;bottom:0;height:2px;border-radius:999px;background:linear-gradient(90deg,transparent,var(--r9a),transparent);opacity:.8}
#ciao-v233-tables-overlay .cw233-tables-head>span{color:#d9e2ff!important;opacity:.88!important}
#ciao-v233-tables-overlay .cw233-table-selector.is-active{background:linear-gradient(145deg,var(--r9a),var(--r9b))!important;color:#fff!important;border-color:rgba(255,255,255,.18)!important;box-shadow:0 8px 22px var(--r9glow),inset 0 1px 0 rgba(255,255,255,.18)!important}
#ciao-v233-tables-overlay .cw233-standing-table tbody td{border-top-color:var(--r9line)!important;border-bottom-color:var(--r9line)!important;background:radial-gradient(circle at 0 50%,var(--r9soft),transparent 35%),linear-gradient(180deg,rgba(20,34,61,.985),rgba(12,23,43,.985))!important}
#ciao-v233-tables-overlay .cw233-standing-table tbody td:first-child{border-left-color:var(--r9line)!important;box-shadow:inset 3px 0 0 var(--r9a)!important}
#ciao-v233-tables-overlay .cw233-standing-table tbody td:last-child{border-right-color:var(--r9line)!important}
#ciao-v233-tables-overlay .cw233-standing-position{color:#b7c5ff!important;text-shadow:0 0 16px var(--r9glow)!important}
#ciao-v233-tables-overlay .cw233-standing-points{font-size:15px!important;font-weight:950!important}
#ciao-v233-tables-overlay .cw233-table-logo{width:34px!important;height:34px!important;min-width:34px!important;min-height:34px!important;margin-right:9px!important;object-fit:contain!important;padding:2px!important;border-radius:10px!important;background:rgba(255,255,255,.025)!important;filter:drop-shadow(0 5px 10px rgba(0,0,0,.24))!important}
#ciao-v233-tables-overlay .cw233-table-logo--empty{background:var(--r9soft)!important;border:1px solid var(--r9line)!important;color:#d7def6!important}
`;

function rootNode(documentRef = globalThis.document) {
  return documentRef?.getElementById?.('ciao-miniapp-root') || null;
}
function contentNode(documentRef = globalThis.document) {
  return rootNode(documentRef)?.querySelector?.('.content') || null;
}
function clean(value) { return String(value ?? '').trim(); }
function canonicalName(value) {
  const raw = clean(value);
  return raw ? normalizeTeamAlias(russianTeamName(raw)) : '';
}
function teamCrest(team = {}) {
  return clean(team?.crestUrl || team?.logo_url || team?.logoUrl || team?.logo || team?.crest_url);
}

function installStyles(documentRef) {
  if (documentRef.getElementById?.(STYLE_ID)) return;
  const style = documentRef.createElement?.('style');
  if (!style) return;
  style.id = STYLE_ID;
  style.textContent = CSS;
  documentRef.head?.appendChild?.(style);
}

export function pruneFavoriteNearest(documentRef = globalThis.document) {
  let removed = 0;
  for (const body of documentRef?.querySelectorAll?.('.cw211-favorite-body') || []) {
    for (const card of body.querySelectorAll?.('.cw211-info-card') || []) {
      const label = clean(card.querySelector?.('small')?.textContent || card.textContent);
      if (!/Ближайший матч/i.test(label)) continue;
      card.remove();
      removed += 1;
    }
    if ((body.querySelectorAll?.('.cw211-info-card')?.length || 0) <= 1) body.classList?.add?.('cw233-favorite-single');
  }
  return removed;
}

function selectedGroupTab(documentRef = globalThis.document) {
  return documentRef?.querySelector?.('#ciao-v232-matches-overlay .cw232-group-tabs button[aria-selected="true"]') || null;
}
export function revealSelectedGroupTab(documentRef = globalThis.document) {
  const button = selectedGroupTab(documentRef);
  if (!button?.scrollIntoView) return false;
  button.scrollIntoView({ behavior:'auto', block:'nearest', inline:'center' });
  return true;
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

function activeTableTheme(documentRef = globalThis.document) {
  const hub = documentRef?.querySelector?.('#ciao-v233-tables-overlay .cw233-tables-hub');
  if (!hub) return null;
  const competition = clean(hub.dataset?.cw233TablesSelected || 'serie_a');
  const theme = THEME_BY_COMPETITION[competition] || 'serie-a';
  if (hub.dataset?.cw233Theme !== theme) hub.dataset.cw233Theme = theme;
  return { hub, competition, theme };
}

function seasonRange(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const start = month >= 7 ? year : year - 1;
  return { from:`${start}-07-01`, to:`${start + 1}-06-30` };
}

async function loadSerieACrestMap() {
  if (crestMapPromise) return crestMapPromise;
  crestMapPromise = (async () => {
    const map = new Map();
    try {
      const range = seasonRange(new Date());
      const url = new URL('/api/v23.2/matches', globalThis.location?.origin || 'https://ciao-web-app-test.ciao-web.workers.dev');
      url.searchParams.set('competition', 'serie_a');
      url.searchParams.set('from', range.from);
      url.searchParams.set('to', range.to);
      const initData = clean(globalThis.Telegram?.WebApp?.initData);
      const response = await fetch(url, {
        headers:{ 'x-telegram-init-data':initData, 'cache-control':'no-cache' },
        cache:'no-store',
      });
      if (!response.ok) return map;
      const payload = await response.json();
      for (const match of Array.isArray(payload?.data?.matches) ? payload.data.matches : []) {
        for (const team of [match?.homeTeam, match?.awayTeam]) {
          const crest = teamCrest(team);
          if (!crest) continue;
          const id = clean(team?.id);
          const name = canonicalName(team?.name || team?.rawName);
          if (id) map.set(`id:${id}`, crest);
          if (name) map.set(`name:${name}`, crest);
        }
      }
    } catch {}
    return map;
  })();
  return crestMapPromise;
}

async function hydrateSerieATableCrests(documentRef = globalThis.document) {
  const current = activeTableTheme(documentRef);
  if (!current || current.competition !== 'serie_a') return 0;
  const fallbacks = [...(current.hub.querySelectorAll?.('.cw233-standing-team .cw233-table-logo-fallback') || [])];
  if (!fallbacks.length) return 0;
  const map = await loadSerieACrestMap();
  let hydrated = 0;
  for (const fallback of fallbacks) {
    if (!fallback.isConnected) continue;
    const row = fallback.closest?.('[data-cw233-standing-team]');
    const cell = fallback.closest?.('.cw233-standing-team');
    const id = clean(row?.dataset?.cw233StandingTeam);
    const name = canonicalName(cell?.querySelector?.('strong')?.textContent);
    const crest = (id && map.get(`id:${id}`)) || (name && map.get(`name:${name}`)) || '';
    if (!crest) continue;
    const img = documentRef.createElement('img');
    img.className = 'cw233-table-logo';
    img.src = crest;
    img.alt = '';
    img.loading = 'eager';
    img.decoding = 'sync';
    fallback.replaceWith(img);
    hydrated += 1;
  }
  return hydrated;
}

function apply(documentRef = globalThis.document) {
  pruneFavoriteNearest(documentRef);
  activeTableTheme(documentRef);
  if (serieAActive) ensureSerieAHeader(documentRef);
  void hydrateSerieATableCrests(documentRef);
  revealSelectedGroupTab(documentRef);
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

    if (target.closest('[data-cw232-action="group-view"]')) {
      setTimeout(() => revealSelectedGroupTab(documentRef), 0);
    }
  }, true);

  if (!observer && typeof MutationObserver === 'function') {
    observer = new MutationObserver(() => queueApply(documentRef));
    observer.observe(documentRef.documentElement || documentRef.body, {
      childList:true, subtree:true, attributes:true,
      attributeFilter:['aria-selected','hidden','data-cw233-tables-selected'],
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
