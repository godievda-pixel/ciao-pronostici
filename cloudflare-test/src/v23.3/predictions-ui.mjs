import { createPredictionClient } from './prediction-client.mjs';

export const USER_FEEDBACK_ROUND4_BUILD = '2026-09-02-r4';
export const USER_FEEDBACK_ROUND6_BUILD = '2026-09-02-r6';
export const USER_FEEDBACK_ROUND7_BUILD = '2026-09-03-r7';
export const USER_FEEDBACK_ROUND11_BUILD = '2026-09-03-r11';
export const USER_FEEDBACK_ROUND12_BUILD = '2026-09-03-r12';

export const PREDICTION_FILTERS = Object.freeze([
  { key:'all', label:'Все' },
  { key:'serie_a', label:'Серия А' },
  { key:'coppa_italia', label:'Кубок Италии' },
  { key:'ucl', label:'ЛЧ' },
  { key:'uel', label:'ЛЕ' },
  { key:'uecl', label:'ЛК' },
]);

const PREDICTION_COMPETITIONS = Object.freeze(PREDICTION_FILTERS.map(item => item.key).filter(key => key !== 'all'));
const UEFA_COMPETITIONS = new Set(['ucl','uel','uecl']);
const COPPA_STAGE_ORDER = Object.freeze([
  'Preliminary','Preliminary Round','Round of 64','Round of 32','Round of 16',
  'Quarter-finals','Quarter Finals','Quarterfinals','Semi-finals','Semi Finals','Semifinals','Final',
]);
const COPPA_STAGE_LABELS = Object.freeze({
  Preliminary:'Предварительный раунд', 'Preliminary Round':'Предварительный раунд',
  'Round of 64':'1/32 финала', 'Round of 32':'1/16 финала', 'Round of 16':'1/8 финала',
  'Quarter-finals':'1/4 финала', 'Quarter Finals':'1/4 финала', Quarterfinals:'1/4 финала',
  'Semi-finals':'1/2 финала', 'Semi Finals':'1/2 финала', Semifinals:'1/2 финала', Final:'Финал',
});
const MATCH_CACHE_TTL = 45_000;
const PREFETCH_RETRY_DELAYS = Object.freeze([0, 120, 300, 650, 1200, 2200, 4000]);

