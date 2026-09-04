import { buildCoppaBracket } from '../v23.2/coppa-bracket.mjs';
import { loadCompetitionMatches } from '../v23.2/data-client.mjs';
import { formatKickoff, seasonDateRange } from '../v23.2/matches-ui.mjs';
import { loadCompetitionStandings } from './data-client.mjs';

const OVERLAY_ID = 'ciao-v233-tables-overlay';
const STYLE_ID = 'ciao-v233-tables-style';
const TABLE_COMPETITIONS = Object.freeze(['serie_a', 'ucl', 'uel', 'uecl', 'coppa_italia']);
const TABLES_CACHE_TTL = 60_000;
const TABLES_CACHE = new Map();
const TABLE_LABELS = Object.freeze({
  serie_a:'Серия А', ucl:'ЛЧ', uel:'ЛЕ', uecl:'ЛК', coppa_italia:'КИ',
});
const TABLE_TITLES = Object.freeze({
  serie_a:'Серия А', ucl:'Лига Чемпионов', uel:'Лига Европы', uecl:'Лига Конференций', coppa_italia:'Кубок Италии',
});
const TABLE_THEMES = Object.freeze({
  serie_a:'serie-a', ucl:'champions', uel:'europa', uecl:'conference', coppa_italia:'coppa',
});

export function tablesThemeForCompetition(value) {
  return TABLE_THEMES[String(value ?? '').trim()] || 'serie-a';
}

export function tablesLabelForCompetition(value) {
  const key = String(value ?? '').trim();
  return TABLE_LABELS[key] || TABLE_TITLES[key] || key;
}

export function tablesTitleForCompetition(value) {
  const key = String(value ?? '').trim();
  return TABLE_TITLES[key] || 'Таблицы';
}

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

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '?';
}

function teamLogo(team) {
  const url = String(team?.crestUrl || '').trim();
  return url
    ? `<img class="cw233-table-logo" src="${esc(url)}" alt="" loading="eager" decoding="sync" width="36" height="36">`
    : `<span class="cw233-table-logo cw233-table-logo--empty cw233-table-logo-fallback" aria-hidden="true">${esc(initials(team?.name || team?.rawName))}</span>`;
}

