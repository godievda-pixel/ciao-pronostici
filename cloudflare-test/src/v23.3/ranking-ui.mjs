import { createPredictionClient } from './prediction-client.mjs';

export const RANKING_FILTERS = Object.freeze([
  {key:'overall',label:'Общий'},
  {key:'serie_a',label:'Серия А'},
  {key:'coppa_italia',label:'Кубок Италии'},
  {key:'ucl',label:'ЛЧ'},
  {key:'uel',label:'ЛЕ'},
  {key:'uecl',label:'ЛК'},
]);

export function withRankingPositions(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => Object.freeze({
    position:index + 1,
    ...row,
  }));
}

const OVERLAY_ID = 'ciao-v233-ranking-overlay';
const STYLE_ID = 'ciao-v233-ranking-style';
let client = null;
let active = 'overall';
let rows = [];
let me = null;

function text(value) { return String(value ?? '').trim(); }
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[c]));
}
function initData() { return text(globalThis.Telegram?.WebApp?.initData); }

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${OVERLAY_ID}{position:fixed;inset:0 0 calc(78px + env(safe-area-inset-bottom,0px)) 0;z-index:45;overflow:auto;background:#07101f;color:#fff;padding:calc(18px + env(safe-area-inset-top,0px)) 14px 30px;font-family:inherit;-webkit-overflow-scrolling:touch}
#${OVERLAY_ID}[hidden]{display:none!important}#${OVERLAY_ID} *{box-sizing:border-box}.cw233-rank-shell{width:min(100%,760px);margin:auto}.cw233-rank-head span{font-size:10px;font-weight:900;letter-spacing:.15em;opacity:.55}.cw233-rank-head h2{margin:7px 0 0;font-size:30px}.cw233-rank-head p{margin:6px 0 15px;color:#8592b3;font-size:11px}.cw233-rank-filters{display:flex;gap:7px;overflow:auto;padding-bottom:12px}.cw233-rank-filters button{flex:0 0 auto;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.05);color:#aeb8d2;padding:10px 12px;font:800 11px/1 inherit}.cw233-rank-filters .is-active{background:#fff;color:#07101f}.cw233-rank-me{margin-bottom:10px;padding:12px 13px;border-radius:16px;background:linear-gradient(135deg,rgba(49,80,255,.28),rgba(9,27,189,.16));border:1px solid rgba(126,151,255,.2);font-size:11px}.cw233-rank-row{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:54px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.07)}.cw233-rank-row:last-child{border-bottom:0}.cw233-rank-row.is-me{background:rgba(49,80,255,.12)}.cw233-rank-pos{font-weight:900;color:#8390ae;text-align:center}.cw233-rank-name{min-width:0}.cw233-rank-name b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw233-rank-name small{display:block;margin-top:2px;color:#71809f}.cw233-rank-points{font-size:15px;font-weight:900}.cw233-rank-list{border:1px solid rgba(255,255,255,.09);border-radius:18px;overflow:hidden;background:rgba(255,255,255,.035)}.cw233-rank-empty{padding:28px;text-align:center;color:#7e8cab}@media(max-width:390px){.cw233-rank-head h2{font-size:27px}}
`;
  document.head.appendChild(style);
}

function ensureOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.hidden = true;
  (document.getElementById('ciao-miniapp-root') || document.body).appendChild(overlay);
  return overlay;
}

function render() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  const positioned = withRankingPositions(rows);
  overlay.innerHTML = `<section class="cw233-rank-shell">
    <header class="cw233-rank-head"><span>Ciao, Web!</span><h2>Рейтинг</h2><p>${active === 'overall' ? 'Общий рейтинг всех пяти турниров' : 'Рейтинг выбранного турнира'}</p></header>
    <div class="cw233-rank-filters">${RANKING_FILTERS.map(filter => `<button data-cw233-rank-filter="${filter.key}" class="${filter.key === active ? 'is-active' : ''}">${filter.label}</button>`).join('')}</div>
    ${me && active === 'overall' ? `<div class="cw233-rank-me">Твоё место: <b>#${Number(me.position) || '—'}</b> · ${Number(me.points) || 0} очков</div>` : ''}
    <div class="cw233-rank-list">${positioned.length ? positioned.map(row => `<div class="cw233-rank-row ${me?.user_id === row.user_id ? 'is-me' : ''}">
      <div class="cw233-rank-pos">${row.position <= 3 ? ['🥇','🥈','🥉'][row.position - 1] : row.position}</div>
      <div class="cw233-rank-name"><b>${esc(row.display_name || 'Участник')}</b>${row.username ? `<small>@${esc(row.username)}</small>` : ''}</div>
      <div class="cw233-rank-points">${Number(row.points) || 0}</div>
    </div>`).join('') : '<div class="cw233-rank-empty">Рейтинг пока пуст</div>'}</div>
  </section>`;
}

async function load() {
  const overlay = ensureOverlay();
  overlay.hidden = false;
  overlay.innerHTML = '<div class="cw233-rank-empty">Загружаем рейтинг…</div>';
  try {
    client = client || createPredictionClient({ initData:initData() });
    const [ranking, current] = await Promise.all([
      active === 'overall'
        ? client.rankings({ scope:'overall' })
        : client.rankings({ scope:'competition', competition:active }),
      client.rankingMe(),
    ]);
    rows = Array.isArray(ranking) ? ranking : [];
    me = current && typeof current === 'object' ? current : null;
    render();
  } catch (error) {
    overlay.innerHTML = `<div class="cw233-rank-empty">${esc(error?.code || 'Не удалось загрузить рейтинг')}</div>`;
  }
}

function close() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.hidden = true;
}

export function installRankingUi() {
  if (typeof document === 'undefined') return null;
  ensureStyles();
  ensureOverlay();
  document.addEventListener('click', event => {
    const nav = event.target?.closest?.('[data-tab="table"]');
    if (nav) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void load();
      return;
    }
    const other = event.target?.closest?.('.nav button[data-tab]');
    if (other) close();
    const filter = event.target?.closest?.('[data-cw233-rank-filter]');
    if (filter) {
      active = filter.dataset.cw233RankFilter || 'overall';
      void load();
    }
  }, true);
  return Object.freeze({ open:load, close });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installRankingUi(), { once:true });
  } else {
    installRankingUi();
  }
}
