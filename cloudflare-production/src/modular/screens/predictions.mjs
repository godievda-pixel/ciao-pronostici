import { getTournament } from '../core/tournament-registry.mjs';

export const DEFAULT_PREDICTION_MODE = 'predictions';
const MODES = new Set(['predictions','mine']);

function text(value) { return String(value ?? '').trim(); }
function esc(value) { return text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function scoreValue(value) {
  if (value === null || value === undefined || text(value) === '') return '';
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 20 ? String(n) : '';
}
function competitionMeta(id) {
  try { return getTournament(id); }
  catch { return { id:text(id), label:text(id) || 'Турнир', shortLabel:text(id) || 'Турнир', theme:'default' }; }
}
function userTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome'; }
  catch { return 'Europe/Rome'; }
}
function dateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone:userTimeZone(), day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', hour12:false,
  }).format(date);
}
function matchNames(item = {}) {
  const match = item.match || {};
  const home = text(match?.home?.name || item.home_name || item.homeName);
  const away = text(match?.away?.name || item.away_name || item.awayName);
  const title = text(item.title || item.label || match.title);
  if (home || away) return { home:home || 'Хозяева', away:away || 'Гости', title:title || `${home || 'Хозяева'} — ${away || 'Гости'}` };
  const split = title.split(/\s+[—–-]\s+/);
  return { home:split[0] || 'Хозяева', away:split[1] || 'Гости', title:title || 'Матч' };
}
function rulesHtml(rules = {}) {
  const exact = Number(rules.exact_score);
  const diff = Number(rules.correct_goal_difference);
  const outcome = Number(rules.correct_outcome);
  const miss = Number(rules.miss);
  if (![exact,diff,outcome,miss].every(Number.isFinite)) return '';
  return `<div class="ciao-predictions-rules">${exact} / ${diff} / ${outcome} / ${miss}</div>`;
}
function availableCard(item = {}, index) {
  const names = matchNames(item);
  const competition = text(item.competition || item?.match?.competition);
  const tournament = competitionMeta(competition);
  const matchId = text(item.match_id || item.id || item?.match?.id);
  const round = text(item.round || item?.match?.round);
  const prediction = item.prediction || {};
  const deadline = dateTime(item.deadline_at || item.deadlineAt);
  const kickoff = dateTime(item.kickoff_at || item.kickoffAt || item?.match?.kickoffAt);
  return `<article class="ciao-predictions-card ciao-predictions-card--${esc(tournament.theme)}" data-prediction-card data-prediction-item="${index}" data-prediction-competition="${esc(competition)}" data-prediction-match-id="${esc(matchId)}"${round ? ` data-prediction-round="${esc(round)}"` : ''}>
    <div class="ciao-predictions-card-meta"><span>${esc(tournament.label)}</span>${kickoff ? `<time>${esc(kickoff)}</time>` : ''}</div>
    <div class="ciao-predictions-match-title">${esc(names.home)} <span>—</span> ${esc(names.away)}</div>
    <div class="ciao-predictions-score-editor">
      <label><span>${esc(names.home)}</span><input type="number" inputmode="numeric" min="0" max="20" step="1" data-prediction-home value="${scoreValue(prediction.home_score)}" aria-label="Счёт ${esc(names.home)}"></label>
      <span class="ciao-predictions-score-separator">:</span>
      <label><span>${esc(names.away)}</span><input type="number" inputmode="numeric" min="0" max="20" step="1" data-prediction-away value="${scoreValue(prediction.away_score)}" aria-label="Счёт ${esc(names.away)}"></label>
    </div>
    ${deadline ? `<div class="ciao-predictions-deadline">Дедлайн: ${esc(deadline)}</div>` : ''}
    <div class="ciao-predictions-feedback" data-prediction-feedback aria-live="polite"></div>
    <button type="button" class="ciao-predictions-save" data-prediction-save>Сохранить</button>
  </article>`;
}
function mineCard(item = {}, index) {
  const names = matchNames(item);
  const competition = text(item.competition || item?.match?.competition);
  const tournament = competitionMeta(competition);
  const home = scoreValue(item.home_score ?? item.prediction?.home_score);
  const away = scoreValue(item.away_score ?? item.prediction?.away_score);
  const hasPoints = item.points !== null && item.points !== undefined && text(item.points) !== '';
  const points = hasPoints ? Number(item.points) : NaN;
  return `<article class="ciao-predictions-card ciao-predictions-card--mine ciao-predictions-card--${esc(tournament.theme)}" data-prediction-card data-prediction-item="${index}" data-prediction-competition="${esc(competition)}">
    <div class="ciao-predictions-card-meta"><span>${esc(tournament.label)}</span></div>
    <div class="ciao-predictions-match-title">${esc(names.title)}</div>
    <div class="ciao-predictions-saved-score">${home || '—'} : ${away || '—'}</div>
    ${Number.isFinite(points) ? `<div class="ciao-predictions-points">${points >= 0 ? '+' : ''}${points}</div>` : ''}
  </article>`;
}
function contentHtml(data, mode) {
  if (typeof data?.html === 'string') return data.html;
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  if (!items.length) return `<div class="ciao-predictions-empty">${mode === 'mine' ? 'У вас пока нет сохранённых прогнозов' : 'Сейчас нет матчей для прогноза'}</div>`;
  const cards = items.map((item, index) => mode === 'mine' ? mineCard(item, index) : availableCard(item, index)).join('');
  return `<div class="ciao-predictions-list">${cards}${mode === 'predictions' ? rulesHtml(data?.rules) : ''}</div>`;
}