function renderSelectors(selectedCompetition) {
  return `<div class="cw233-table-selectors-viewport">
    <div class="cw233-table-selectors" role="tablist" aria-label="Турнирные таблицы">
      ${TABLE_COMPETITIONS.map(competition => {
        const active = selectedCompetition === competition;
        return `<button type="button" class="cw233-table-selector${active ? ' is-active' : ''}" data-cw233-tables-action="competition" data-cw233-tables-competition="${esc(competition)}" aria-selected="${active ? 'true' : 'false'}">${esc(tablesLabelForCompetition(competition))}</button>`;
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

export function renderStandingRows(rows = [], competition = '') {
  if (!rows.length) {
    return '<div class="cw233-tables-empty">Таблица пока недоступна</div>';
  }

  return `<div class="cw233-standing-viewport cw233-standing-wrap">
    <table class="cw233-standing-table cw233-standing-table--compact">
      <thead><tr><th>#</th><th>Команда</th><th>И</th><th>РМ</th><th>О</th></tr></thead>
      <tbody>${rows.map(row => `<tr${zoneClass(competition, row?.position)} data-cw233-standing-team="${esc(row?.team?.id || row?.team?.name || '')}">
        <td class="cw233-standing-position"><span>${esc(displayStat(row?.position))}</span></td>
        <td class="cw233-standing-team">${teamLogo(row?.team)}<strong>${esc(row?.team?.name || row?.team?.rawName || '—')}</strong></td>
        <td data-cw233-stat="played">${esc(displayStat(row?.played))}</td>
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
  const theme = tablesThemeForCompetition(selectedCompetition);
  return `<section class="cw233-tables-hub" data-cw233-tables-view="hub" data-cw233-tables-selected="${esc(selectedCompetition)}" data-cw233-theme="${esc(theme)}" data-cw233-round11-theme="${esc(theme)}">
    <header class="cw233-tables-head">
      <span>Ciao, Web!</span>
      <h2>Таблицы</h2>
      <p>${esc(tablesTitleForCompetition(selectedCompetition))}</p>
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
#${OVERLAY_ID}{position:fixed;inset:0;z-index:43;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;background:var(--cw-app-bg,#061128);color:#fff;padding:calc(18px + env(safe-area-inset-top,0px)) 12px calc(104px + env(safe-area-inset-bottom,0px));font-family:inherit;-webkit-overflow-scrolling:touch;overflow-anchor:none}
#${OVERLAY_ID}[hidden]{display:none!important}#${OVERLAY_ID} *{box-sizing:border-box}.cw233-tables-hub{width:min(100%,840px);max-width:100%;margin:0 auto}.cw233-tables-head{padding:8px 2px 16px}.cw233-tables-head>span{display:block;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:rgba(166,184,236,.62);margin-bottom:7px}.cw233-tables-head h2{margin:0;font-size:30px;line-height:1.05;letter-spacing:-.04em}.cw233-tables-head p{margin:7px 0 0;color:rgba(184,199,243,.66);font-size:13px}
.cw233-table-selectors-viewport{width:100%;max-width:100%;overflow:hidden;margin:0 0 18px;padding:0 0 4px}.cw233-table-selectors{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;width:100%;min-width:0}.cw233-table-selector{min-width:0;min-height:42px;border:1px solid rgba(109,137,224,.18);border-radius:14px;padding:0 5px;background:linear-gradient(145deg,rgba(17,39,82,.86),rgba(9,24,55,.94));color:rgba(216,225,250,.72);font:800 11px/1 inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw233-table-selector.is-active{background:linear-gradient(135deg,var(--r11a,var(--cw-primary,#315CFF)),color-mix(in srgb,var(--r11a,var(--cw-primary,#315CFF)) 78%,var(--cw-primary-2,#1937DF)));color:#fff;border-color:color-mix(in srgb,var(--r11a,var(--cw-primary,#315CFF)) 58%,white 10%);box-shadow:0 8px 22px color-mix(in srgb,var(--r11a,var(--cw-primary,#315CFF)) 22%,transparent),inset 0 1px 0 rgba(255,255,255,.08)}.cw233-tables-content{min-width:0;max-width:100%;min-height:360px}
.cw233-standing-viewport{width:100%;max-width:100%;overflow-x:hidden;overflow-y:hidden;border:0;border-radius:0;background:transparent}.cw233-standing-table{width:100%;min-width:0;table-layout:fixed;border-collapse:separate;border-spacing:0 7px;font-size:12px}.cw233-standing-table th{height:38px;padding:5px 5px;color:rgba(157,178,231,.68);font-size:9px;letter-spacing:.08em;text-transform:uppercase;text-align:center;border:0}.cw233-standing-table th:nth-child(1){width:42px}.cw233-standing-table th:nth-child(2){width:auto;text-align:left}.cw233-standing-table th:nth-child(3){width:40px}.cw233-standing-table th:nth-child(4){width:50px}.cw233-standing-table th:nth-child(5){width:42px}.cw233-standing-table td{position:relative;height:62px;padding:8px 5px;text-align:center;border-top:1px solid rgba(105,132,214,.16);border-bottom:1px solid rgba(105,132,214,.16);background:linear-gradient(145deg,rgba(15,35,74,.96),rgba(7,22,50,.98));font-variant-numeric:tabular-nums;transition:border-color .18s ease,background .18s ease,box-shadow .18s ease}.cw233-standing-table td:first-child{border-left:1px solid rgba(105,132,214,.16);border-radius:17px 0 0 17px}.cw233-standing-table td:last-child{border-right:1px solid rgba(105,132,214,.16);border-radius:0 17px 17px 0}.cw233-standing-position{font-weight:900;color:#9eb8ff}.cw233-standing-position>span{display:grid;place-items:center;width:28px;height:28px;margin:auto;border:1px solid rgba(109,140,235,.16);border-radius:10px;background:rgba(49,92,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}.cw233-standing-team{text-align:left!important;display:flex;align-items:center;gap:11px;min-width:0}.cw233-standing-team strong{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:850;white-space:nowrap}.cw233-table-logo{width:36px;height:36px;min-width:36px;min-height:36px;object-fit:contain;flex:0 0 36px}.cw233-table-logo--empty{display:grid;place-items:center;border-radius:12px;background:rgba(49,92,255,.13);border:1px solid rgba(117,144,232,.18)}.cw233-table-logo-fallback{color:#b9c9f5;font-size:9px;font-weight:900}.cw233-standing-goal-difference{font-weight:800;color:rgba(230,237,255,.9)}.cw233-standing-points{font-weight:950;font-size:14px;color:#fff}
#${OVERLAY_ID} .cw233-standing-table th,#${OVERLAY_ID} .cw233-standing-table td{display:table-cell!important}
.cw233-zone td{box-shadow:inset 0 0 0 1px rgba(255,255,255,.018)}.cw233-zone--ucl td{border-color:rgba(77,118,255,.30);background:linear-gradient(90deg,rgba(52,88,225,.16),rgba(10,29,66,.98) 42%,rgba(7,22,50,.98));box-shadow:inset 0 0 0 1px rgba(75,113,255,.035)}.cw233-zone--uel td{border-color:rgba(255,151,65,.28);background:linear-gradient(90deg,rgba(223,118,40,.15),rgba(10,29,66,.98) 42%,rgba(7,22,50,.98));box-shadow:inset 0 0 0 1px rgba(255,155,72,.03)}.cw233-zone--uecl td{border-color:rgba(52,199,127,.28);background:linear-gradient(90deg,rgba(34,171,103,.14),rgba(10,29,66,.98) 42%,rgba(7,22,50,.98));box-shadow:inset 0 0 0 1px rgba(65,213,145,.03)}.cw233-zone--relegation td{border-color:rgba(255,82,104,.26);background:linear-gradient(90deg,rgba(202,53,76,.14),rgba(10,29,66,.98) 42%,rgba(7,22,50,.98));box-shadow:inset 0 0 0 1px rgba(255,82,104,.03)}.cw233-zone .cw233-standing-position>span{position:relative;color:#fff}.cw233-zone .cw233-standing-position>span:after{content:"";position:absolute;left:6px;right:6px;bottom:3px;height:2px;border-radius:99px;box-shadow:0 0 9px currentColor}.cw233-zone--ucl .cw233-standing-position>span{background:linear-gradient(145deg,rgba(50,88,229,.52),rgba(30,57,151,.35));border-color:rgba(94,128,255,.42);color:#7596ff}.cw233-zone--uel .cw233-standing-position>span{background:linear-gradient(145deg,rgba(232,122,43,.48),rgba(138,68,18,.34));border-color:rgba(255,164,91,.40);color:#ff9c4a}.cw233-zone--uecl .cw233-standing-position>span{background:linear-gradient(145deg,rgba(41,182,113,.44),rgba(15,113,67,.34));border-color:rgba(82,214,151,.38);color:#48c78e}.cw233-zone--relegation .cw233-standing-position>span{background:linear-gradient(145deg,rgba(218,61,83,.43),rgba(136,29,48,.34));border-color:rgba(255,97,119,.36);color:#ff5468}
.cw233-standing-legend{margin-top:14px;padding:14px 15px;border:1px solid rgba(101,128,255,.14);border-radius:17px;background:linear-gradient(145deg,rgba(15,35,76,.78),rgba(7,20,48,.88));box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}.cw233-standing-legend__items{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 12px}.cw233-standing-legend__items span{display:flex;align-items:center;gap:7px;color:rgba(222,230,252,.80);font-size:10px;line-height:1.25}.cw233-standing-legend__items b{color:#fff;font-size:10px}.cw233-legend-dot{width:9px;height:9px;min-width:9px;border-radius:4px;box-shadow:0 0 10px currentColor}.cw233-legend-dot--ucl{background:#4f7cff;color:#4f7cff}.cw233-legend-dot--uel{background:#ff9c4a;color:#ff9c4a}.cw233-legend-dot--uecl{background:#48c78e;color:#48c78e}.cw233-legend-dot--relegation{background:#ff5468;color:#ff5468}.cw233-standing-legend p{margin:11px 0 0;padding-top:10px;border-top:1px solid rgba(116,143,228,.10);color:rgba(181,198,239,.56);font-size:9px;line-height:1.45}
.cw232-bracket-viewport{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;padding:2px 0 12px}.cw232-bracket{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(220px,260px);gap:16px;min-width:max-content;align-items:start}.cw232-bracket-round{min-width:0}.cw232-bracket-round__title{margin:0 0 9px;font-size:12px;font-weight:850;letter-spacing:.04em;color:rgba(255,255,255,.74)}.cw232-bracket-round__matches{display:grid;gap:12px}.cw232-bracket-match{border:1px solid color-mix(in srgb,var(--r11a,#315CFF) 26%,rgba(255,255,255,.08));border-radius:17px;background:linear-gradient(145deg,color-mix(in srgb,var(--r11a,#315CFF) 10%,rgba(14,33,72,.9)),color-mix(in srgb,var(--r11b,#1937DF) 6%,rgba(7,20,48,.94)));padding:12px}.cw232-bracket-team{min-height:34px;display:flex;align-items:center;padding:7px 9px;border-radius:10px;background:rgba(255,255,255,.045);font-size:11px;font-weight:750;line-height:1.2}.cw232-bracket-team+.cw232-bracket-team{margin-top:5px}.cw232-bracket-meta{margin-top:8px;font-size:9px;color:rgba(198,210,244,.58);text-align:center}
.cw233-tables-empty,.cw233-tables-error{padding:28px 18px;border:1px solid rgba(104,132,220,.13);border-radius:18px;background:linear-gradient(145deg,rgba(15,35,75,.72),rgba(7,20,47,.82));color:rgba(210,222,250,.66);text-align:center}.cw233-tables-error button{display:block;width:100%;margin-top:14px;border:1px solid rgba(96,127,255,.34);border-radius:14px;padding:13px;background:linear-gradient(135deg,var(--cw-primary,#315CFF),var(--cw-primary-2,#1937DF));color:#fff;font:800 12px/1 inherit}.cw233-table-loading{display:grid;gap:9px}.cw233-table-loading span{display:block;height:62px;border-radius:16px;background:linear-gradient(90deg,rgba(50,72,128,.16),rgba(79,102,170,.28),rgba(50,72,128,.16));background-size:220% 100%;animation:cw233tablepulse 1.2s linear infinite}@keyframes cw233tablepulse{to{background-position:-220% 0}}
@media(max-width:390px){#${OVERLAY_ID}{padding-left:10px;padding-right:10px}.cw233-tables-head h2{font-size:27px}.cw233-table-selectors{gap:4px}.cw233-table-selector{padding:0 3px;font-size:10px}.cw233-standing-legend__items{grid-template-columns:1fr}.cw233-standing-table th:nth-child(1){width:40px}.cw233-standing-table th:nth-child(3){width:36px}.cw233-standing-table th:nth-child(4){width:48px}.cw233-standing-table th:nth-child(5){width:40px}.cw233-standing-table td{padding-left:4px;padding-right:4px}.cw233-standing-team{gap:8px}.cw233-table-logo{width:34px;height:34px;min-width:34px;min-height:34px;flex-basis:34px}.cw233-standing-team strong{font-size:11px}.cw233-standing-position>span{width:26px;height:26px}}
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
  const current = overlay.querySelector?.('.cw233-tables-hub');
  const next = holder.querySelector?.('.cw233-tables-hub');
  if (!next) {
    if (!current) {
      overlay.innerHTML = html;
      return true;
    }
    return false;
  }
  if (!current) {
    overlay.innerHTML = html;
    return true;
  }
  const overlayTop = Number(overlay.scrollTop) || 0;
  const selectorLeft = Number(current.querySelector?.('.cw233-table-selectors-viewport')?.scrollLeft) || 0;
  const standingLeft = Number(current.querySelector?.('.cw233-standing-viewport')?.scrollLeft) || 0;
  current.dataset.cw233TablesSelected = next.dataset?.cw233TablesSelected || 'serie_a';
  current.dataset.cw233Theme = next.dataset?.cw233Theme || tablesThemeForCompetition(current.dataset.cw233TablesSelected);
  current.dataset.cw233Round11Theme = next.dataset?.cw233Round11Theme || current.dataset.cw233Theme;
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
