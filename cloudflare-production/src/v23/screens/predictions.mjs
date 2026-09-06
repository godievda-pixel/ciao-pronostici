import { toUiMatch } from '../data/selectors.mjs';
import { pointsLabel } from '../locale/ru.mjs';
import { formatMatchDate } from '../locale/time.mjs';
import { escapeHtml } from '../ui/html.mjs';

const COMPETITION_IDS = Object.freeze(['serie_a','coppa_italia','ucl','uel','uecl']);

export const PREDICTION_MODES = Object.freeze([
  Object.freeze({id:'available', label:'Прогнозы'}),
  Object.freeze({id:'mine', label:'Мои прогнозы'}),
]);

export const PREDICTION_COMPETITIONS = Object.freeze([
  Object.freeze({id:'all', label:'Все'}),
  Object.freeze({id:'serie_a', label:'Серия А'}),
  Object.freeze({id:'coppa_italia', label:'Кубок Италии'}),
  Object.freeze({id:'ucl', label:'Лига чемпионов'}),
  Object.freeze({id:'uel', label:'Лига Европы'}),
  Object.freeze({id:'uecl', label:'Лига конференций'}),
]);

function text(value) {
  return String(value ?? '').trim();
}

function assertMode(value) {
  const mode = text(value) || 'available';
  if (!PREDICTION_MODES.some(item => item.id === mode)) throw new Error('prediction_mode_invalid');
  return mode;
}

function assertCompetition(value, {allowAll = true} = {}) {
  const competition = text(value) || 'all';
  const allowed = allowAll ? PREDICTION_COMPETITIONS.map(item => item.id) : COMPETITION_IDS;
  if (!allowed.includes(competition)) throw new Error('prediction_competition_invalid');
  return competition;
}

function nowMsOf(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value ?? Date.now());
  if (!Number.isFinite(date.getTime())) throw new Error('invalid_now_time');
  return date.getTime();
}

export function validatePredictionScore(value) {
  if (value === '' || value === null || value === undefined) throw new Error('invalid_score');
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0 || score > 20) throw new Error('invalid_score');
  return score;
}

function deadlineLabel(deadlineAt, timeZone) {
  const label = formatMatchDate(deadlineAt, {timeZone});
  const clock = label.split(' · ').at(-1) || label;
  return `до ${clock}`;
}

function availableItem(entry, options) {
  if (!entry?.match) return null;
  return {
    match:toUiMatch(entry.match, options),
    prediction:entry.prediction ?? null,
    deadlineAt:text(entry.deadlineAt),
    deadlineLabel:deadlineLabel(entry.deadlineAt, options.timeZone),
  };
}

function mineItem(entry, options) {
  return {
    prediction:entry?.prediction ?? null,
    match:entry?.match ? toUiMatch(entry.match, options) : null,
  };
}

function sortItems(mode, items) {
  return [...items].sort((left, right) => {
    const leftTime = mode === 'available'
      ? Date.parse(left?.match?.kickoffAt || 0)
      : Date.parse(left?.match?.kickoffAt || left?.prediction?.lockedAt || 0);
    const rightTime = mode === 'available'
      ? Date.parse(right?.match?.kickoffAt || 0)
      : Date.parse(right?.match?.kickoffAt || right?.prediction?.lockedAt || 0);
    return leftTime - rightTime;
  });
}

export async function loadPredictions({
  api,
  mode = 'available',
  competition = 'all',
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
} = {}) {
  if (!api?.call) throw new Error('predictions_api_required');
  const selectedMode = assertMode(mode);
  const selectedCompetition = assertCompetition(competition);
  const nowMs = nowMsOf(now);
  const nowDate = new Date(nowMs);
  const action = selectedMode === 'available' ? 'predictions_available' : 'predictions_mine';
  const competitions = selectedCompetition === 'all' ? COMPETITION_IDS : [selectedCompetition];
  const raw = [];

  for (const competitionId of competitions) {
    const payload = selectedMode === 'available'
      ? {competition:competitionId, now_ms:nowMs}
      : {competition:competitionId};
    const data = await api.call(action, payload);
    if (Array.isArray(data)) raw.push(...data);
  }

  const options = {now:nowDate, timeZone};
  const items = raw
    .map(entry => selectedMode === 'available' ? availableItem(entry, options) : mineItem(entry, options))
    .filter(Boolean);

  return {
    mode:selectedMode,
    competition:selectedCompetition,
    items:sortItems(selectedMode, items),
    feedback:null,
  };
}

function scoreInputValue(value) {
  if (value === null || value === undefined || value === '') return '';
  const score = Number(value);
  return Number.isInteger(score) ? String(score) : '';
}

function renderModes(active) {
  return `<div class="prediction-mode" role="tablist">${PREDICTION_MODES.map(item => `<button type="button" class="prediction-mode__item${item.id === active ? ' is-active' : ''}" data-action="prediction-mode" data-mode="${item.id}" role="tab" aria-selected="${item.id === active ? 'true' : 'false'}">${escapeHtml(item.label)}</button>`).join('')}</div>`;
}

function renderFilters(active) {
  return `<div class="prediction-filters" aria-label="Турнир">${PREDICTION_COMPETITIONS.map(item => `<button type="button" class="prediction-filters__item${item.id === active ? ' is-active' : ''}" data-action="prediction-filter" data-competition="${item.id}" aria-pressed="${item.id === active ? 'true' : 'false'}">${escapeHtml(item.label)}</button>`).join('')}</div>`;
}

