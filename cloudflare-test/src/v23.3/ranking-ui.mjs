import { createPredictionClient } from './prediction-client.mjs';

export const USER_FEEDBACK_ROUND3_BUILD = '2026-09-02-r3';
export const USER_FEEDBACK_ROUND4_BUILD = '2026-09-02-r4';
export const USER_FEEDBACK_ROUND5_BUILD = '2026-09-02-r5';
export const USER_FEEDBACK_ROUND6_BUILD = '2026-09-02-r6';

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

function pluralRu(value, one, few, many) {
  const number = Math.abs(Math.trunc(Number(value) || 0));
  const mod100 = number % 100;
  const mod10 = number % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function rankingParticipantCountLabel(value) {
  const number = Math.max(0, Math.trunc(Number(value) || 0));
  return `${number} ${pluralRu(number, 'участник', 'участника', 'участников')}`;
}

export function rankingPointsLabel(value) {
  const number = Math.trunc(Number(value) || 0);
  return `${number} ${pluralRu(number, 'очко', 'очка', 'очков')}`;
}

function rankingPointsUnit(value) {
  return rankingPointsLabel(value).replace(/^-?\d+\s+/, '');
}

let client = null;
let active = 'overall';
let rows = [];
let me = null;
let pageActive = false;

const RANKING_STYLE_ID = 'cw233-ranking-round5-style';

function text(value) { return String(value ?? '').trim(); }
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[c]));
}
function initData() { return text(globalThis.Telegram?.WebApp?.initData); }
function telegramUser() { return globalThis.Telegram?.WebApp?.initDataUnsafe?.user || null; }
function contentNode() { return document.querySelector('#ciao-miniapp-root .content'); }

