import { createPredictionClient } from './prediction-client.mjs';

export const USER_FEEDBACK_ROUND15_PROFILE_BUILD = '2026-09-03-r15-profile';
export const USER_FEEDBACK_ROUND16_PROFILE_BUILD = '2026-09-03-r16-profile';

let client = null;
let cachedProfileStats = Object.freeze({ points:0, exactScores:0, correctOutcomes:0, scoredPredictions:0 });
let hasLoadedProfileStats = false;
let profileActive = false;
let loadGeneration = 0;

function text(value) { return String(value ?? '').trim(); }
function initData() { return text(globalThis.Telegram?.WebApp?.initData); }

function currentRankingRow(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const marked = list.find(row => row?.is_current === true);
  if (marked) return marked;
  const telegramId = text(globalThis.Telegram?.WebApp?.initDataUnsafe?.user?.id);
  if (!telegramId) return null;
  return list.find(row => text(row?.user_id) === `telegram:${telegramId}`) || null;
}

export function profileStatsFromRankingRow(row = null) {
  return Object.freeze({
    points:Number(row?.points) || 0,
    exactScores:Number(row?.exact_scores) || 0,
    correctOutcomes:Number(row?.correct_outcomes) || 0,
    scoredPredictions:Number(row?.scored_predictions) || 0,
  });
}

function profileStatsGrid(documentRef) {
  return documentRef?.querySelector?.('#ciao-miniapp-root .content .stats-grid') || null;
}

export function applyProfileRankingStats(documentRef = globalThis.document, stats = null) {
  const grid = profileStatsGrid(documentRef);
  if (!grid) return false;
  const normalized = profileStatsFromRankingRow(stats);
  const values = [normalized.points, normalized.exactScores, normalized.correctOutcomes, normalized.scoredPredictions];
  const tiles = [...(grid.querySelectorAll?.('.stat') || [])].slice(0, 4);
  if (tiles.length < 4) return false;
  tiles.forEach((stat, index) => {
    const value = stat.querySelector?.('b,strong,[data-value]');
    if (value) value.textContent = String(values[index]);
    stat.setAttribute?.('data-cw233-profile-stat', String(index));
  });
  return true;
}

export function applyProfileRankingPoints(documentRef = globalThis.document, points = 0) {
  const grid = profileStatsGrid(documentRef);
  if (!grid) return false;
  const stat = grid.querySelector?.('.stat:first-child') || grid.firstElementChild;
  const value = stat?.querySelector?.('b,strong,[data-value]');
  if (!stat || !value) return false;
  const normalized = Number.isFinite(Number(points)) ? Math.trunc(Number(points)) : 0;
  value.textContent = String(normalized);
  stat.setAttribute?.('data-cw233-profile-points', 'true');
  value.setAttribute?.('data-cw233-profile-points', 'true');
  return true;
}

function applyCached(documentRef) {
  if (!profileActive || !hasLoadedProfileStats) return false;
  return applyProfileRankingStats(documentRef, cachedProfileStats);
}

async function loadProfileStats(documentRef = globalThis.document, { force = false } = {}) {
  const auth = initData();
  if (!auth) return false;
  const generation = ++loadGeneration;
  client = client || createPredictionClient({ initData:auth });
  try {
    const ranking = await client.rankings({ scope:'overall' }, force ? { force:true } : undefined);
    if (generation !== loadGeneration) return false;
    cachedProfileStats = profileStatsFromRankingRow(currentRankingRow(ranking));
    hasLoadedProfileStats = true;
    globalThis.CiaoV233ProfileStats = cachedProfileStats;
    if (profileActive) applyProfileRankingStats(documentRef, cachedProfileStats);
    return true;
  } catch {
    if (generation !== loadGeneration) return false;
    if (!hasLoadedProfileStats) {
      cachedProfileStats = Object.freeze({ points:0, exactScores:0, correctOutcomes:0, scoredPredictions:0 });
      hasLoadedProfileStats = true;
      globalThis.CiaoV233ProfileStats = cachedProfileStats;
    }
    if (profileActive) applyProfileRankingStats(documentRef, cachedProfileStats);
    return false;
  }
}

function scheduleProfileApply(documentRef) {
  const run = () => { applyCached(documentRef); void loadProfileStats(documentRef); };
  if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(run);
  else globalThis.setTimeout?.(run, 0);
}

function schedulePrefetch(documentRef) {
  const run = () => void loadProfileStats(documentRef);
  if (initData()) {
    if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(run);
    else globalThis.setTimeout?.(run, 0);
    return;
  }
  if (typeof globalThis.requestIdleCallback === 'function') globalThis.requestIdleCallback(run, { timeout:900 });
  else globalThis.setTimeout?.(run, 400);
}

export function installProfileRatingUi(documentRef = globalThis.document) {
  if (!documentRef?.addEventListener) return null;
  schedulePrefetch(documentRef);
  const onClick = event => {
    const nav = event.target?.closest?.('#ciao-miniapp-root .nav button[data-tab]');
    if (nav) {
      profileActive = nav.dataset?.tab === 'profile';
      if (profileActive) scheduleProfileApply(documentRef);
      return;
    }
    if (profileActive) {
      const run = () => applyCached(documentRef);
      if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(run);
      else globalThis.setTimeout?.(run, 0);
    }
  };
  documentRef.addEventListener('click', onClick);
  return Object.freeze({ refresh:() => loadProfileStats(documentRef, { force:true }), apply:() => applyCached(documentRef), disconnect:() => documentRef.removeEventListener?.('click', onClick) });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installProfileRatingUi(document), { once:true });
  else installProfileRatingUi(document);
}
