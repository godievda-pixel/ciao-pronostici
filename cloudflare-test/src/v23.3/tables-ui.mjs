import { getCompetitionConfig } from '../v23.2/competition-config.mjs';
import { buildCoppaBracket } from '../v23.2/coppa-bracket.mjs';
import { loadCompetitionMatches } from '../v23.2/data-client.mjs';
import { formatKickoff, seasonDateRange } from '../v23.2/matches-ui.mjs';
import { loadCompetitionStandings } from './data-client.mjs';

const OVERLAY_ID = 'ciao-v233-tables-overlay';
const STYLE_ID = 'ciao-v233-tables-style';
const TABLE_COMPETITIONS = Object.freeze(['serie_a', 'ucl', 'uel', 'uecl', 'coppa_italia']);

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

function teamLogo(team) {
  const url = String(team?.crestUrl || '').trim();
  return url
    ? `<img class="cw233-table-logo" src="${esc(url)}" alt="" loading="lazy" decoding="async">`
    : '<span class="cw233-table-logo cw233-table-logo--empty" aria-hidden="true"></span>';
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

function renderStandingRows(rows = []) {
  if (!rows.length) {
    return '<div class="cw233-tables-empty">Таблица пока недоступна</div>';
  }

  return `<div class="cw233-standing-viewport">
    <table class="cw233-standing-table">
      <thead><tr><th>#</th><th>Команда</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>РМ</th><th>О</th></tr></thead>
      <tbody>${rows.map(row => `<tr data-cw233-standing-team="${esc(row?.team?.id || row?.team?.name || '')}">
        <td class="cw233-standing-position">${esc(displayStat(row?.position))}</td>
        <td class="cw233-standing-team">${teamLogo(row?.team)}<strong>${esc(row?.team?.name || row?.team?.rawName || '—')}</strong></td>
        <td data-cw233-stat="played">${esc(displayStat(row?.played))}</td>
        <td data-cw233-stat="wins">${esc(displayStat(row?.wins))}</td>
        <td data-cw233-stat="draws">${esc(displayStat(row?.draws))}</td>
        <td data-cw233-stat="losses">${esc(displayStat(row?.losses))}</td>
        <td data-cw233-stat="goal-difference">${esc(displayStat(row?.goalDifference))}</td>
        <td class="cw233-standing-points" data-cw233-stat="points">${esc(displayStat(row?.points))}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
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
    return '<div class="cw233-table-loading" aria-label="Загрузка таблицы"><span></span><span></span><span></span></div>';
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
  return renderStandingRows(Array.isArray(data?.rows) ? data.rows : []);
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

export function createTablesUiController({
  show,
  hide,
  loadCompetition = loadTablesCompetition,
} = {}) {
  if (typeof show !== 'function' || typeof hide !== 'function') {
    throw new Error('Tables UI controller requires show and hide');
  }

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

  async function openCompetition(competition) {
    if (!TABLE_COMPETITIONS.includes(competition)) {
      throw new Error(`Unsupported tables competition: ${competition}`);
    }
    const version = ++requestVersion;
    activeCompetition = competition;
    show(renderTablesHub({ selectedCompetition: competition, loading: true }));
    try {
      const html = await loadCompetition(competition);
      if (version !== requestVersion || activeCompetition !== competition) return 'stale';
      show(html);
      return 'loaded';
    } catch {
      if (version !== requestVersion || activeCompetition !== competition) return 'stale';
      show(renderTablesHub({ selectedCompetition: competition, error: true }));
      return 'error';
    }
  }

  return Object.freeze({ openHub, openCompetition, close });
}

const TABLES_CSS = `
#${OVERLAY_ID}{position:fixed;inset:0 0 calc(78px + env(safe-area-inset-bottom,0px)) 0;z-index:43;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;background:#07101f;color:#fff;padding:calc(18px + env(safe-area-inset-top,0px)) 16px 28px;font-family:inherit;-webkit-overflow-scrolling:touch}
#${OVERLAY_ID}[hidden]{display:none!important}#${OVERLAY_ID} *{box-sizing:border-box}.cw233-tables-hub{width:min(100%,840px);max-width:100%;margin:0 auto}.cw233-tables-head{padding:8px 2px 16px}.cw233-tables-head>span{display:block;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.58;margin-bottom:7px}.cw233-tables-head h2{margin:0;font-size:30px;line-height:1.05;letter-spacing:-.04em}.cw233-tables-head p{margin:7px 0 0;color:rgba(255,255,255,.6);font-size:13px}
.cw233-table-selectors-viewport{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;margin:0 0 18px;padding:0 0 4px}.cw233-table-selectors{display:flex;gap:8px;min-width:max-content}.cw233-table-selector{min-height:42px;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:0 14px;background:rgba(255,255,255,.055);color:rgba(255,255,255,.7);font:800 12px/1 inherit;white-space:nowrap}.cw233-table-selector.is-active{background:#fff;color:#07101f;border-color:#fff}.cw233-tables-content{min-width:0;max-width:100%}
.cw233-standing-viewport{width:100%;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(255,255,255,.045)}.cw233-standing-table{width:100%;min-width:650px;border-collapse:collapse;font-size:12px}.cw233-standing-table th{padding:11px 9px;color:rgba(255,255,255,.48);font-size:9px;letter-spacing:.08em;text-transform:uppercase;text-align:center;border-bottom:1px solid rgba(255,255,255,.1)}.cw233-standing-table th:nth-child(2){text-align:left}.cw233-standing-table td{height:52px;padding:8px 9px;text-align:center;border-bottom:1px solid rgba(255,255,255,.07);font-variant-numeric:tabular-nums}.cw233-standing-table tbody tr:last-child td{border-bottom:0}.cw233-standing-position{font-weight:850;color:rgba(255,255,255,.65)}.cw233-standing-team{text-align:left!important;display:flex;align-items:center;gap:9px;min-width:190px}.cw233-standing-team strong{font-size:12px;white-space:nowrap}.cw233-table-logo{width:30px;height:30px;object-fit:contain;flex:0 0 30px}.cw233-table-logo--empty{border-radius:50%;background:rgba(255,255,255,.07)}.cw233-standing-points{font-weight:900;font-size:13px}
.cw232-bracket-viewport{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;padding:2px 0 12px}.cw232-bracket{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(220px,260px);gap:16px;min-width:max-content;align-items:start}.cw232-bracket-round{min-width:0}.cw232-bracket-round__title{margin:0 0 9px;font-size:12px;font-weight:850;letter-spacing:.04em;color:rgba(255,255,255,.72)}.cw232-bracket-round__matches{display:grid;gap:12px}.cw232-bracket-match{border:1px solid rgba(255,255,255,.11);border-radius:17px;background:linear-gradient(135deg,rgba(22,59,42,.22),rgba(73,22,28,.2)),rgba(255,255,255,.05);padding:12px}.cw232-bracket-team{min-height:34px;display:flex;align-items:center;padding:7px 9px;border-radius:10px;background:rgba(255,255,255,.055);font-size:11px;font-weight:750;line-height:1.2}.cw232-bracket-team+.cw232-bracket-team{margin-top:5px}.cw232-bracket-meta{margin-top:8px;font-size:9px;color:rgba(255,255,255,.52);text-align:center}
.cw233-tables-empty,.cw233-tables-error{padding:28px 18px;border:1px solid rgba(255,255,255,.09);border-radius:18px;color:rgba(255,255,255,.62);text-align:center}.cw233-tables-error button{display:block;width:100%;margin-top:14px;border:0;border-radius:14px;padding:13px;background:#fff;color:#07101f;font:800 12px/1 inherit}.cw233-table-loading{display:grid;gap:9px}.cw233-table-loading span{display:block;height:58px;border-radius:16px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.1),rgba(255,255,255,.04));background-size:220% 100%;animation:cw233tablepulse 1.2s linear infinite}@keyframes cw233tablepulse{to{background-position:-220% 0}}
@media(max-width:390px){#${OVERLAY_ID}{padding-left:12px;padding-right:12px}.cw233-tables-head h2{font-size:27px}.cw233-table-selector{padding:0 12px;font-size:11px}}
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
  const controller = createTablesUiController({
    show(html) {
      overlay.innerHTML = html;
      overlay.hidden = false;
      if (typeof overlay.scrollTo === 'function') overlay.scrollTo(0, 0);
    },
    hide() {
      overlay.hidden = true;
      overlay.innerHTML = '';
    },
    loadCompetition,
  });

  const handleNav = nav => {
    defer(() => {
      if (nav?.dataset?.tab === 'seriea') {
        controller.openHub();
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
      void controller.openCompetition(competition);
    }
  }, true);

  return controller;
}

export { TABLE_COMPETITIONS };

if (typeof document !== 'undefined') {
  installTablesUi(document);
}
