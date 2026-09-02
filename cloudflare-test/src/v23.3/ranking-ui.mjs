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
  return (Array.isArray(rows) ? rows : []).map((row, index) => Object.freeze({ position:index + 1, ...row }));
}

let client = null;
let active = 'overall';
let rows = [];
let me = null;
let pageActive = false;

function text(value) { return String(value ?? '').trim(); }
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[c]));
}
function initData() { return text(globalThis.Telegram?.WebApp?.initData); }
function contentNode() { return document.querySelector('#ciao-miniapp-root .content'); }

function heroHtml() {
  const name = text(me?.display_name) || 'Ciao, Web!';
  const username = text(me?.username);
  const rank = Number(me?.position);
  const points = Number(me?.points) || 0;
  return `<div class="hero"><div class="hero-top"><div><h2>${esc(name)}</h2><p>${username ? `@${esc(username)}` : 'Рейтинг прогнозистов'}</p></div><div><div class="rank">${rank > 0 ? `#${rank}` : '—'}</div><p>${points} очк.</p></div></div></div>`;
}

function filtersHtml() {
  return `<div class="cw231-filters" role="tablist" aria-label="Рейтинг по турнирам">${RANKING_FILTERS.map(filter => (
    `<button type="button" data-cw233-rank-filter="${filter.key}" aria-selected="${filter.key === active}">${filter.label}</button>`
  )).join('')}</div>`;
}

function rankingHtml() {
  const positioned = withRankingPositions(rows);
  if (!positioned.length) return '<div class="empty">Рейтинг пока пуст</div>';
  return `<div class="section-title"><h3>${active === 'overall' ? 'Общий рейтинг' : RANKING_FILTERS.find(item => item.key === active)?.label || 'Рейтинг'}</h3><span>${positioned.length} игроков</span></div><div class="card">${positioned.map(row => (
    `<div class="list-row ${me?.user_id === row.user_id ? 'me' : ''}">
      <div class="pos">${row.position === 1 ? '🥇' : row.position === 2 ? '🥈' : row.position === 3 ? '🥉' : row.position}</div>
      <div class="person">${esc(row.display_name || 'Участник')}</div>
      <div class="pts">${Number(row.points) || 0}</div>
    </div>`
  )).join('')}</div>`;
}

function render() {
  if (!pageActive) return;
  const main = contentNode();
  if (!main) return;
  main.innerHTML = `${heroHtml()}${filtersHtml()}${rankingHtml()}`;
}

function loading() {
  const main = contentNode();
  if (main) main.innerHTML = '<div class="empty">Загружаем рейтинг…</div>';
}

async function load() {
  pageActive = true;
  loading();
  try {
    client = client || createPredictionClient({ initData:initData() });
    const [ranking, current] = await Promise.all([
      active === 'overall'
        ? client.rankings({ scope:'overall' })
        : client.rankings({ scope:'competition', competition:active }),
      client.rankingMe(),
    ]);
    if (!pageActive) return;
    rows = Array.isArray(ranking) ? ranking : [];
    me = current && typeof current === 'object' ? current : null;
    render();
  } catch (error) {
    const main = contentNode();
    if (pageActive && main) main.innerHTML = `<div class="empty">${esc(error?.code || 'Не удалось загрузить рейтинг')}</div>`;
  }
}

function close() { pageActive = false; }

export function installRankingUi() {
  if (typeof document === 'undefined') return null;
  document.addEventListener('click', event => {
    const nav = event.target?.closest?.('.nav button[data-tab]');
    if (nav?.dataset?.tab === 'table') {
      void load();
      return;
    }
    if (nav) {
      close();
      return;
    }
    if (!pageActive) return;
    const filter = event.target?.closest?.('[data-cw233-rank-filter]');
    if (filter) {
      active = filter.dataset.cw233RankFilter || 'overall';
      void load();
    }
  });
  return Object.freeze({ open:load, close });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installRankingUi(), { once:true });
  else installRankingUi();
}
