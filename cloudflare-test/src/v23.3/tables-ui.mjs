import { getCompetitionConfig } from '../v23.2/competition-config.mjs';
import { buildCoppaBracket } from '../v23.2/coppa-bracket.mjs';
import { loadCompetitionMatches } from '../v23.2/data-client.mjs';
import { formatKickoff, seasonDateRange } from '../v23.2/matches-ui.mjs';
import { loadCompetitionStandings } from './data-client.mjs';

const OVERLAY_ID = 'ciao-v233-tables-overlay';
const STYLE_ID = 'ciao-v233-tables-style';
const TABLE_COMPETITIONS = Object.freeze(['serie_a', 'ucl', 'uel', 'uecl', 'coppa_italia']);
const TABLES_CACHE_TTL = 60_000;
const TABLES_CACHE = new Map();

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function displayStat(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '—';
}

function goalsText(row = {}) {
  const goalsFor = displayStat(row?.goalsFor);
  const goalsAgainst = displayStat(row?.goalsAgainst);
  return goalsFor === '—' && goalsAgainst === '—' ? '—' : `${goalsFor}:${goalsAgainst}`;
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '?';
}

function teamLogo(team) {
  const url = String(team?.crestUrl || '').trim();
  return url
    ? `<img class="cw233-table-logo" src="${esc(url)}" alt="" loading="eager" decoding="sync" width="30" height="30">`
    : `<span class="cw233-table-logo cw233-table-logo--empty cw233-table-logo-fallback" aria-hidden="true">${esc(initials(team?.name || team?.rawName))}</span>`;
}

function renderSelectors(selectedCompetition) {
  return `<div class="cw233-table-selectors-viewport">
    <div class="cw233-table-selectors" role="tablist" aria-label="Турнирные таблицы">
      ${TABLE_COMPETITIONS.map(competition => {
        const config = getCompetitionConfig(competition);
        const active = selectedCompetition === competition;
        return `<button type="button" class="cw233-table-selector${active ? ' is-active' : ''}" data-cw233-tables-action="competition" data-cw233-tables-competition="${esc(competition)}" aria-selected="${active ? 'true' : 'false'}">${esc(config.title)}</button>`;
      }).join('')}
    </div>
  </div>`;
}

function serieAZone(position) {
  const value = Number(position);
  if (value >= 1 && value <= 4) return 'ucl';
  if (value === 5) return 'uel';
  if (value === 6) return 'uecl';
  if (value >= 18 && value <= 20) return 'relegation';
  return '';
}

function zoneClass(competition, position) {
  if (competition !== 'serie_a') return '';
  const zone = serieAZone(position);
  return zone ? ` class="cw233-zone cw233-zone--${zone}"` : '';
}

function serieALegend() {
  return `<aside class="cw233-standing-legend" aria-label="Зоны таблицы Серии А">
    <div class="cw233-standing-legend__items">
      <span><i class="cw233-legend-dot cw233-legend-dot--ucl"></i><b>1–4</b> Лига чемпионов</span>
      <span><i class="cw233-legend-dot cw233-legend-dot--uel"></i><b>5</b> Лига Европы</span>
      <span><i class="cw233-legend-dot cw233-legend-dot--uecl"></i><b>6</b> Лига конференций</span>
      <span><i class="cw233-legend-dot cw233-legend-dot--relegation"></i><b>18–20</b> Вылет в Серию B</span>
    </div>
    <p>Зоны показаны по базовому распределению мест. Итоговые еврокубковые позиции могут измениться по регламенту UEFA и результатам Кубка Италии.</p>
  </aside>`;
}

