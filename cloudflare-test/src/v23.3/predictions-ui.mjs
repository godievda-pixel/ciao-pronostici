import { createPredictionClient } from './prediction-client.mjs';

export const PREDICTION_FILTERS = Object.freeze([
  { key:'all', label:'Все доступные' },
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
    return Object.freeze({ kind:'finished', label:`Итог: ${result}${points}` });
  }
  if (prediction) {
    return Object.freeze({ kind:'saved', label:`Твой прогноз: ${Number(prediction.predicted_home)}:${Number(prediction.predicted_away)} ✓` });
  }
  if (match?.state === 'locked') return Object.freeze({ kind:'locked', label:'Прогноз закрыт' });
  return Object.freeze({ kind:'open', label:'Прогноз открыт' });
}

export function mergeAuthoritativePrediction(matches = [], prediction = {}) {
  return matches.map(match => match?.matchId === prediction?.match_id ? { ...match, prediction } : match);
}

const OVERLAY_ID = 'ciao-v233-predictions-overlay';
const STYLE_ID = 'ciao-v233-predictions-style';
const drafts = new Map();
let matches = [];
let activeFilter = 'all';
let activeMode = 'make';
let client = null;

function initData() { return text(globalThis.Telegram?.WebApp?.initData); }

function formatKickoff(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Время уточняется';
  return new Intl.DateTimeFormat('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }).format(date).replace(',', ' ·');
}

function teamName(match, side) {
  return text(match?.[`${side}Team`]?.name || match?.[side]?.name) || '—';
}

function scoreFor(match) {
  const draft = drafts.get(match.matchId);
  if (draft) return draft;
  const prediction = match.prediction;
  return { h:Number(prediction?.predicted_home ?? 0), a:Number(prediction?.predicted_away ?? 0) };
}

function matchHtml(match) {
  const state = predictionCardState(match);
  const score = scoreFor(match);
  const editable = match.state === 'open';
  return `<article class="cw233-pred-card" data-cw233-pred-card="${esc(match.matchId)}">
    <div class="cw233-pred-meta"><span>${esc(match.competition)}</span><time>${esc(formatKickoff(match.kickoffAt))}</time></div>
    <div class="cw233-pred-teams"><b>${esc(teamName(match, 'home'))}</b><span>—</span><b>${esc(teamName(match, 'away'))}</b></div>
    ${editable ? `<div class="cw233-pred-score">
      <div class="cw233-pred-score-side"><button data-cw233-delta="h:-1">−</button><strong data-cw233-score="h">${score.h}</strong><button data-cw233-delta="h:1">+</button></div>
      <span class="cw233-pred-colon">:</span>
      <div class="cw233-pred-score-side"><button data-cw233-delta="a:-1">−</button><strong data-cw233-score="a">${score.a}</strong><button data-cw233-delta="a:1">+</button></div>
    </div>` : ''}
    <div class="cw233-pred-state ${state.kind}" data-cw233-state>${esc(state.label)}</div>
    ${editable ? '<button class="cw233-pred-save" data-cw233-save>Сохранить прогноз</button>' : ''}
    <div class="cw233-pred-error" data-cw233-error></div>
  </article>`;
}

function render() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  const modeRows = activeMode === 'mine' ? matches.filter(match => Boolean(match?.prediction)) : matches;
  const selected = filterPredictionMatches(modeRows, activeFilter);
  const groups = groupPredictionMatchesByDate(selected);
  overlay.innerHTML = `<section class="cw233-pred-shell">
    <header><span>Ciao, Web!</span><h2>Прогнозы</h2><p>Прогноз закрывается за 15 минут до начала матча</p></header>
    <div class="cw233-pred-modes"><button data-cw233-mode="make" class="${activeMode === 'make' ? 'is-active' : ''}">Сделать прогноз</button><button data-cw233-mode="mine" class="${activeMode === 'mine' ? 'is-active' : ''}">Мои прогнозы</button></div>
    <div class="cw233-pred-filters">${PREDICTION_FILTERS.map(filter => `<button data-cw233-filter="${filter.key}" class="${filter.key === activeFilter ? 'is-active' : ''}">${filter.label}</button>`).join('')}</div>
    <div class="cw233-pred-content">${groups.length ? groups.map(group => `<section class="cw233-pred-day"><h3>${new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'long' }).format(new Date(`${group.key}T12:00:00Z`))}</h3>${group.matches.map(matchHtml).join('')}</section>`).join('') : `<div class="cw233-pred-empty">${activeMode === 'mine' ? 'Сохранённых прогнозов пока нет' : 'Нет матчей для этого фильтра'}</div>`}</div>
  </section>`;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${OVERLAY_ID}{position:fixed;inset:0 0 calc(78px + env(safe-area-inset-bottom,0px)) 0;z-index:44;overflow:auto;background:#07101f;color:#fff;padding:calc(18px + env(safe-area-inset-top,0px)) 14px 30px;font-family:inherit;-webkit-overflow-scrolling:touch}
#${OVERLAY_ID}[hidden]{display:none!important}#${OVERLAY_ID} *{box-sizing:border-box}.cw233-pred-shell{width:min(100%,760px);margin:auto}.cw233-pred-shell header span{font-size:10px;font-weight:900;letter-spacing:.15em;opacity:.55}.cw233-pred-shell h2{margin:7px 0 0;font-size:30px}.cw233-pred-shell header p{margin:6px 0 15px;color:#8592b3;font-size:11px}.cw233-pred-modes{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;padding:4px;border-radius:15px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}.cw233-pred-modes button{min-height:40px;border:0;border-radius:11px;background:transparent;color:#8e9bb9;font:850 11px/1 inherit}.cw233-pred-modes .is-active{background:linear-gradient(180deg,rgba(49,80,255,.42),rgba(9,27,189,.34));color:#fff}.cw233-pred-filters{display:flex;gap:7px;overflow:auto;padding-bottom:10px}.cw233-pred-filters button{flex:0 0 auto;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.05);color:#aeb8d2;padding:10px 12px;font:800 11px/1 inherit}.cw233-pred-filters .is-active{background:#fff;color:#07101f}.cw233-pred-day h3{margin:15px 2px 8px;font-size:12px;color:#91a0c1}.cw233-pred-card{margin:0 0 9px;padding:13px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(255,255,255,.04)}.cw233-pred-meta{display:flex;justify-content:space-between;color:#7483a5;font-size:9px}.cw233-pred-teams{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin:12px 0;align-items:center}.cw233-pred-teams b:last-child{text-align:right}.cw233-pred-score{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}.cw233-pred-score-side{display:grid;grid-template-columns:38px 1fr 38px;gap:6px;align-items:center}.cw233-pred-score button,.cw233-pred-save{border:0;border-radius:11px;background:rgba(49,80,255,.25);color:#fff;min-height:38px;font-weight:900}.cw233-pred-score strong{text-align:center;font-size:20px}.cw233-pred-colon{font-size:18px;color:#8292bd}.cw233-pred-state{margin-top:11px;color:#8796b8;font-size:10px;font-weight:800}.cw233-pred-state.saved{color:#72ddb0}.cw233-pred-state.finished{color:#f0d487}.cw233-pred-save{width:100%;margin-top:10px;background:linear-gradient(180deg,#3150ff,#091BBD)}.cw233-pred-error{min-height:0;margin-top:7px;color:#ff8799;font-size:9px}.cw233-pred-empty{padding:28px;text-align:center;color:#7e8cab}@media(max-width:390px){.cw233-pred-score-side{grid-template-columns:34px 1fr 34px}.cw233-pred-shell h2{font-size:27px}}
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

function hideSiblingOverlays() {
  for (const id of ['ciao-v233-ranking-overlay', 'ciao-v233-tables-overlay']) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.hidden = true;
  }
}