function ensureRankingPremiumStyle() {
  if (typeof document === 'undefined' || document.getElementById(RANKING_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = RANKING_STYLE_ID;
  style.textContent = `
    .cw233-ranking-page .cw233-ranking-list{display:grid!important;gap:8px!important;padding:0!important}
    .cw233-ranking-page .cw233-ranking-row{display:grid!important;grid-template-columns:34px 36px minmax(0,1fr) 58px!important;column-gap:10px!important;align-items:center!important;min-height:62px!important;width:100%!important;padding:10px 11px!important;box-sizing:border-box!important}
    .cw233-ranking-page .cw233-ranking-position{display:grid!important;place-items:center!important;width:34px!important;height:34px!important;min-width:34px!important}
    .cw233-ranking-page .cw233-ranking-position-value{display:block!important;width:100%!important;text-align:center!important;font-size:11px!important;font-weight:950!important;line-height:1!important;font-variant-numeric:tabular-nums!important}
    .cw233-ranking-page .cw233-ranking-person{display:grid!important;align-content:center!important;gap:3px!important;min-width:0!important;overflow:hidden!important}
    .cw233-ranking-page .cw233-ranking-name{display:block!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:12px!important;font-weight:900!important;line-height:1.2!important;letter-spacing:-.01em!important;color:#fff!important}
    .cw233-ranking-page .cw233-ranking-username{display:block!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:9px!important;line-height:1.15!important;color:var(--muted)!important}
    .cw233-ranking-page .cw233-ranking-points{display:grid!important;grid-template-rows:auto auto!important;justify-items:end!important;align-content:center!important;gap:2px!important;width:58px!important;min-width:58px!important;line-height:1!important;text-align:right!important}
    .cw233-ranking-page .cw233-ranking-points-value{display:block!important;font-size:17px!important;font-weight:950!important;line-height:1!important;color:#fff!important;font-variant-numeric:tabular-nums!important}
    .cw233-ranking-page .cw233-ranking-points-unit{display:block!important;max-width:58px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:7px!important;font-weight:850!important;line-height:1!important;letter-spacing:.02em!important;text-transform:uppercase!important;color:var(--muted)!important}
    @media(max-width:390px){.cw233-ranking-page .cw233-ranking-row{grid-template-columns:32px 34px minmax(0,1fr) 54px!important;column-gap:8px!important;padding-left:9px!important;padding-right:9px!important}.cw233-ranking-page .cw233-ranking-position{width:32px!important;height:32px!important;min-width:32px!important}.cw233-ranking-page .cw233-ranking-points{width:54px!important;min-width:54px!important}.cw233-ranking-page .cw233-ranking-name{font-size:11px!important}.cw233-ranking-page .cw233-ranking-points-value{font-size:16px!important}}
  `;
  document.head.appendChild(style);
}

export function resolveRankingDisplayName(current, tgUser) {
  const serverName = text(current?.display_name || current?.name);
  if (serverName) return serverName;
  const telegramName = [text(tgUser?.first_name), text(tgUser?.last_name)].filter(Boolean).join(' ');
  if (telegramName) return telegramName;
  const username = text(current?.username || tgUser?.username).replace(/^@/, '');
  return username ? `@${username}` : 'Участник';
}

export function resolveCurrentRankingRow(rankingRows = [], tgUser = {}) {
  const id = text(tgUser?.id);
  if (!id) return null;
  const wanted = `telegram:${id}`;
  const index = (Array.isArray(rankingRows) ? rankingRows : []).findIndex(row => text(row?.user_id) === wanted);
  if (index < 0) return null;
  return Object.freeze({ position:index + 1, ...rankingRows[index] });
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
  return `<div class="hero cw233-ranking-hero"><div class="cw233-ranking-identity"><div class="cw233-ranking-avatar cw233-ranking-avatar--hero">${esc(initials(name))}</div><div class="cw233-ranking-identity-copy"><span class="cw233-ranking-kicker">УЧАСТНИК</span><h2>${esc(name)}</h2><p>${esc(subtitle)}</p></div></div><div class="cw233-ranking-hero-stats"><div class="cw233-ranking-stat"><strong>${rank > 0 ? `#${rank}` : '—'}</strong><span>место</span></div><div class="cw233-ranking-stat"><strong>${points}</strong><span>${esc(rankingPointsUnit(points))}</span></div></div></div>`;
}

function filtersHtml() {
  return `<div class="cw233-ranking-filters-wrap"><div class="cw231-filters cw233-ranking-filters" role="tablist" aria-label="Рейтинг по турнирам">${RANKING_FILTERS.map(filter => `<button type="button" data-cw233-rank-filter="${filter.key}" aria-selected="${filter.key === active}">${filter.label}</button>`).join('')}</div></div>`;
}

function podiumClass(position) { return position >= 1 && position <= 3 ? ` is-podium is-podium-${position}` : ''; }

function rankingHtml() {
  const positioned = withRankingPositions(rows);
  if (!positioned.length) return '<div class="empty"><div class="cw233-ranking-empty"><strong>Рейтинг формируется</strong><span>Участники появятся здесь автоматически</span></div></div>';
  const title = active === 'overall' ? 'Общий рейтинг' : RANKING_FILTERS.find(item => item.key === active)?.label || 'Рейтинг';
  return `<div class="cw233-ranking-section"><div class="section-title cw233-ranking-section-head"><h3>${esc(title)}</h3><span>${esc(rankingParticipantCountLabel(positioned.length))}</span></div><div class="card"><div class="cw233-ranking-list">${positioned.map(row => {
    const isMe = me?.user_id === row.user_id;
    const name = text(row.display_name) || 'Участник';
    const username = text(row.username).replace(/^@/, '');
    const points = Number(row.points) || 0;
    return `<div class="cw233-ranking-row${isMe ? ' is-me' : ''}"><div class="cw233-ranking-position${podiumClass(row.position)}"><span class="cw233-ranking-position-value">${row.position}</span></div><div class="cw233-ranking-avatar">${esc(initials(name))}</div><div class="cw233-ranking-person"><div class="cw233-ranking-name">${esc(name)}</div>${username ? `<span class="cw233-ranking-username">@${esc(username)}</span>` : ''}</div><div class="cw233-ranking-points"><strong class="cw233-ranking-points-value">${points}</strong><span class="cw233-ranking-points-unit">${esc(rankingPointsUnit(points))}</span></div></div>`;
  }).join('')}</div></div></div>`;
}

function pageHtml(body) { return `<div class="cw233-ranking-page">${heroHtml()}${filtersHtml()}${body}</div>`; }
function render() { if (!pageActive) return; const main = contentNode(); if (main) main.innerHTML = pageHtml(rankingHtml()); }
function loading() { const main = contentNode(); if (main) main.innerHTML = pageHtml('<div class="cw233-ranking-skeleton" aria-hidden="true"><div class="cw233-ranking-skeleton-row"></div><div class="cw233-ranking-skeleton-row"></div><div class="cw233-ranking-skeleton-row"></div></div>'); }

async function load() {
  pageActive = true;
  loading();
  try {
    client = client || createPredictionClient({ initData:initData() });
    const ranking = active === 'overall'
      ? await client.rankings({ scope:'overall' })
      : await client.rankings({ scope:'competition', competition:active });
    if (!pageActive) return;
    rows = Array.isArray(ranking) ? ranking : [];
    const current = resolveCurrentRankingRow(rows, telegramUser());
    if (current) me = current;
    render();
  } catch (error) {
    const main = contentNode();
    if (pageActive && main) main.innerHTML = pageHtml(`<div class="empty"><div class="cw233-ranking-empty"><strong>Не удалось загрузить рейтинг</strong><span>${esc(error?.code || 'Попробуйте ещё раз')}</span></div></div>`);
  }
}

function close() { pageActive = false; }

export function installRankingUi() {
  if (typeof document === 'undefined') return null;
  ensureRankingPremiumStyle();
  document.addEventListener('click', event => {
    const nav = event.target?.closest?.('.nav button[data-tab]');
    if (nav?.dataset?.tab === 'table') { void load(); return; }
    if (nav) { close(); return; }
    if (!pageActive) return;
    const filter = event.target?.closest?.('[data-cw233-rank-filter]');
    if (filter) { active = filter.dataset.cw233RankFilter || 'overall'; void load(); }
  });
  return Object.freeze({ open:load, close });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installRankingUi(), { once:true });
  else installRankingUi();
}