function renderStandingRows(rows = [], competition = '') {
  if (!rows.length) {
    return '<div class="cw233-tables-empty">Таблица пока недоступна</div>';
  }

  return `<div class="cw233-standing-viewport cw233-standing-wrap">
    <table class="cw233-standing-table cw233-standing-table--full">
      <thead><tr><th>#</th><th>Команда</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>Г</th><th>РМ</th><th>О</th></tr></thead>
      <tbody>${rows.map(row => `<tr${zoneClass(competition, row?.position)} data-cw233-standing-team="${esc(row?.team?.id || row?.team?.name || '')}">
        <td class="cw233-standing-position">${esc(displayStat(row?.position))}</td>
        <td class="cw233-standing-team">${teamLogo(row?.team)}<strong>${esc(row?.team?.name || row?.team?.rawName || '—')}</strong></td>
        <td data-cw233-stat="played">${esc(displayStat(row?.played))}</td>
        <td data-cw233-stat="wins">${esc(displayStat(row?.wins))}</td>
        <td data-cw233-stat="draws">${esc(displayStat(row?.draws))}</td>
        <td data-cw233-stat="losses">${esc(displayStat(row?.losses))}</td>
        <td data-cw233-stat="goals">${esc(goalsText(row))}</td>
        <td class="cw233-standing-goal-difference" data-cw233-stat="goal-difference">${esc(displayStat(row?.goalDifference))}</td>
        <td class="cw233-standing-points" data-cw233-stat="points">${esc(displayStat(row?.points))}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>${competition === 'serie_a' ? serieALegend() : ''}`;
}

function bracketStatus(match) {
  if (match?.score) return String(match.score);
  if (match?.status === 'postponed') return 'Матч перенесён';
  if (match?.status === 'cancelled') return 'Матч отменён';
  return formatKickoff(match?.kickoffAt);
}

function renderCoppaBracket(matches = []) {
  const bracket = buildCoppaBracket(matches);
  if (!bracket.rounds.length) {
    return '<div class="cw233-tables-empty">Сетка появится после формирования 1/8 финала</div>';
  }

  return `<div class="cw232-bracket-viewport">
    <div class="cw232-bracket">
      ${bracket.rounds.map(round => `<section class="cw232-bracket-round" data-cw232-bracket-round="${esc(round.key)}">
        <div class="cw232-bracket-round__title">${esc(round.title)}</div>
        <div class="cw232-bracket-round__matches">
          ${round.matches.map(match => `<article class="cw232-bracket-match" data-cw232-match="${esc(match.id)}">
            <div class="cw232-bracket-team">${esc(match.homeLabel)}</div>
            <div class="cw232-bracket-team">${esc(match.awayLabel)}</div>
            <div class="cw232-bracket-meta">${esc(bracketStatus(match))}</div>
          </article>`).join('')}
        </div>
      </section>`).join('')}
    </div>
  </div>`;
}

function renderBody(selectedCompetition, data, { loading = false, error = false } = {}) {
  if (loading) {
    return `<div class="cw233-table-loading" aria-label="Загрузка таблицы">${Array.from({ length:8 }, () => '<span></span>').join('')}</div>`;
  }
  if (error) {
    return `<div class="cw233-tables-error">Не удалось загрузить данные<button type="button" data-cw233-tables-action="retry" data-cw233-tables-competition="${esc(selectedCompetition)}">Повторить</button></div>`;
  }
  if (!data) {
    return '<div class="cw233-tables-empty">Выбери турнир, чтобы открыть таблицу</div>';
  }
  if (selectedCompetition === 'coppa_italia') {
    return renderCoppaBracket(Array.isArray(data?.matches) ? data.matches : []);
  }
  return renderStandingRows(Array.isArray(data?.rows) ? data.rows : [], selectedCompetition);
}

export function renderTablesHub({
  selectedCompetition = 'serie_a',
  data = null,
  loading = false,
  error = false,
} = {}) {
  if (!TABLE_COMPETITIONS.includes(selectedCompetition)) {
    selectedCompetition = 'serie_a';
  }
  const config = getCompetitionConfig(selectedCompetition);
  return `<section class="cw233-tables-hub" data-cw233-tables-view="hub" data-cw233-tables-selected="${esc(selectedCompetition)}">
    <header class="cw233-tables-head">
      <span>Ciao, Web!</span>
      <h2>Таблицы</h2>
      <p>${selectedCompetition === 'coppa_italia' ? 'Сетка плей-офф' : esc(config.title)}</p>
    </header>
    ${renderSelectors(selectedCompetition)}
    <div class="cw233-tables-content" data-cw233-tables-content="${esc(selectedCompetition)}">
      ${renderBody(selectedCompetition, data, { loading, error })}
    </div>
  </section>`;
}

export async function loadTablesCompetition(
  competition,
  {
    now = new Date(),
    loadStandings = loadCompetitionStandings,
    loadMatches = loadCompetitionMatches,
  } = {},
) {
  if (!TABLE_COMPETITIONS.includes(competition)) {
    throw new Error(`Unsupported tables competition: ${competition}`);
  }

  const data = competition === 'coppa_italia'
    ? await loadMatches(competition, seasonDateRange(now))
    : await loadStandings(competition);

  return renderTablesHub({ selectedCompetition: competition, data });
}

function cachedTable(cache, competition, now = Date.now()) {
  const entry = cache?.get?.(competition);
  if (!entry) return null;
  if (now - entry.at > TABLES_CACHE_TTL) {
    cache.delete?.(competition);
    return null;
  }
  return entry.html;
}

export function createTablesUiController({
  show,
  hide,
  loadCompetition = loadTablesCompetition,
  cache = null,
} = {}) {
  if (typeof show !== 'function' || typeof hide !== 'function') {
    throw new Error('Tables UI controller requires show and hide');
  }

  const responseCache = cache || new Map();
  let requestVersion = 0;
  let activeCompetition = '';

  function openHub() {
    requestVersion += 1;
    activeCompetition = '';
    show(renderTablesHub());
  }

  function close() {
    requestVersion += 1;
    activeCompetition = '';
    hide();
  }

  async function openCompetition(competition, { force = false } = {}) {
    if (!TABLE_COMPETITIONS.includes(competition)) {
      throw new Error(`Unsupported tables competition: ${competition}`);
    }
    const version = ++requestVersion;
    activeCompetition = competition;
    const cached = force ? null : cachedTable(responseCache, competition);
    if (cached) {
      show(cached, { cached:true });
      return 'cached';
    }
    show(renderTablesHub({ selectedCompetition: competition, loading: true }), { loading:true });
    try {
      const html = await loadCompetition(competition);
      if (version !== requestVersion || activeCompetition !== competition) return 'stale';
      responseCache.set(competition, { at:Date.now(), html });
      show(html, { loaded:true });
      return 'loaded';
    } catch {
      if (version !== requestVersion || activeCompetition !== competition) return 'stale';
      show(renderTablesHub({ selectedCompetition: competition, error: true }), { error:true });
      return 'error';
    }
  }

  function invalidate(competition) {
    if (competition) responseCache.delete(competition);
    else responseCache.clear();
  }

  return Object.freeze({ openHub, openCompetition, close, invalidate });
}

const TABLES_CSS = `
#${OVERLAY_ID}{position:fixed;inset:0;z-index:43;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;background:#07101f;color:#fff;padding:calc(18px + env(safe-area-inset-top,0px)) 16px calc(104px + env(safe-area-inset-bottom,0px));font-family:inherit;-webkit-overflow-scrolling:touch;overflow-anchor:none}
#${OVERLAY_ID}[hidden]{display:none!important}#${OVERLAY_ID} *{box-sizing:border-box}.cw233-tables-hub{width:min(100%,840px);max-width:100%;margin:0 auto}.cw233-tables-head{padding:8px 2px 16px}.cw233-tables-head>span{display:block;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.58;margin-bottom:7px}.cw233-tables-head h2{margin:0;font-size:30px;line-height:1.05;letter-spacing:-.04em}.cw233-tables-head p{margin:7px 0 0;color:rgba(255,255,255,.6);font-size:13px}
.cw233-table-selectors-viewport{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin:0 0 18px;padding:0 0 4px}.cw233-table-selectors-viewport::-webkit-scrollbar{display:none;width:0;height:0}.cw233-table-selectors{display:flex;gap:8px;min-width:max-content}.cw233-table-selector{min-height:42px;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:0 14px;background:rgba(255,255,255,.055);color:rgba(255,255,255,.7);font:800 12px/1 inherit;white-space:nowrap}.cw233-table-selector.is-active{background:#fff;color:#07101f;border-color:#fff}.cw233-tables-content{min-width:0;max-width:100%;min-height:360px}
.cw233-standing-viewport{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;border:0;border-radius:0;background:transparent}.cw233-standing-viewport::-webkit-scrollbar{display:none;width:0;height:0}.cw233-standing-table{width:100%;min-width:0;table-layout:fixed;border-collapse:separate;border-spacing:0 8px;font-size:12px}.cw233-standing-table th{padding:7px 6px;color:rgba(151,168,214,.72);font-size:9px;letter-spacing:.08em;text-transform:uppercase;text-align:center;border:0}.cw233-standing-table th:nth-child(1){width:38px}.cw233-standing-table th:nth-child(2){width:190px;text-align:left}.cw233-standing-table th:nth-child(3),.cw233-standing-table th:nth-child(4),.cw233-standing-table th:nth-child(5),.cw233-standing-table th:nth-child(6){width:44px}.cw233-standing-table th:nth-child(7){width:64px}.cw233-standing-table th:nth-child(8){width:52px}.cw233-standing-table th:nth-child(9){width:46px}.cw233-standing-table td{height:58px;padding:8px 6px;text-align:center;border-top:1px solid rgba(128,148,198,.16);border-bottom:1px solid rgba(128,148,198,.16);background:linear-gradient(180deg,rgba(19,31,51,.98),rgba(13,23,38,.98));font-variant-numeric:tabular-nums}.cw233-standing-table td:first-child{border-left:1px solid rgba(128,148,198,.16);border-radius:16px 0 0 16px}.cw233-standing-table td:last-child{border-right:1px solid rgba(128,148,198,.16);border-radius:0 16px 16px 0}.cw233-standing-position{font-weight:850;color:#7da0ff}.cw233-standing-team{text-align:left!important;display:flex;align-items:center;gap:9px;min-width:0}.cw233-standing-team strong{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12px;white-space:nowrap}.cw233-table-logo{width:30px;height:30px;min-width:30px;min-height:30px;object-fit:contain;flex:0 0 30px}.cw233-table-logo--empty{border-radius:50%;background:rgba(80,106,160,.22);border:1px solid rgba(117,144,203,.18)}.cw233-table-logo-fallback{display:inline-flex;align-items:center;justify-content:center;color:#b9c5ec;font-size:9px;font-weight:900}.cw233-standing-goal-difference{font-weight:750;color:rgba(225,232,250,.86)}.cw233-standing-points{font-weight:900;font-size:13px;color:#fff}
#${OVERLAY_ID} .cw233-standing-table th,#${OVERLAY_ID} .cw233-standing-table td{display:table-cell!important}
.cw233-zone td:first-child{position:relative}.cw233-zone td:first-child:before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:4px}.cw233-zone--ucl td:first-child:before{background:#4f7cff}.cw233-zone--uel td:first-child:before{background:#ff9c4a}.cw233-zone--uecl td:first-child:before{background:#48c78e}.cw233-zone--relegation td:first-child:before{background:#ff5468}
.cw233-standing-legend{margin-top:14px;padding:14px 15px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.03)}.cw233-standing-legend__items{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 12px}.cw233-standing-legend__items span{display:flex;align-items:center;gap:6px;color:rgba(222,228,247,.78);font-size:10px;line-height:1.25}.cw233-standing-legend__items b{color:#fff;font-size:10px}.cw233-legend-dot{width:7px;height:7px;min-width:7px;border-radius:50%}.cw233-legend-dot--ucl{background:#4f7cff}.cw233-legend-dot--uel{background:#ff9c4a}.cw233-legend-dot--uecl{background:#48c78e}.cw233-legend-dot--relegation{background:#ff5468}.cw233-standing-legend p{margin:11px 0 0;padding-top:10px;border-top:1px solid rgba(255,255,255,.06);color:rgba(181,192,224,.52);font-size:9px;line-height:1.45}
.cw232-bracket-viewport{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;padding:2px 0 12px}.cw232-bracket{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(220px,260px);gap:16px;min-width:max-content;align-items:start}.cw232-bracket-round{min-width:0}.cw232-bracket-round__title{margin:0 0 9px;font-size:12px;font-weight:850;letter-spacing:.04em;color:rgba(255,255,255,.72)}.cw232-bracket-round__matches{display:grid;gap:12px}.cw232-bracket-match{border:1px solid rgba(255,255,255,.11);border-radius:17px;background:linear-gradient(135deg,rgba(22,59,42,.22),rgba(73,22,28,.2)),rgba(255,255,255,.05);padding:12px}.cw232-bracket-team{min-height:34px;display:flex;align-items:center;padding:7px 9px;border-radius:10px;background:rgba(255,255,255,.055);font-size:11px;font-weight:750;line-height:1.2}.cw232-bracket-team+.cw232-bracket-team{margin-top:5px}.cw232-bracket-meta{margin-top:8px;font-size:9px;color:rgba(255,255,255,.52);text-align:center}
.cw233-tables-empty,.cw233-tables-error{padding:28px 18px;border:1px solid rgba(255,255,255,.09);border-radius:18px;color:rgba(255,255,255,.62);text-align:center}.cw233-tables-error button{display:block;width:100%;margin-top:14px;border:0;border-radius:14px;padding:13px;background:#fff;color:#07101f;font:800 12px/1 inherit}.cw233-table-loading{display:grid;gap:9px}.cw233-table-loading span{display:block;height:58px;border-radius:16px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.1),rgba(255,255,255,.04));background-size:220% 100%;animation:cw233tablepulse 1.2s linear infinite}@keyframes cw233tablepulse{to{background-position:-220% 0}}
@media(max-width:390px){#${OVERLAY_ID}{padding-left:12px;padding-right:12px}.cw233-tables-head h2{font-size:27px}.cw233-table-selector{padding:0 12px;font-size:11px}.cw233-standing-legend__items{grid-template-columns:1fr}.cw233-standing-table td{padding-left:4px;padding-right:4px}.cw233-table-logo{width:28px;height:28px;min-width:28px;min-height:28px;flex-basis:28px}.cw233-standing-team{gap:7px}}
`;

function ensureStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = TABLES_CSS;
  documentRef.head?.appendChild?.(style);
}

function ensureOverlay(documentRef) {
  let overlay = documentRef.getElementById(OVERLAY_ID);
  if (overlay) return overlay;
  overlay = documentRef.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'cw233-tables-overlay';
  overlay.hidden = true;
  overlay.setAttribute?.('aria-live', 'polite');
  const mount = documentRef.getElementById('ciao-miniapp-root') || documentRef.body;
  mount?.appendChild?.(overlay);
  return overlay;
}

export function patchTablesHub(overlay, html) {
  if (!overlay) return false;
  const documentRef = overlay.ownerDocument || globalThis.document;
  const holder = documentRef?.createElement?.('div');
  if (!holder) return false;
  holder.innerHTML = html;
  const next = holder.querySelector?.('.cw233-tables-hub');
  if (!next) return false;
  const current = overlay.querySelector?.('.cw233-tables-hub');
  if (!current) {
    overlay.innerHTML = html;
    return true;
  }
  const overlayTop = Number(overlay.scrollTop) || 0;
  const selectorLeft = Number(current.querySelector?.('.cw233-table-selectors-viewport')?.scrollLeft) || 0;
  const standingLeft = Number(current.querySelector?.('.cw233-standing-viewport')?.scrollLeft) || 0;
  current.dataset.cw233TablesSelected = next.dataset?.cw233TablesSelected || 'serie_a';
  const currentHead = current.querySelector?.('.cw233-tables-head');
  const nextHead = next.querySelector?.('.cw233-tables-head');
  if (currentHead && nextHead) currentHead.innerHTML = nextHead.innerHTML;
  const currentSelectors = current.querySelector?.('.cw233-table-selectors-viewport');
  const nextSelectors = next.querySelector?.('.cw233-table-selectors-viewport');
  if (currentSelectors && nextSelectors) currentSelectors.innerHTML = nextSelectors.innerHTML;
  const currentContent = current.querySelector?.('[data-cw233-tables-content]');
  const nextContent = next.querySelector?.('[data-cw233-tables-content]');
  if (currentContent && nextContent) {
    currentContent.dataset.cw233TablesContent = nextContent.dataset?.cw233TablesContent || '';
    currentContent.innerHTML = nextContent.innerHTML;
  }
  overlay.scrollTop = overlayTop;
  const restoredSelectors = current.querySelector?.('.cw233-table-selectors-viewport');
  const restoredStanding = current.querySelector?.('.cw233-standing-viewport');
  if (restoredSelectors) restoredSelectors.scrollLeft = selectorLeft;
  if (restoredStanding) restoredStanding.scrollLeft = standingLeft;
  try { documentRef.dispatchEvent?.(new Event('ciao-v233-round11-theme')); } catch {}
  return true;
}

export function installTablesUi(
  documentRef = globalThis.document,
  {
    defer = fn => setTimeout(fn, 0),
    loadCompetition = loadTablesCompetition,
  } = {},
) {
  if (!documentRef?.addEventListener || !documentRef?.createElement) return null;

  ensureStyles(documentRef);
  const overlay = ensureOverlay(documentRef);
  const tablesCache = TABLES_CACHE;
  const controller = createTablesUiController({
    show(html) {
      patchTablesHub(overlay, html);
      overlay.hidden = false;
    },
    hide() {
      overlay.hidden = true;
    },
    loadCompetition,
    cache:tablesCache,
  });

  const handleNav = nav => {
    defer(() => {
      if (nav?.dataset?.tab === 'seriea') {
        overlay.scrollTop = 0;
        void controller.openCompetition('serie_a');
      } else {
        controller.close();
      }
    });
  };

  documentRef.addEventListener('click', event => {
    const target = event?.target;
    if (!target?.closest) return;

    const nav = target.closest('button[data-tab]');
    if (nav) {
      handleNav(nav);
      return;
    }

    const action = target.closest('[data-cw233-tables-action]');
    if (!action) return;
    const type = action.dataset?.cw233TablesAction;
    if (type === 'competition' || type === 'retry') {
      const competition = action.dataset?.cw233TablesCompetition;
      if (!TABLE_COMPETITIONS.includes(competition)) return;
      event.preventDefault?.();
      event.stopPropagation?.();
      if (type === 'retry') controller.invalidate(competition);
      void controller.openCompetition(competition, { force:type === 'retry' });
    }
  }, true);

  return controller;
}

export { TABLE_COMPETITIONS };

if (typeof document !== 'undefined') {
  installTablesUi(document);
}
