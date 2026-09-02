import { createPredictionClient } from './prediction-client.mjs';

export const PREDICTION_FILTERS = Object.freeze([
  { key:'all', label:'Все' },
  { key:'serie_a', label:'Серия А' },
  { key:'coppa_italia', label:'Кубок Италии' },
  { key:'ucl', label:'ЛЧ' },
  { key:'uel', label:'ЛЕ' },
  { key:'uecl', label:'ЛК' },
  { key:'unfilled', label:'Не заполнено' },
]);

function text(value) { return String(value ?? '').trim(); }
function time(match) {
  const value = Date.parse(match?.kickoffAt || '');
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[c]));
}

export function filterPredictionMatches(matches = [], filter = 'all') {
  const rows = Array.isArray(matches) ? matches : [];
  if (filter === 'all') return [...rows];
  if (filter === 'unfilled') return rows.filter(match => match?.state === 'open' && !match?.prediction);
  return rows.filter(match => match?.competition === filter);
}

export function groupPredictionMatchesByDate(matches = []) {
  const sorted = [...(Array.isArray(matches) ? matches : [])].sort((a, b) => (
    time(a) - time(b) || text(a?.matchId).localeCompare(text(b?.matchId))
  ));
  const groups = new Map();
  for (const match of sorted) {
    const date = new Date(match?.kickoffAt || '');
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  }
  return [...groups].map(([key, rows]) => Object.freeze({ key, matches:Object.freeze(rows) }));
}

export function predictionCardState(match = {}) {
  const prediction = match?.prediction;
  if (match?.state === 'finished') {
    const hasScore = Number.isInteger(Number(match?.homeScore)) && Number.isInteger(Number(match?.awayScore));
    const result = hasScore ? `${Number(match.homeScore)}:${Number(match.awayScore)}` : '—';
    const points = prediction?.points == null ? '' : ` · +${Number(prediction.points)}`;
    return Object.freeze({ kind:'finished', label:`Итог ${result}${points}` });
  }
  if (prediction) {
    return Object.freeze({ kind:'saved', label:`сохранён · ${Number(prediction.predicted_home)}:${Number(prediction.predicted_away)}` });
  }
  if (match?.state === 'locked') return Object.freeze({ kind:'locked', label:'🔒 закрыт' });
  return Object.freeze({ kind:'open', label:'не сохранён' });
}

export function mergeAuthoritativePrediction(matches = [], prediction = {}) {
  return matches.map(match => match?.matchId === prediction?.match_id ? { ...match, prediction } : match);
}

const drafts = new Map();
let matches = [];
let activeFilter = 'all';
let activeMode = 'make';
let client = null;
let me = null;
let pageActive = false;

function initData() { return text(globalThis.Telegram?.WebApp?.initData); }
function contentNode() { return document.querySelector('#ciao-miniapp-root .content'); }

function formatKickoff(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Время уточняется';
  return new Intl.DateTimeFormat('ru-RU', {
    day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit',
  }).format(date).replace(',', ' ·');
}