function renderAvailableCard(item) {
  const match = item.match;
  const prediction = item.prediction ?? {};
  const home = scoreInputValue(prediction.predictedHome);
  const away = scoreInputValue(prediction.predictedAway);
  return `<article class="prediction-card" data-prediction-card="${escapeHtml(match.id)}"><div class="prediction-card__meta"><span>${escapeHtml(match.competitionNameRu)}</span><span>${escapeHtml(match.timeLabel)}</span></div><div class="prediction-card__teams"><span>${escapeHtml(match.homeTeam.nameRu)}</span><span class="prediction-card__dash">—</span><span>${escapeHtml(match.awayTeam.nameRu)}</span></div><div class="prediction-card__entry"><input class="prediction-card__score" type="number" inputmode="numeric" min="0" max="20" step="1" data-score="home" aria-label="Голы хозяев" value="${escapeHtml(home)}"><span aria-hidden="true">—</span><input class="prediction-card__score" type="number" inputmode="numeric" min="0" max="20" step="1" data-score="away" aria-label="Голы гостей" value="${escapeHtml(away)}"></div><div class="prediction-card__footer"><span class="prediction-card__deadline">${escapeHtml(item.deadlineLabel)}</span><button type="button" class="prediction-card__save" data-action="save-prediction" data-competition="${escapeHtml(match.competition)}" data-match-id="${escapeHtml(match.id)}">Сохранить</button></div></article>`;
}

function predictionScore(prediction) {
  if (!prediction) return '—';
  const home = Number(prediction.predictedHome);
  const away = Number(prediction.predictedAway);
  if (!Number.isInteger(home) || !Number.isInteger(away)) return '—';
  return `${home} — ${away}`;
}

function finalScore(match) {
  const home = match?.score?.home;
  const away = match?.score?.away;
  if (home === null || home === undefined || away === null || away === undefined) return '';
  return `${home} — ${away}`;
}

function renderMineCard(item) {
  const prediction = item.prediction ?? {};
  const match = item.match;
  const points = prediction.points === null || prediction.points === undefined ? '' : pointsLabel(Number(prediction.points));
  if (!match) {
    return `<article class="prediction-card prediction-card--mine"><div class="prediction-card__meta"><span>Матч больше недоступен в текущем списке</span></div><div class="prediction-card__result"><span>Ваш прогноз</span><strong>${escapeHtml(predictionScore(prediction))}</strong></div>${points ? `<div class="prediction-card__points">${escapeHtml(points)}</div>` : ''}</article>`;
  }
  const result = finalScore(match);
  return `<article class="prediction-card prediction-card--mine" data-match-id="${escapeHtml(match.id)}"><div class="prediction-card__meta"><span>${escapeHtml(match.competitionNameRu)}</span><span>${escapeHtml(match.timeLabel)}</span></div><div class="prediction-card__teams"><span>${escapeHtml(match.homeTeam.nameRu)}</span><span class="prediction-card__dash">—</span><span>${escapeHtml(match.awayTeam.nameRu)}</span></div><div class="prediction-card__result"><span>Ваш прогноз</span><strong>${escapeHtml(predictionScore(prediction))}</strong></div>${result ? `<div class="prediction-card__result"><span>Итоговый счёт</span><strong>${escapeHtml(result)}</strong></div>` : ''}<div class="prediction-card__summary"><span>${escapeHtml(match.statusRu)}</span>${points ? `<strong>${escapeHtml(points)}</strong>` : ''}</div></article>`;
}

function feedbackHtml(feedback) {
  if (!feedback?.message) return '';
  return `<div class="inline-notice${feedback.ok === false ? ' inline-notice--error' : ''}" role="status">${escapeHtml(feedback.message)}</div>`;
}

export function renderPredictions(model = {}) {
  const mode = assertMode(model.mode ?? 'available');
  const competition = assertCompetition(model.competition ?? 'all');
  const items = Array.isArray(model.items) ? model.items : [];
  const empty = mode === 'available' ? 'Доступных матчей для прогноза пока нет' : 'Сохранённых прогнозов пока нет';
  const cards = items.length
    ? `<div class="screen-grid">${items.map(item => mode === 'available' ? renderAvailableCard(item) : renderMineCard(item)).join('')}</div>`
    : `<div class="status-state" data-state="empty">${escapeHtml(empty)}</div>`;
  return `<section class="screen-stack" data-screen="predictions">${renderModes(mode)}${renderFilters(competition)}${feedbackHtml(model.feedback)}${cards}</section>`;
}

export async function savePrediction({api, competition, matchId, homeScore, awayScore, now = new Date()} = {}) {
  if (!api?.call) throw new Error('predictions_api_required');
  const competitionId = assertCompetition(competition, {allowAll:false});
  const canonicalMatchId = text(matchId);
  if (!canonicalMatchId) throw new Error('match_id_required');
  const home = validatePredictionScore(homeScore);
  const away = validatePredictionScore(awayScore);
  const nowMs = nowMsOf(now);
  try {
    const prediction = await api.call('prediction_save', {
      competition:competitionId,
      match_id:canonicalMatchId,
      home,
      away,
      now_ms:nowMs,
    });
    return {ok:true, message:'Прогноз сохранён', prediction};
  } catch (error) {
    const code = text(error?.code) || 'prediction_save_failed';
    const message = code === 'prediction_closed' ? 'Прогноз уже закрыт' : (text(error?.message) || 'Не удалось сохранить прогноз');
    return {ok:false, code, message};
  }
}
