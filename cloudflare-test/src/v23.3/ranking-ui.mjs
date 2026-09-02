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
function telegramUser() { return globalThis.Telegram?.WebApp?.initDataUnsafe?.user || null; }
function contentNode() { return document.querySelector('#ciao-miniapp-root .content'); }

export function resolveRankingDisplayName(current, tgUser) {
  const serverName = text(current?.display_name || current?.name);
  if (serverName) return serverName;
  const telegramName = [text(tgUser?.first_name), text(tgUser?.last_name)].filter(Boolean).join(' ');
  if (telegramName) return telegramName;
  const username = text(current?.username || tgUser?.username).replace(/^@/, '');
  return username ? `@${username}` : 'Участник';
}

function initials(value) {
  const clean = text(value).replace(/^@/, '');
  const parts = clean.split(/\s+/).filter(Boolean).slice(0, 2);
  return (parts.map(part => part[0] || '').join('').toUpperCase() || 'У').slice(0, 2);
}

function usernameLine(current, tgUser) {
  const username = text(current?.username || tgUser?.username).replace(/^@/, '');
  return username ? `@${username}` : 'Рейтинг прогнозистов';
}

function heroHtml() {
  const tgUser = telegramUser();
  const name = resolveRankingDisplayName(me, tgUser);
  const subtitle = usernameLine(me, tgUser);
  const rank = Number(me?.position);
  const points = Number(me?.points) || 0;
  return `<div class="hero cw233-ranking-hero">
    <div class="cw233-ranking-identity">
      <div class="cw233-ranking-avatar cw233-ranking-avatar--hero">${esc(initials(name))}</div>
      <div class="cw233-ranking-identity-copy">
        <span class="cw233-ranking-kicker">УЧАСТНИК</span>
        <h2>${esc(name)}</h2>
        <p>${esc(subtitle)}</p>
      </div>
    </div>
    <div class="cw233-ranking-hero-stats">
      <div class="cw233-ranking-stat"><strong>${rank > 0 ? `#${rank}` : '—'}</strong><span>место</span></div>
      <div class="cw233-ranking-stat"><strong>${points}</strong><span>очков</span></div>
    </div>
  </div>`;
}

function filtersHtml() {
  return `<div class="cw233-ranking-filters-wrap"><div class="cw231-filters cw233-ranking-filters" role="tablist" aria-label="Рейтинг по турнирам">${RANKING_FILTERS.map(filter => (
    `<button type="button" data-cw233-rank-filter="${filter.key}" aria-selected="${filter.key === active}">${filter.label}</button>`
  )).join('')}</div></div>`;
}

function podiumClass(position) {
  return position >= 1 && position <= 3 ? ` is-podium is-podium-${position}` : '';
}

function rankingHtml() {
  const positioned = withRankingPositions(rows);
  if (!positioned.length) {
    return '<div class="empty"><div class="cw233-ranking-empty"><strong>Рейтинг формируется</strong><span>Участники появятся здесь автоматически</span></div></div>';
  }
  const title = active === 'overall'
    ? 'Общий рейтинг'
    : RANKING_FILTERS.find(item => item.key === active)?.label || 'Рейтинг';
  return `<div class="cw233-ranking-section">
    <div class="section-title cw233-ranking-section-head"><h3>${esc(title)}</h3><span>${positioned.length} игроков</span></div>
    <div class="card"><div class="cw233-ranking-list">${positioned.map(row => {
      const isMe = me?.user_id === row.user_id;
      const name = text(row.display_name) || 'Участник';
      const username = text(row.username).replace(/^@/, '');
      const positionLabel = row.position === 1 ? '1' : row.position === 2 ? '2' : row.position === 3 ? '3' : row.position;
      return `<div class="list-row cw233-ranking-row${isMe ? ' is-me' : ''}">
        <div class="cw233-ranking-position${podiumClass(row.position)}"><div class="pos">${positionLabel}</div></div>
        <div class="cw233-ranking-avatar">${esc(initials(name))}</div>
        <div class="cw233-ranking-person"><div class="person">${esc(name)}</div>${username ? `<span class="cw233-ranking-username">@${esc(username)}</span>` : ''}</div>
        <div class="cw233-ranking-points"><div class="pts">${Number(row.points) || 0}</div><span>очк.</span></div>
      </div>`;
    }).join('')}</div></div>
  </div>`;
}

function pageHtml(body) {
  return `<div class="cw233-ranking-page">${heroHtml()}${filtersHtml()}${body}</div>`;
}

function render() {
  if (!pageActive) return;
  const main = contentNode();
  if (!main) return;
  main.innerHTML = pageHtml(rankingHtml());
}

function loading() {
  const main = contentNode();
  if (!main) return;
  main.innerHTML = pageHtml(`<div class="cw233-ranking-skeleton" aria-hidden="true">
    <div class="cw233-ranking-skeleton-row"></div>
    <div class="cw233-ranking-skeleton-row"></div>
    <div class="cw233-ranking-skeleton-row"></div>
  </div>`);
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
    if (pageActive && main) {
      main.innerHTML = pageHtml(`<div class="empty"><div class="cw233-ranking-empty"><strong>Не удалось загрузить рейтинг</strong><span>${esc(error?.code || 'Попробуйте ещё раз')}</span></div></div>`);
    }
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