async function open() {
  hideSiblingOverlays();
  ensureStyles();
  const overlay = ensureOverlay();
  overlay.hidden = false;
  overlay.innerHTML = '<div class="cw233-pred-empty">Загружаем прогнозы…</div>';
  try {
    client = client || createPredictionClient({ initData:initData() });
    const data = await client.available('all');
    matches = Array.isArray(data?.matches) ? data.matches : [];
    render();
  } catch (error) {
    overlay.innerHTML = `<div class="cw233-pred-empty">${esc(error?.code || 'Не удалось загрузить прогнозы')}</div>`;
  }
}

function close() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.hidden = true;
}

async function saveCard(card, match) {
  const score = scoreFor(match);
  const errorEl = card.querySelector('[data-cw233-error]');
  try {
    const rows = await client.save({ competition_key:match.competition, predictions:[{ match_id:match.matchId, home_score:score.h, away_score:score.a }] });
    const row = Array.isArray(rows) ? rows.find(item => item.match_id === match.matchId) : null;
    if (row) {
      matches = mergeAuthoritativePrediction(matches, row);
      drafts.delete(match.matchId);
      render();
    }
  } catch (error) {
    if (errorEl) errorEl.textContent = error?.code === 'prediction_locked' ? 'Прогноз уже закрыт' : String(error?.code || 'Ошибка сохранения');
    if (error?.code === 'prediction_locked') {
      try {
        const data = await client.available('all');
        matches = Array.isArray(data?.matches) ? data.matches : matches;
        render();
      } catch {}
    }
  }
}

export function installPredictionsUi() {
  if (typeof document === 'undefined') return null;
  ensureStyles();
  ensureOverlay();
  document.addEventListener('click', event => {
    const nav = event.target?.closest?.('[data-tab="mine"]');
    if (nav) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void open();
      return;
    }
    const other = event.target?.closest?.('.nav button[data-tab]');
    if (other) close();

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
      const [side, raw] = delta.dataset.cw233Delta.split(':');
      const next = { ...scoreFor(match) };
      next[side] = Math.max(0, Math.min(20, next[side] + Number(raw)));
      drafts.set(id, next);
      card.querySelector(`[data-cw233-score="${side}"]`).textContent = String(next[side]);
      card.querySelector('[data-cw233-state]').textContent = 'Не сохранено';
      return;
    }

    const save = event.target?.closest?.('[data-cw233-save]');
    if (save) {
      const card = save.closest('[data-cw233-pred-card]');
      const match = matches.find(item => item.matchId === card?.dataset?.cw233PredCard);
      if (match) void saveCard(card, match);
    }
  }, true);
  return Object.freeze({ open, close });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installPredictionsUi(), { once:true });
  else installPredictionsUi();
}