export function renderPredictionsScreen({ mode = DEFAULT_PREDICTION_MODE, data = null, loading = false, error = null } = {}) {
  const active = MODES.has(mode) ? mode : DEFAULT_PREDICTION_MODE;
  return `<section class="ciao-predictions-screen">
    <div class="ciao-predictions-head"><span>Твои футбольные прогнозы</span><h2>Прогнозы</h2></div>
    <div class="ciao-predictions-switch" role="tablist">
      <button type="button" data-prediction-mode="predictions" class="ciao-predictions-mode${active === 'predictions' ? ' is-active' : ''}">Прогнозы</button>
      <button type="button" data-prediction-mode="mine" class="ciao-predictions-mode${active === 'mine' ? ' is-active' : ''}">Мои прогнозы</button>
    </div>
    <div class="ciao-predictions-content">${loading ? '<div class="ciao-predictions-loading">Загружаем прогнозы…</div>' : error ? `<div class="ciao-predictions-error">${esc(error.message || error)}</div>` : contentHtml(data, active)}</div>
  </section>`;
}

export function createPredictionsController({ bridge, render } = {}) {
  if (!bridge?.load || !bridge?.save) throw new Error('prediction_bridge_required');
  if (typeof render !== 'function') throw new Error('prediction_render_required');
  const state = { mode:DEFAULT_PREDICTION_MODE, data:null, loading:false, error:null };

  function snapshot() { return Object.freeze({ ...state }); }
  function emit() { const value = snapshot(); render(renderPredictionsScreen(value), value); return value; }

  async function load(mode) {
    if (!MODES.has(mode)) throw new Error(`invalid_prediction_mode:${mode}`);
    state.mode = mode;
    state.loading = true;
    state.error = null;
    emit();
    try { state.data = await bridge.load(mode); }
    catch (error) { state.error = error instanceof Error ? error : new Error(String(error)); }
    finally { state.loading = false; emit(); }
    return snapshot();
  }

  return Object.freeze({
    start() { return load(DEFAULT_PREDICTION_MODE); },
    selectMode(mode) { return load(mode); },
    save(payload) { return bridge.save(payload); },
    state: snapshot,
  });
}