function text(value) { return String(value ?? '').trim(); }
function time(match) {
  const value = Date.parse(match?.kickoffAt || '');
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function sortMatches(rows = []) {
  return [...rows].sort((a, b) => time(a) - time(b) || text(a?.matchId).localeCompare(text(b?.matchId)));
}
function numericRound(match) {
  const direct = Number(match?.round);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const source = text(match?.stage);
  const parsed = source.match(/(?:round|matchday|тур)\s*[-–—:]?\s*(\d+)/i) || source.match(/\b(\d+)\b/);
  const value = Number(parsed?.[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
function stageLabel(value) { const raw = text(value) || 'Стадия'; return COPPA_STAGE_LABELS[raw] || raw; }
function stageOrder(value) { const index = COPPA_STAGE_ORDER.indexOf(text(value)); return index < 0 ? Number.MAX_SAFE_INTEGER : index; }
function themeFor(value) {
  return ({ all:'serie-a', serie_a:'serie-a', coppa_italia:'coppa', ucl:'champions', uel:'europa', uecl:'conference' })[text(value)] || 'serie-a';
}

export async function loadPredictionCompetitionsProgressively({ competitions = PREDICTION_COMPETITIONS, load, onUpdate = () => {} } = {}) {
  if (typeof load !== 'function') throw new Error('prediction competition loader required');
  const keys = [...new Set((Array.isArray(competitions) ? competitions : []).map(text).filter(Boolean))];
  const byMatch = new Map();
  const errors = {};
  let participant = null;
  let pending = keys.length;
  const snapshot = () => Object.freeze({
    matches:Object.freeze(sortMatches([...byMatch.values()])), errors:Object.freeze({ ...errors }),
    participant:participant ? Object.freeze({ ...participant }) : null, pending,
  });
  await Promise.all(keys.map(async competition => {
    try {
      const data = await load(competition);
      if (!participant && data?.participant && typeof data.participant === 'object') participant = data.participant;
      for (const match of Array.isArray(data?.matches) ? data.matches : []) {
        const id = text(match?.matchId); if (id) byMatch.set(id, match);
      }
    } catch (error) {
      errors[competition] = text(error?.code || error?.message) || 'prediction_load_failed';
    } finally {
      pending -= 1; onUpdate(snapshot());
    }
  }));
  return snapshot();
}

export function predictionRowsForMode(matches = [], mode = 'make') {
  const rows = Array.isArray(matches) ? matches : [];
  if (mode === 'mine') return sortMatches(rows.filter(match => Boolean(match?.prediction)));
  return sortMatches(rows.filter(match => match?.state === 'open' || match?.state === 'round_locked' || match?.state === 'hydrating'));
}
export function filterPredictionMatches(matches = [], filter = 'all') {
  const rows = Array.isArray(matches) ? matches : [];
  return filter === 'all' ? [...rows] : rows.filter(match => match?.competition === filter);
}
export function groupPredictionMatchesByDate(matches = []) {
  const groups = new Map();
  for (const match of sortMatches(Array.isArray(matches) ? matches : [])) {
    const date = new Date(match?.kickoffAt || '');
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  }
  return [...groups].map(([key, rows]) => Object.freeze({ key, matches:Object.freeze(rows) }));
}

export function predictionNavigationGroups(matches = [], competition = '') {
  const rows = sortMatches(Array.isArray(matches) ? matches : []);
  const key = text(competition);
  if (!UEFA_COMPETITIONS.has(key) && key !== 'coppa_italia') return Object.freeze([]);
  const groups = new Map();
  for (const match of rows) {
    let groupKey; let label; let order;
    if (UEFA_COMPETITIONS.has(key)) {
      const round = numericRound(match);
      if (round) { groupKey = `round:${round}`; label = `Тур ${round}`; order = round; }
      else { const stage = text(match?.stage) || 'Этап'; groupKey = `stage:${stage}`; label = stage; order = Number.MAX_SAFE_INTEGER; }
    } else {
      const stage = text(match?.stage) || 'Стадия'; groupKey = `stage:${stage}`; label = stageLabel(stage); order = stageOrder(stage);
    }
    if (!groups.has(groupKey)) groups.set(groupKey, { key:groupKey, label, order, matches:[] });
    groups.get(groupKey).matches.push(match);
  }
  return Object.freeze([...groups.values()]
    .sort((a,b) => a.order - b.order || time(a.matches[0]) - time(b.matches[0]) || a.key.localeCompare(b.key))
    .map(group => Object.freeze({
      key:group.key, label:group.label, matches:Object.freeze(sortMatches(group.matches)),
      locked:group.matches.length > 0 && group.matches.every(match => match?.state === 'round_locked'),
      writable:group.matches.some(match => match?.state === 'open'),
    })));
}

export function defaultPredictionNavigationKey(groups = [], now = new Date()) {
  const rows = Array.isArray(groups) ? groups : [];
  if (!rows.length) return '';
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const future = rows
    .map(group => ({ group, first:Math.min(...group.matches.map(time)) }))
    .filter(item => Number.isFinite(item.first) && item.first >= nowMs)
    .sort((a,b) => a.first - b.first);
  const writableFuture = future.find(item => item.group?.writable);
  if (writableFuture) return writableFuture.group.key;
  if (future[0]) return future[0].group.key;
  const writable = rows.find(group => group?.writable);
  return writable?.key || rows[rows.length - 1].key;
}

export function predictionCardState(match = {}) {
  const prediction = match?.prediction;
  if (match?.state === 'hydrating') return Object.freeze({ kind:'hydrating', label:'Проверяем доступность прогноза…' });
  if (match?.state === 'finished') {
    const hasScore = Number.isInteger(Number(match?.homeScore)) && Number.isInteger(Number(match?.awayScore));
    const result = hasScore ? `${Number(match.homeScore)}:${Number(match.awayScore)}` : '—';
    const points = prediction?.points == null ? '' : ` · +${Number(prediction.points)}`;
    return Object.freeze({ kind:'finished', label:`Итог: ${result}${points}` });
  }
  if (match?.state === 'round_locked') return Object.freeze({ kind:'round_locked', label:'Откроется после расчёта предыдущего тура' });
  if (prediction) return Object.freeze({ kind:'saved', label:`Твой прогноз: ${Number(prediction.predicted_home)}:${Number(prediction.predicted_away)} ✓` });
  if (match?.state === 'locked') return Object.freeze({ kind:'locked', label:'Прогноз закрыт' });
  return Object.freeze({ kind:'open', label:'Прогноз открыт' });
}
export function mergeAuthoritativePrediction(matches = [], prediction = {}) {
  return matches.map(match => match?.matchId === prediction?.match_id ? { ...match, prediction } : match);
}

const drafts = new Map();
const activeNavigation = new Map();
let matches = [];
let activeFilter = 'all';
let activeMode = 'make';
let currentParticipant = null;
let client = null;
let pageActive = false;
let loadingMatches = false;
let loadingFailed = false;
let loadGeneration = 0;
let loadedAt = 0;
let warmGeneration = 0;

function initData() { return text(globalThis.Telegram?.WebApp?.initData); }
function telegramUser() { return globalThis.Telegram?.WebApp?.initDataUnsafe?.user || null; }
function contentNode() { return document.querySelector('#ciao-miniapp-root .content'); }
export function resolvePredictionDisplayName(current, tgUser) {
  const serverName = text(current?.display_name || current?.displayName || current?.name);
  if (serverName) return serverName;
  const telegramName = [text(tgUser?.first_name), text(tgUser?.last_name)].filter(Boolean).join(' ');
  if (telegramName) return telegramName;
  const username = text(current?.username || tgUser?.username).replace(/^@/, '');
  return username ? `@${username}` : '';
}
function formatKickoff(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Время уточняется';
  return new Intl.DateTimeFormat('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }).format(date).replace(',', ' ·');
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
  const src = text(item?.crestUrl || item?.logo_url || item?.logoUrl || item?.logo || item?.crest_url || item?.team_logo || item?.team_logo_url);
  return src ? `<img class="logo" src="${esc(src)}" alt="" loading="eager" decoding="async" width="30" height="30">` : '<span class="logo" aria-hidden="true"></span>';
}
function scoreFor(match) {
  const draft = drafts.get(match.matchId);
  if (draft) return draft;
  const prediction = match.prediction;
  return { h:Number(prediction?.predicted_home ?? 0), a:Number(prediction?.predicted_away ?? 0) };
}
function heroHtml() {
  const tgUser = telegramUser();
  const name = resolvePredictionDisplayName(currentParticipant, tgUser);
  const username = text(currentParticipant?.username || tgUser?.username).replace(/^@/, '');
  const title = name
    ? `<h2>${esc(name)}</h2>`
    : '<h2 class="cw233-prediction-identity-loading" aria-label="Загрузка профиля"><span aria-hidden="true">&nbsp;</span></h2>';
  return `<div class="hero"><div class="hero-top"><div>${title}<p>${username ? `@${esc(username)}` : 'Прогнозы на все турниры'}</p></div></div></div>`;
}
function tabsHtml() {
  return `<div class="cw231-prediction-tabs" role="tablist" aria-label="Прогнозы"><button type="button" data-cw233-mode="make" aria-selected="${activeMode === 'make'}">Сделать прогноз</button><button type="button" data-cw233-mode="mine" aria-selected="${activeMode === 'mine'}">Мои прогнозы</button></div>`;
}
function filtersHtml() {
  return `<div class="cw231-filters cw233-pred-filters" role="tablist" aria-label="Турниры">${PREDICTION_FILTERS.map(filter => `<button type="button" data-cw233-filter="${filter.key}" aria-selected="${filter.key === activeFilter}">${filter.label}</button>`).join('')}</div>`;
}
function makeMatchHtml(match) {
  const state = predictionCardState(match); const score = scoreFor(match); const dirty = drafts.has(match.matchId); const hydrating = match?.state === 'hydrating';
  const disabled = hydrating ? ' disabled aria-disabled="true"' : '';
  return `<div class="match${hydrating ? ' cw233-prediction-bootstrap' : ''}" data-cw233-pred-card="${esc(match.matchId)}"><div class="match-head"><div class="teams"><div class="team">${teamLogo(match,'home')}<span class="team-name">${esc(teamName(match,'home'))}</span></div><span class="dash">—</span><div class="team away"><span class="team-name">${esc(teamName(match,'away'))}</span>${teamLogo(match,'away')}</div></div></div><div class="score"><div class="score-side"><button type="button" data-cw233-delta="h:-1"${disabled}>−</button><div class="score-value" data-cw233-score="h">${score.h}</div><button type="button" data-cw233-delta="h:1"${disabled}>+</button></div><span class="colon">:</span><div class="score-side"><button type="button" data-cw233-delta="a:-1"${disabled}>−</button><div class="score-value" data-cw233-score="a">${score.a}</div><button type="button" data-cw233-delta="a:1"${disabled}>+</button></div></div><div class="meta"><span>${esc(formatKickoff(match.kickoffAt))}</span><span data-cw233-state class="${dirty ? '' : state.kind === 'saved' ? 'saved' : ''}">${dirty ? 'не сохранён' : esc(state.label)}</span></div></div>`;
}
function mineMatchHtml(match) {
  const prediction = match?.prediction; const points = prediction?.points == null ? '' : ` · +${Number(prediction.points)}`;
  const finalScore = match?.state === 'finished' && Number.isInteger(Number(match?.homeScore)) && Number.isInteger(Number(match?.awayScore)) ? `ИТОГ · ${Number(match.homeScore)}:${Number(match.awayScore)}` : '';
  return `<div class="mine-match" data-cw233-pred-card="${esc(match.matchId)}"><div class="mine-main"><div class="mine-pair"><div class="mine-team">${teamLogo(match,'home')}<span>${esc(teamName(match,'home'))}</span></div><span class="mine-dash">—</span><div class="mine-team away"><span>${esc(teamName(match,'away'))}</span>${teamLogo(match,'away')}</div></div><div class="mine-meta"><span>${esc(formatKickoff(match.kickoffAt))}</span><span class="mine-live">${esc(finalScore)}</span></div></div><div class="mine-prediction ${prediction?.points != null ? 'has-points' : ''}">${prediction ? `${Number(prediction.predicted_home)}:${Number(prediction.predicted_away)}${points}` : '—'}</div></div>`;
}
function loadingBody() { return `<div class="cw233-prediction-loading" aria-label="Загрузка матчей">${Array.from({ length:6 }, () => '<span></span>').join('')}</div>`; }
function navigationHtml(groups, selectedKey) {
  if (!groups.length) return '';
  return `<div class="cw233-pred-nav" role="tablist" aria-label="Этапы турнира">${groups.map(group => `<button type="button" data-cw233-pred-nav="${esc(group.key)}" data-cw233-pred-locked="${group.locked ? 'true' : 'false'}" aria-selected="${group.key === selectedKey}" aria-disabled="${group.locked ? 'true' : 'false'}">${esc(group.label)}${group.locked ? ' 🔒' : ''}</button>`).join('')}</div>`;
}
function lockedRoundBody(groups, selected) {
  return `${navigationHtml(groups, selected.key)}<div class="section-title"><h3>${esc(selected.label)}</h3></div><div class="cw233-pred-round-locked"><span>🔒<br>Откроется после расчёта предыдущего тура</span></div>`;
}
function makeBody(rows) {
  const displayRows = activeFilter === 'all' ? rows.filter(match => match?.state === 'open' || match?.state === 'hydrating') : rows;
  if (loadingMatches && !displayRows.length) return loadingBody();
  if (loadingFailed && !displayRows.length) return '<div class="empty">Не удалось загрузить матчи. Попробуй открыть раздел ещё раз.</div>';
  if (!displayRows.length) return '<div class="empty">Нет матчей, на которые сейчас можно поставить прогноз</div>';
  if (UEFA_COMPETITIONS.has(activeFilter) || activeFilter === 'coppa_italia') {
    const groups = predictionNavigationGroups(displayRows, activeFilter);
    let selectedKey = activeNavigation.get(activeFilter);
    if (!groups.some(group => group.key === selectedKey)) {
      selectedKey = defaultPredictionNavigationKey(groups, new Date());
      if (selectedKey) activeNavigation.set(activeFilter, selectedKey);
    }
    const selected = groups.find(group => group.key === selectedKey) || groups[0];
    if (!selected) return '<div class="empty">Нет матчей, на которые сейчас можно поставить прогноз</div>';
    if (selected.locked) return lockedRoundBody(groups, selected);
    const visibleMatches = selected.matches.filter(match => match?.state === 'open' || match?.state === 'hydrating');
    return `${navigationHtml(groups, selected.key)}<div class="section-title"><h3>${esc(selected.label)}</h3></div><div class="matches">${visibleMatches.map(makeMatchHtml).join('')}</div>`;
  }
  const groups = groupPredictionMatchesByDate(displayRows);
  return groups.map(group => `<div class="section-title"><h3>${esc(formatDay(group.key))}</h3></div><div class="matches">${group.matches.map(makeMatchHtml).join('')}</div>`).join('');
}
function mineBody(rows) {
  if (loadingMatches && !rows.length) return loadingBody();
  if (loadingFailed && !rows.length) return '<div class="empty">Не удалось загрузить матчи. Попробуй открыть раздел ещё раз.</div>';
  if (!rows.length) return '<div class="empty">Сохранённых прогнозов пока нет</div>';
  return `<div class="section-title"><h3>Мои прогнозы</h3></div><div class="card mine-card">${rows.map(mineMatchHtml).join('')}</div>`;
}

function dispatchThemeRefresh() {
  try { document.dispatchEvent(new Event('ciao-v233-round11-theme')); } catch {}
}
function render() {
  if (!pageActive) return;
  const main = contentNode(); if (!main) return;
  const filterScrollLeft = main.querySelector('.cw233-pred-filters')?.scrollLeft || 0;
  const roundScrollLeft = main.querySelector('.cw233-pred-nav')?.scrollLeft || 0;
  const mainScrollTop = Number(main.scrollTop) || 0;
  const modeRows = predictionRowsForMode(matches, activeMode);
  const selected = filterPredictionMatches(modeRows, activeFilter);
  const writable = activeMode === 'make' && selected.some(match => match?.state === 'open');
  main.innerHTML = `<div class="cw233-prediction-page" data-cw233-round11-theme="${themeFor(activeFilter)}">${heroHtml()}${tabsHtml()}${filtersHtml()}${activeMode === 'mine' ? mineBody(selected) : makeBody(selected)}${writable ? '<div class="savebar"><button type="button" class="save" data-cw233-save-all>Сохранить прогнозы</button></div>' : ''}</div>`;
  const filters = main.querySelector('.cw233-pred-filters'); const navigation = main.querySelector('.cw233-pred-nav');
  if (filters) filters.scrollLeft = filterScrollLeft; if (navigation) navigation.scrollLeft = roundScrollLeft;
  main.scrollTop = mainScrollTop;
  dispatchThemeRefresh();
}

export function updatePredictionCard(card, match) {
  if (!card || !match) return false;
  const score = scoreFor(match);
  const home = card.querySelector?.('[data-cw233-score="h"]');
  const away = card.querySelector?.('[data-cw233-score="a"]');
  const state = card.querySelector?.('[data-cw233-state]');
  if (home) home.textContent = String(score.h);
  if (away) away.textContent = String(score.a);
  if (state) { state.textContent = drafts.has(match.matchId) ? 'не сохранён' : predictionCardState(match).label; state.classList?.remove?.('saved'); }
  return true;
}

function homeBootstrapMatches() {
  const state = globalThis.CiaoV233Home?.state?.();
  if (!state?.hydrated || !Array.isArray(state?.matches)) return [];
  const now = Date.now() - 60_000;
  return sortMatches(state.matches
    .filter(match => PREDICTION_COMPETITIONS.includes(text(match?.competition)))
    .filter(match => time(match) >= now)
    .map(match => ({ ...match, state:'hydrating', prediction:null, __predictionBootstrap:true })));
}

function primePredictionBootstrap() {
  if (loadedAt > 0 || matches.some(match => !match?.__predictionBootstrap)) return false;
  const bootstrap = homeBootstrapMatches();
  if (!bootstrap.length) return false;
  matches = bootstrap;
  if (pageActive) render();
  return true;
}

async function reloadMatches(generation = loadGeneration, force = false) {
  const finalState = force
    ? await client.available('all', { force:true })
    : await client.available('all');
  if (!pageActive || generation !== loadGeneration) return finalState;
  matches = sortMatches(Array.isArray(finalState?.matches) ? finalState.matches : []);
  currentParticipant = finalState?.participant || currentParticipant;
  loadingMatches = false;
  const errors = finalState?.errors && typeof finalState.errors === 'object' ? finalState.errors : {};
  loadingFailed = matches.length === 0 && Object.keys(errors).length === PREDICTION_COMPETITIONS.length;
  loadedAt = Date.now(); render(); return finalState;
}
async function open() {
  const generation = ++loadGeneration; pageActive = true;
  primePredictionBootstrap();
  const hasCache = matches.length > 0 && loadedAt > 0 && (Date.now() - loadedAt) <= MATCH_CACHE_TTL;
  loadingMatches = !hasCache; loadingFailed = false; render();
  try {
    const auth = initData();
    if (!auth) throw new Error('telegram_auth_required');
    client = client || createPredictionClient({ initData:auth });
    if (hasCache) loadingMatches = false;
    await reloadMatches(generation, hasCache);
  } catch {
    if (!pageActive || generation !== loadGeneration) return;
    loadingMatches = false; loadingFailed = loadedAt === 0 && !matches.length; render();
  }
}
function close() { pageActive = false; loadGeneration += 1; }

async function saveDrafts() {
  if (!drafts.size) { globalThis.Telegram?.WebApp?.showAlert?.('Измени хотя бы один прогноз'); return; }
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
      for (const row of Array.isArray(saved) ? saved : []) { matches = mergeAuthoritativePrediction(matches, row); drafts.delete(row.match_id); }
    }
    loadedAt = Date.now(); render();
  } catch (error) {
    if (error?.code === 'prediction_locked' || error?.code === 'prediction_round_locked') {
      try { await reloadMatches(loadGeneration, true); } catch {}
      render();
    }
    const message = error?.code === 'prediction_round_locked' ? 'Следующий тур откроется после расчёта предыдущего' : error?.code === 'prediction_locked' ? 'Дедлайн этого прогноза уже наступил' : 'Не удалось сохранить прогноз';
    globalThis.Telegram?.WebApp?.showAlert?.(message);
  }
}

function warmPredictionCache(attempt = 0, generation = warmGeneration) {
  if (generation !== warmGeneration) return false;
  primePredictionBootstrap();
  const auth = initData();
  if (!auth) {
    const delay = PREFETCH_RETRY_DELAYS[Math.min(attempt + 1, PREFETCH_RETRY_DELAYS.length - 1)];
    if (attempt + 1 < PREFETCH_RETRY_DELAYS.length) setTimeout(() => warmPredictionCache(attempt + 1, generation), delay);
    return false;
  }
  client = client || createPredictionClient({ initData:auth });
  void client.prefetchAvailable('all');
  return true;
}

function schedulePrefetch() {
  const generation = ++warmGeneration;
  const run = () => warmPredictionCache(0, generation);
  if (typeof globalThis.requestIdleCallback === 'function') globalThis.requestIdleCallback(run, { timeout:550 });
  else setTimeout(run, 180);
}

export function installPredictionsUi() {
  if (typeof document === 'undefined') return null;
  schedulePrefetch();
  const warmFromHome = () => { primePredictionBootstrap(); schedulePrefetch(); };
  globalThis.addEventListener?.('ciao-v233-home-ready', warmFromHome);
  globalThis.addEventListener?.('ciao-v233-home-updated', warmFromHome);
  document.addEventListener('click', event => {
    const homePredict = event.target?.closest?.('[data-cw231-action="predict"]');
    if (homePredict) {
      event.preventDefault(); activeMode = 'make';
      const cardCompetition = text(homePredict.closest?.('[data-cw233-competition]')?.dataset?.cw233Competition);
      activeFilter = PREDICTION_COMPETITIONS.includes(cardCompetition) ? cardCompetition : 'all';
      const nav = document.querySelector('#ciao-miniapp-root .nav button[data-tab="mine"]');
      if (nav) nav.click(); else void open(); return;
    }
    const nav = event.target?.closest?.('.nav button[data-tab]');
    if (nav?.dataset?.tab === 'mine') { primePredictionBootstrap(); void open(); return; }
    if (nav) { close(); return; }
    if (!pageActive) return;
    const mode = event.target?.closest?.('[data-cw233-mode]');
    if (mode) { activeMode = mode.dataset.cw233Mode === 'mine' ? 'mine' : 'make'; render(); return; }
    const filter = event.target?.closest?.('[data-cw233-filter]');
    if (filter) { activeFilter = filter.dataset.cw233Filter || 'all'; render(); return; }
    const group = event.target?.closest?.('[data-cw233-pred-nav]');
    if (group && (UEFA_COMPETITIONS.has(activeFilter) || activeFilter === 'coppa_italia')) { activeNavigation.set(activeFilter, group.dataset.cw233PredNav || ''); render(); return; }
    const delta = event.target?.closest?.('[data-cw233-delta]');
    if (delta) {
      const card = delta.closest('[data-cw233-pred-card]'); const id = card?.dataset?.cw233PredCard;
      const match = matches.find(item => item.matchId === id); if (!match || match.state !== 'open') return;
      const [side, raw] = String(delta.dataset.cw233Delta || '').split(':'); const next = { ...scoreFor(match) };
      next[side] = Math.max(0, Math.min(20, next[side] + Number(raw))); drafts.set(id, next); updatePredictionCard(card, match); return;
    }
    if (event.target?.closest?.('[data-cw233-save-all]')) void saveDrafts();
  });
  return Object.freeze({ open, close, warm:warmPredictionCache });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installPredictionsUi(), { once:true });
  else installPredictionsUi();
}