function formatDay(key) {
  const date = new Date(`${key}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'long', weekday:'short' }).format(date);
}

function team(match, side) { return match?.[`${side}Team`] || match?.[side] || {}; }
function teamName(match, side) { return text(team(match, side)?.name) || '—'; }
function teamLogo(match, side) {
  const item = team(match, side);
  const src = text(item?.crestUrl || item?.logo_url || item?.logoUrl);
  return src
    ? `<img class="logo" src="${esc(src)}" alt="" loading="eager" decoding="sync">`
    : '<span class="logo" aria-hidden="true"></span>';
}

function scoreFor(match) {
  const draft = drafts.get(match.matchId);
  if (draft) return draft;
  const prediction = match.prediction;
  return { h:Number(prediction?.predicted_home ?? 0), a:Number(prediction?.predicted_away ?? 0) };
}

function heroHtml() {
  const name = text(me?.display_name) || 'Ciao, Web!';
  const username = text(me?.username);
  const rank = Number(me?.position);
  return `<div class="hero"><div class="hero-top"><div><h2>${esc(name)}</h2><p>${username ? `@${esc(username)}` : 'Прогнозы на все турниры'}</p></div><div><div class="rank">${rank > 0 ? `#${rank}` : '—'}</div><p>место</p></div></div></div>`;
}

function tabsHtml() {
  return `<div class="cw231-prediction-tabs" role="tablist" aria-label="Прогнозы">
    <button type="button" data-cw233-mode="make" aria-selected="${activeMode === 'make'}">Сделать прогноз</button>
    <button type="button" data-cw233-mode="mine" aria-selected="${activeMode === 'mine'}">Мои прогнозы</button>
  </div>`;
}

function filtersHtml() {
  const allowed = activeMode === 'mine' ? PREDICTION_FILTERS.filter(item => item.key !== 'unfilled') : PREDICTION_FILTERS;
  return `<div class="cw231-filters" role="tablist" aria-label="Турниры">${allowed.map(filter => (
    `<button type="button" data-cw233-filter="${filter.key}" aria-selected="${filter.key === activeFilter}">${filter.label}</button>`
  )).join('')}</div>`;
}

function makeMatchHtml(match) {
  const state = predictionCardState(match);
  const score = scoreFor(match);
  const editable = match.state === 'open';
  const dirty = drafts.has(match.matchId);
  return `<div class="match ${editable ? '' : 'closed'}" data-cw233-pred-card="${esc(match.matchId)}">
    <div class="match-head"><div class="teams">
      <div class="team">${teamLogo(match, 'home')}<span class="team-name">${esc(teamName(match, 'home'))}</span></div>
      <span class="dash">—</span>
      <div class="team away"><span class="team-name">${esc(teamName(match, 'away'))}</span>${teamLogo(match, 'away')}</div>
    </div></div>
    ${editable ? `<div class="score">
      <div class="score-side"><button type="button" data-cw233-delta="h:-1">−</button><div class="score-value" data-cw233-score="h">${score.h}</div><button type="button" data-cw233-delta="h:1">+</button></div>
      <span class="colon">:</span>
      <div class="score-side"><button type="button" data-cw233-delta="a:-1">−</button><div class="score-value" data-cw233-score="a">${score.a}</div><button type="button" data-cw233-delta="a:1">+</button></div>
    </div>` : ''}
    <div class="meta"><span>${esc(formatKickoff(match.kickoffAt))}</span><span data-cw233-state class="${dirty ? '' : state.kind === 'saved' ? 'saved' : state.kind === 'finished' ? 'result' : ''}">${dirty ? 'не сохранён' : esc(state.label)}</span></div>
  </div>`;
}

function mineMatchHtml(match) {
  const prediction = match?.prediction;
  const points = prediction?.points == null ? '' : ` · +${Number(prediction.points)}`;
  const finalScore = match?.state === 'finished' && Number.isInteger(Number(match?.homeScore)) && Number.isInteger(Number(match?.awayScore))
    ? `ИТОГ · ${Number(match.homeScore)}:${Number(match.awayScore)}` : '';
  return `<div class="mine-match" data-cw233-pred-card="${esc(match.matchId)}">
    <div class="mine-main"><div class="mine-pair">
      <div class="mine-team">${teamLogo(match, 'home')}<span>${esc(teamName(match, 'home'))}</span></div>
      <span class="mine-dash">—</span>
      <div class="mine-team away"><span>${esc(teamName(match, 'away'))}</span>${teamLogo(match, 'away')}</div>
    </div><div class="mine-meta"><span>${esc(formatKickoff(match.kickoffAt))}</span><span class="mine-live">${esc(finalScore)}</span></div></div>
    <div class="mine-prediction ${prediction?.points != null ? 'has-points' : ''}">${prediction ? `${Number(prediction.predicted_home)}:${Number(prediction.predicted_away)}${points}` : '—'}</div>
  </div>`;
}

function makeBody(rows) {
  const groups = groupPredictionMatchesByDate(rows);
  if (!groups.length) return '<div class="empty">Нет матчей для этого фильтра</div>';
  return groups.map(group => `<div class="section-title"><h3>${esc(formatDay(group.key))}</h3><span>${group.matches.length} матч.</span></div><div class="matches">${group.matches.map(makeMatchHtml).join('')}</div>`).join('');
}

function mineBody(rows) {
  if (!rows.length) return '<div class="empty">Сохранённых прогнозов пока нет</div>';
  return `<div class="section-title"><h3>Мои прогнозы</h3><span>${rows.length}</span></div><div class="card mine-card">${rows.map(mineMatchHtml).join('')}</div>`;
}

function render() {
  if (!pageActive) return;
  const main = contentNode();
  if (!main) return;
  const modeRows = activeMode === 'mine' ? matches.filter(match => Boolean(match?.prediction)) : matches;
  const selected = filterPredictionMatches(modeRows, activeFilter);
  main.innerHTML = `${heroHtml()}${tabsHtml()}${filtersHtml()}${activeMode === 'mine' ? mineBody(selected) : makeBody(selected)}${activeMode === 'make' ? '<div class="savebar"><button type="button" class="save" data-cw233-save-all>Сохранить прогнозы</button></div>' : ''}`;
}

function loading() {
  const main = contentNode();
  if (main) main.innerHTML = '<div class="empty">Загружаем прогнозы…</div>';
}

async function open() {
  pageActive = true;
  loading();
  try {
    client = client || createPredictionClient({ initData:initData() });
    const [data, current] = await Promise.all([client.available('all'), client.rankingMe().catch(() => null)]);
    if (!pageActive) return;
    matches = Array.isArray(data?.matches) ? data.matches : [];
    me = current && typeof current === 'object' ? current : null;
    render();
  } catch (error) {
    const main = contentNode();
    if (pageActive && main) main.innerHTML = `<div class="empty">${esc(error?.code || 'Не удалось загрузить прогнозы')}</div>`;
  }
}

function close() { pageActive = false; }

async function saveDrafts() {
  if (!drafts.size) {
    globalThis.Telegram?.WebApp?.showAlert?.('Измени хотя бы один прогноз');
    return;
  }
  const grouped = new Map();
  for (const [matchId, score] of drafts) {
    const match = matches.find(item => item.matchId === matchId);
    if (!match || match.state !== 'open') continue;
    if (!grouped.has(match.competition)) grouped.set(match.competition, []);
    grouped.get(match.competition).push({ match_id:matchId, home_score:score.h, away_score:score.a });
  }
  try {
    for (const [competition, predictions] of grouped) {
      const saved = await client.save({ competition_key:competition, predictions });
      for (const row of Array.isArray(saved) ? saved : []) {
        matches = mergeAuthoritativePrediction(matches, row);
        drafts.delete(row.match_id);
      }
    }
    render();
  } catch (error) {
    if (error?.code === 'prediction_locked') {
      try {
        const data = await client.available('all');
        matches = Array.isArray(data?.matches) ? data.matches : matches;
      } catch {}
      render();
    }
    globalThis.Telegram?.WebApp?.showAlert?.(error?.code === 'prediction_locked' ? 'Дедлайн этого прогноза уже наступил' : 'Не удалось сохранить прогноз');
  }
}

export function installPredictionsUi() {
  if (typeof document === 'undefined') return null;
  document.addEventListener('click', event => {
    const nav = event.target?.closest?.('.nav button[data-tab]');
    if (nav?.dataset?.tab === 'mine') {
      void open();
      return;
    }
    if (nav) {
      close();
      return;
    }

    if (!pageActive) return;
    const mode = event.target?.closest?.('[data-cw233-mode]');
    if (mode) {
      activeMode = mode.dataset.cw233Mode === 'mine' ? 'mine' : 'make';
      if (activeMode === 'mine' && activeFilter === 'unfilled') activeFilter = 'all';
      render();
      return;
    }
    const filter = event.target?.closest?.('[data-cw233-filter]');
    if (filter) {
      activeFilter = filter.dataset.cw233Filter || 'all';
      render();
      return;
    }
    const delta = event.target?.closest?.('[data-cw233-delta]');
    if (delta) {
      const card = delta.closest('[data-cw233-pred-card]');
      const id = card?.dataset?.cw233PredCard;
      const match = matches.find(item => item.matchId === id);
      if (!match) return;
      const [side, raw] = String(delta.dataset.cw233Delta || '').split(':');
      const next = { ...scoreFor(match) };
      next[side] = Math.max(0, Math.min(20, next[side] + Number(raw)));
      drafts.set(id, next);
      render();
      return;
    }
    if (event.target?.closest?.('[data-cw233-save-all]')) void saveDrafts();
  });
  return Object.freeze({ open, close });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installPredictionsUi(), { once:true });
  else installPredictionsUi();
}
